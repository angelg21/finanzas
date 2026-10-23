import { and, eq, inArray, sql } from "drizzle-orm";
import { type Retiro, type VistaPrevia, cambiosPorSobre, noAlcanzaElRetiro } from "../lib/retiro";
import { bloquearDeuda } from "./guardar-deudas";
import { db } from "./index";
import { type Ejecutor, claveReparto, saldoDeSobre } from "./movimientos";
import { aplicarRetiros, bloquearSobresDelRetiro, planDeRetiroDesde, vistaPrevia } from "./retiro";
import { cuentas, deudas, movimientos, sobres } from "./schema";

/*
  Deshacer un pago o un cobro de una deuda (spec 007). Vivía repartido entre las escrituras de deudas y la edición de
  gastos e ingresos; tiene su propio archivo desde la revisión de la 007 (hallazgo 5).
*/

const idValido = (id: number) => Number.isSafeInteger(id) && id > 0 && id <= 2_147_483_647;

type CobroLeido = {
  id: number;
  montoCentavos: number;
  montoUsdCentavos: number;
  montoDestinoCentavos: number | null;
  sobreDestinoId: number;
  cuentaId: number | null;
};

/**
 * Lo que pasaría al deshacer un cobro (criterio 11), leído con el ejecutor dado: la vista previa con lo que se retira,
 * o por qué no se puede. La pantalla lo pide sin candado; la acción, con `bloquear`, dentro de su transacción.
 */
async function alDeshacerElCobro(
  ejecutor: Ejecutor,
  c: CobroLeido,
  bloquear: boolean,
): Promise<{ error: string } | { previa: VistaPrevia; retiros: Retiro[] }> {
  const saldo = await saldoDeSobre(ejecutor, c.sobreDestinoId);
  const [sobre] = await ejecutor.select({ nombre: sobres.nombre }).from(sobres).where(eq(sobres.id, c.sobreDestinoId));
  const porAsignar = { sobreId: c.sobreDestinoId, nombre: sobre?.nombre ?? "Por asignar" };
  // Nunca más de lo que trajo el cobro: si "Por asignar" ya estaba en negativo, eso no es de este cobro (guardian).
  const faltan = Math.min(c.montoUsdCentavos, c.montoUsdCentavos - saldo);
  const plan = await planDeRetiroDesde(ejecutor, faltan, c.sobreDestinoId, c.id, bloquear);
  if (!plan.alcanza) return { error: noAlcanzaElRetiro(porAsignar.nombre, saldo, plan) };
  if (bloquear) await bloquearSobresDelRetiro(ejecutor, plan.retiros);
  const cuenta = c.cuentaId === null ? null : { id: c.cuentaId, centavos: c.montoDestinoCentavos ?? c.montoCentavos };
  const cambios = cambiosPorSobre(porAsignar, c.montoUsdCentavos, [], plan.retiros);
  return { previa: await vistaPrevia(ejecutor, cuenta, cambios, plan.retiros), retiros: plan.retiros };
}

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
    const r = await alDeshacerElCobro(db, { ...m, sobreDestinoId: m.sobreDestinoId }, false);
    if ("error" in r) impedido = r.error;
    else previa = r.previa;
  }
  return { ...m, cuenta: cuenta?.nombre ?? null, impedido, previa };
}

export type PagoOCobro = NonNullable<Awaited<ReturnType<typeof pagoOCobroParaDeshacer>>>;

/**
 * Deshacer un pago o un cobro (spec 007, criterios 1 a 3): borra el movimiento con el candado de la deuda, que
 * serializa con pagar y cobrar. Un pago devuelve el dinero a su cuenta y a Deudas, siempre. Un cobro lo saca de la
 * cuenta y de "Por asignar": con su candado (el del reparto, tomado después del de la deuda, en el mismo orden que en
 * todas partes). Si "Por asignar" ya no lo tiene, retira lo que falta del reparto posterior (criterio 11), solo si es
 * la misma vista previa que se vio y confirmó (`firma`: filas, montos y saldos); si cambió, responde `cambio` para
 * volver a mostrarla.
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
      const r = await alDeshacerElCobro(
        tx,
        { ...m, sobreDestinoId: m.sobreDestinoId, cuentaId: m.cuentaDestinoId },
        true,
      );
      if ("error" in r) return { ok: false as const, error: r.error };
      if (r.previa.firma !== firma) return { cambio: true as const };
      await aplicarRetiros(tx, r.retiros);
    } else if (firma !== "") {
      return { cambio: true as const };
    }
    await tx.delete(movimientos).where(eq(movimientos.id, m.id));
    return { ok: true as const, deudaId: m.deudaId };
  });
}
