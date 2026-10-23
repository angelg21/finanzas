import { and, eq, inArray, sql } from "drizzle-orm";
import { type VistaPrevia, cambiosPorSobre, firmaDeRetiro, noAlcanzaElRetiro } from "../lib/retiro";
import { bloquearDeuda } from "./guardar-deudas";
import { db } from "./index";
import { claveReparto, saldoDeSobre } from "./movimientos";
import { aplicarRetiros, planDeRetiroDesde, vistaPrevia } from "./retiro";
import { cuentas, deudas, movimientos, sobres } from "./schema";

/*
  Deshacer un pago o un cobro de una deuda (spec 007). Vivía repartido entre las escrituras de deudas y la edición de
  gastos e ingresos; tiene su propio archivo desde la revisión de la 007 (hallazgo 5).
*/

const idValido = (id: number) => Number.isSafeInteger(id) && id > 0 && id <= 2_147_483_647;

/**
 * Un pago o un cobro de una deuda, con la persona y la cuenta, para deshacerlo (spec 007, criterio 1); null si no. De
 * un cobro, la vista previa: cómo quedan la cuenta y "Por asignar" y, si ya lo repartió, lo que se retira del reparto
 * posterior (criterio 11); o por qué no se puede, para no ofrecer "Sí, deshacer" en vano. Sin candado: la acción
 * vuelve a mirar y compara la firma.
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
      montoDestinoCentavos: movimientos.montoDestinoCentavos,
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
  let previa: VistaPrevia | null = null;
  if (m.tipo === "cobro_prestamo" && m.sobreDestinoId !== null) {
    const saldo = await saldoDeSobre(db, m.sobreDestinoId);
    const [sobre] = await db.select({ nombre: sobres.nombre }).from(sobres).where(eq(sobres.id, m.sobreDestinoId));
    const porAsignar = { sobreId: m.sobreDestinoId, nombre: sobre?.nombre ?? "Por asignar" };
    const plan = await planDeRetiroDesde(db, m.montoUsdCentavos - saldo, m.sobreDestinoId, m.id, null, false);
    if (!plan.alcanza) impedido = noAlcanzaElRetiro(porAsignar.nombre, saldo, plan);
    else {
      const cuentaQueSale = m.cuentaId && { id: m.cuentaId, centavos: m.montoDestinoCentavos ?? m.montoCentavos };
      const cambios = cambiosPorSobre(porAsignar, m.montoUsdCentavos, [], plan.retiros);
      previa = await vistaPrevia(cuentaQueSale || null, cambios, plan.retiros);
    }
  }
  return { ...m, cuenta: cuenta?.nombre ?? null, impedido, previa };
}

export type PagoOCobro = NonNullable<Awaited<ReturnType<typeof pagoOCobroParaDeshacer>>>;

/**
 * Deshacer un pago o un cobro (spec 007, criterios 1 a 3): borra el movimiento con el candado de la deuda, que
 * serializa con pagar y cobrar. Un pago devuelve el dinero a su cuenta y a Deudas, siempre. Un cobro lo saca de la
 * cuenta y de "Por asignar": con su candado (el del reparto, tomado después del de la deuda, en el mismo orden que en
 * todas partes). Si "Por asignar" ya no lo tiene, retira lo que falta del reparto posterior (criterio 11), solo si es
 * el mismo plan que se vio y confirmó (`firma`); si cambió, responde `cambio` para volver a mostrarlo.
 */
export async function deshacerPagoOCobro(
  id: number,
  firma = "",
): Promise<{ ok: true; deudaId: number } | { ok: false; error: string } | { noExiste: true } | { cambio: true }> {
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
      const plan = await planDeRetiroDesde(tx, m.montoUsdCentavos - saldo, m.sobreDestinoId, m.id, null, true);
      if (!plan.alcanza) {
        const [sobre] = await tx.select({ nombre: sobres.nombre }).from(sobres).where(eq(sobres.id, m.sobreDestinoId));
        return { ok: false as const, error: noAlcanzaElRetiro(sobre?.nombre ?? "Por asignar", saldo, plan) };
      }
      if (firmaDeRetiro(plan.retiros) !== firma) return { cambio: true as const };
      await aplicarRetiros(tx, plan.retiros);
    } else if (firma !== "") {
      return { cambio: true as const };
    }
    await tx.delete(movimientos).where(eq(movimientos.id, m.id));
    return { ok: true as const, deudaId: m.deudaId };
  });
}
