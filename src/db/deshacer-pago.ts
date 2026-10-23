import { and, eq, inArray, sql } from "drizzle-orm";
import { formatearCifra } from "../lib/dinero";
import { bloquearDeuda } from "./guardar-deudas";
import { db } from "./index";
import { claveReparto, saldoDeSobre } from "./movimientos";
import { cuentas, deudas, movimientos, sobres } from "./schema";

/*
  Deshacer un pago o un cobro de una deuda (spec 007). Vivía repartido entre las escrituras de deudas y la edición de
  gastos e ingresos; tiene su propio archivo desde la revisión de la 007 (hallazgo 5).
*/

const idValido = (id: number) => Number.isSafeInteger(id) && id > 0 && id <= 2_147_483_647;

/** "Por asignar tiene 10,00; le faltan 10,00": por qué un cobro ya repartido no se deshace (criterio 2). */
const faltaEnElSobre = (nombre: string, saldo: number, monto: number) =>
  `${nombre} tiene ${formatearCifra(saldo)}; le faltan ${formatearCifra(monto - saldo)}`;

/**
 * Un pago o un cobro de una deuda, con la persona y la cuenta, para deshacerlo (spec 007, criterio 1); null si no. De
 * un cobro que "Por asignar" ya no tiene, por qué no se puede, para no ofrecer "Sí, deshacer" en vano (revisión de la
 * 007, hallazgo 4). Sin candado: la acción vuelve a mirar.
 */
export async function pagoOCobroParaDeshacer(id: number) {
  if (!idValido(id)) return null;
  const [m] = await db
    .select({
      id: movimientos.id,
      tipo: movimientos.tipo,
      fecha: movimientos.fecha,
      montoCentavos: movimientos.montoCentavos,
      montoUsdCentavos: movimientos.montoUsdCentavos,
      moneda: movimientos.moneda,
      nota: movimientos.nota,
      deudaId: movimientos.deudaId,
      sobreDestinoId: movimientos.sobreDestinoId,
      persona: deudas.persona,
      cuentaId: sql<number | null>`coalesce(${movimientos.cuentaOrigenId}, ${movimientos.cuentaDestinoId})`,
    })
    .from(movimientos)
    .innerJoin(deudas, eq(deudas.id, movimientos.deudaId))
    .where(and(eq(movimientos.id, id), inArray(movimientos.tipo, ["pago_deuda", "cobro_prestamo"])));
  if (!m) return null;
  const [cuenta] = m.cuentaId
    ? await db.select({ nombre: cuentas.nombre }).from(cuentas).where(eq(cuentas.id, m.cuentaId))
    : [];
  let impedido: string | null = null;
  if (m.tipo === "cobro_prestamo" && m.sobreDestinoId !== null) {
    const saldo = await saldoDeSobre(db, m.sobreDestinoId);
    if (saldo < m.montoUsdCentavos) {
      const [sobre] = await db.select({ nombre: sobres.nombre }).from(sobres).where(eq(sobres.id, m.sobreDestinoId));
      const nombre = sobre?.nombre ?? "Por asignar";
      impedido = `${faltaEnElSobre(nombre, saldo, m.montoUsdCentavos)}. Devuelve lo que falta a ${nombre} con Mover y vuelve a intentarlo.`;
    }
  }
  return { ...m, cuenta: cuenta?.nombre ?? null, impedido };
}

export type PagoOCobro = NonNullable<Awaited<ReturnType<typeof pagoOCobroParaDeshacer>>>;

/**
 * Deshacer un pago o un cobro (spec 007, criterios 1 a 3): borra el movimiento con el candado de la deuda, que
 * serializa con pagar y cobrar. Un pago devuelve el dinero a su cuenta y a Deudas, siempre. Un cobro lo saca de la
 * cuenta y de "Por asignar": con su candado (el del reparto, tomado después del de la deuda, en el mismo orden que en
 * todas partes) y solo si "Por asignar" todavía lo tiene; si ya se repartió, lo dice.
 */
export async function deshacerPagoOCobro(
  id: number,
): Promise<{ ok: true; deudaId: number } | { ok: false; error: string } | { noExiste: true }> {
  if (!Number.isSafeInteger(id) || id <= 0 || id > 2_147_483_647) return { noExiste: true };
  return db.transaction(async (tx) => {
    const [visto] = await tx
      .select({ deudaId: movimientos.deudaId })
      .from(movimientos)
      .where(and(eq(movimientos.id, id), sql`${movimientos.tipo}::text in ('pago_deuda', 'cobro_prestamo')`));
    if (!visto?.deudaId) return { noExiste: true as const };
    await bloquearDeuda(tx, visto.deudaId);
    const [m] = await tx
      .select()
      .from(movimientos)
      .where(and(eq(movimientos.id, id), sql`${movimientos.tipo}::text in ('pago_deuda', 'cobro_prestamo')`))
      .for("update");
    if (!m?.deudaId) return { noExiste: true as const };
    if (m.tipo === "cobro_prestamo") {
      if (m.sobreDestinoId === null) throw new Error("Un cobro sin sobre destino");
      await tx.execute(sql`select pg_advisory_xact_lock(${claveReparto}, ${m.sobreDestinoId})`);
      const saldo = await saldoDeSobre(tx, m.sobreDestinoId);
      if (saldo < m.montoUsdCentavos) {
        const [sobre] = await tx.select({ nombre: sobres.nombre }).from(sobres).where(eq(sobres.id, m.sobreDestinoId));
        return {
          ok: false as const,
          error: faltaEnElSobre(sobre?.nombre ?? "Por asignar", saldo, m.montoUsdCentavos),
        };
      }
    }
    await tx.delete(movimientos).where(eq(movimientos.id, m.id));
    return { ok: true as const, deudaId: m.deudaId };
  });
}
