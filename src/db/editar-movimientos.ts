import { and, eq, inArray, like, sql } from "drizzle-orm";
import { idDeReferencia, prefijoDeCaptura, referenciaDeCaptura } from "../lib/captura";
import type { GastoGuardado, PlanDeGasto } from "../lib/editar-gasto";
import {
  type IngresoGuardado,
  type PlanDeBorrado,
  type PlanDeIngreso,
  type RepartoGuardado,
  planDeBorradoDeIngreso,
} from "../lib/editar-ingreso";
import type { ErroresGasto } from "../lib/gastos";
import { db } from "./index";
import { type Ejecutor, claveReparto, guardadasDeCaptura, saldoDeSobre } from "./movimientos";
import { movimientos, sobres } from "./schema";

/*
  Editar o borrar un gasto o un ingreso (spec 006). Cada operación es una transacción: se vuelve a leer la fila y lo
  enlazado por su captura, se pide el plan a src/lib con lo leído ahí dentro, y solo entonces se escribe. Las de un
  ingreso toman antes el candado de "Por asignar" (el del reparto): nadie reparte ni paga desde él a la vez.
*/

const soloEditables = ["gasto", "ingreso"] as const;

/** Un gasto o un ingreso con lo enlazado por su captura; null si no existe o es de otro tipo (criterio 8). */
export async function movimientoParaEditar(id: number) {
  const [movimiento] = await db
    .select()
    .from(movimientos)
    .where(and(eq(movimientos.id, id), inArray(movimientos.tipo, [...soloEditables])));
  if (!movimiento) return null;
  const captura = movimiento.origen === "manual" ? idDeReferencia(movimiento.referenciaExterna) : null;
  const enlazadas = captura ? (await guardadasDeCaptura(captura)).filter((f) => f.id !== movimiento.id) : [];
  const venta = movimiento.tipo === "gasto" ? (enlazadas.find((f) => f.tipo === "transferencia") ?? null) : null;
  const reparto =
    movimiento.tipo === "ingreso"
      ? enlazadas.filter((f) => f.tipo === "reasignacion" && f.sobreOrigenId === movimiento.sobreDestinoId)
      : [];
  return { movimiento, captura, venta, reparto };
}

export type MovimientoParaEditar = NonNullable<Awaited<ReturnType<typeof movimientoParaEditar>>>;

/** La fila, bloqueada hasta el final de la transacción, si es del tipo pedido. */
async function filaBloqueada(tx: Ejecutor, id: number, tipo: (typeof soloEditables)[number]) {
  const [fila] = await tx
    .select()
    .from(movimientos)
    .where(and(eq(movimientos.id, id), eq(movimientos.tipo, tipo)))
    .for("update");
  return fila ?? null;
}

/** La venta enlazada a la captura de un gasto, bloqueada. */
async function ventaBloqueada(tx: Ejecutor, captura: string | null) {
  if (!captura) return null;
  const [venta] = await tx
    .select()
    .from(movimientos)
    .where(
      and(
        eq(movimientos.origen, "manual"),
        eq(movimientos.tipo, "transferencia"),
        eq(movimientos.referenciaExterna, referenciaDeCaptura(captura, "transferencia")),
      ),
    )
    .for("update");
  return venta ?? null;
}

export type ResultadoEdicion<E> = { ok: true } | { ok: false; errores: E } | { noExiste: true };

/** Criterios 2 y 3: el gasto conserva su fila (y su origen y referencia); la venta se actualiza, se crea o se borra. */
export async function editarGasto(
  id: number,
  planear: (guardado: GastoGuardado) => PlanDeGasto,
): Promise<ResultadoEdicion<ErroresGasto>> {
  return db.transaction(async (tx) => {
    const gasto = await filaBloqueada(tx, id, "gasto");
    if (!gasto) return { noExiste: true as const };
    const captura = gasto.origen === "manual" ? idDeReferencia(gasto.referenciaExterna) : null;
    const venta = await ventaBloqueada(tx, captura);
    const plan = planear({ gastoId: gasto.id, ventaId: venta?.id ?? null });
    if (!plan.ok) return plan;
    if (plan.venta?.accion === "crear" && !captura) {
      // Sin captura, la venta nueva no quedaría enlazada al gasto (criterio 8).
      const vendido = "Este gasto no se registró en la app: para pagarlo vendiendo USDT, bórralo y regístralo de nuevo";
      return { ok: false as const, errores: { vendido } };
    }
    await tx
      .update(movimientos)
      .set({ ...plan.gasto.fila, origen: gasto.origen })
      .where(eq(movimientos.id, gasto.id));
    if (plan.venta?.accion === "actualizar") {
      await tx
        .update(movimientos)
        .set({ ...plan.venta.fila, nota: venta?.nota ?? null })
        .where(eq(movimientos.id, plan.venta.id));
    } else if (plan.venta?.accion === "crear" && captura) {
      await tx
        .insert(movimientos)
        .values({ ...plan.venta.fila, referenciaExterna: referenciaDeCaptura(captura, "transferencia") });
    } else if (plan.venta?.accion === "borrar") {
      await tx.delete(movimientos).where(eq(movimientos.id, plan.venta.id));
    }
    return { ok: true as const };
  });
}

/** Criterio 6: el gasto y su venta enlazada, juntos. */
export async function borrarGasto(id: number): Promise<{ ok: true; conVenta: boolean } | { noExiste: true }> {
  return db.transaction(async (tx) => {
    const gasto = await filaBloqueada(tx, id, "gasto");
    if (!gasto) return { noExiste: true as const };
    const captura = gasto.origen === "manual" ? idDeReferencia(gasto.referenciaExterna) : null;
    const venta = await ventaBloqueada(tx, captura);
    if (venta) await tx.delete(movimientos).where(eq(movimientos.id, venta.id));
    await tx.delete(movimientos).where(eq(movimientos.id, gasto.id));
    return { ok: true as const, conVenta: venta !== null };
  });
}

/** Criterios 4 y 5: con el candado del sobre que lo recibió y su saldo leído ahí dentro. Su reparto no cambia. */
export async function editarIngreso(
  id: number,
  planear: (guardado: IngresoGuardado, saldoDestinoCentavos: number) => PlanDeIngreso,
): Promise<ResultadoEdicion<Extract<PlanDeIngreso, { ok: false }>["errores"]>> {
  return db.transaction(async (tx) => {
    const ingreso = await filaBloqueada(tx, id, "ingreso");
    if (!ingreso?.sobreDestinoId) return { noExiste: true as const };
    await tx.execute(sql`select pg_advisory_xact_lock(${claveReparto}, ${ingreso.sobreDestinoId})`);
    const saldo = await saldoDeSobre(tx, ingreso.sobreDestinoId);
    const guardado = {
      id: ingreso.id,
      montoUsdCentavos: ingreso.montoUsdCentavos,
      sobreDestinoId: ingreso.sobreDestinoId,
    };
    const plan = planear(guardado, saldo);
    if (!plan.ok) return plan;
    await tx
      .update(movimientos)
      .set({ ...plan.fila, origen: ingreso.origen })
      .where(eq(movimientos.id, ingreso.id));
    return { ok: true as const };
  });
}

/** El reparto de un ingreso, con el nombre y el saldo de cada sobre que recibió, leído con el ejecutor dado. */
export async function repartoConSaldos(
  ejecutor: Ejecutor,
  captura: string | null,
  sobreDestinoId: number,
): Promise<{ ids: number[]; reparto: RepartoGuardado[] }> {
  if (!captura) return { ids: [], reparto: [] };
  const filas = await ejecutor
    .select({ id: movimientos.id, sobreId: movimientos.sobreDestinoId, montoUsdCentavos: movimientos.montoUsdCentavos })
    .from(movimientos)
    .where(
      and(
        eq(movimientos.origen, "manual"),
        eq(movimientos.tipo, "reasignacion"),
        eq(movimientos.sobreOrigenId, sobreDestinoId),
        like(movimientos.referenciaExterna, `${prefijoDeCaptura(captura)}reasignacion-%`),
      ),
    );
  const reparto: RepartoGuardado[] = [];
  for (const f of filas) {
    if (f.sobreId === null) continue;
    const [sobre] = await ejecutor.select({ nombre: sobres.nombre }).from(sobres).where(eq(sobres.id, f.sobreId));
    reparto.push({
      sobreId: f.sobreId,
      nombre: sobre?.nombre ?? "?",
      montoUsdCentavos: f.montoUsdCentavos,
      saldoCentavos: await saldoDeSobre(ejecutor, f.sobreId),
    });
  }
  return { ids: filas.map((f) => f.id), reparto };
}

/** Lo que pasaría al borrar un ingreso, para la confirmación (criterio 7). Sin candado: la acción vuelve a mirar. */
export async function vistaPreviaDeBorrado(m: MovimientoParaEditar): Promise<PlanDeBorrado | null> {
  const destinoId = m.movimiento.sobreDestinoId;
  if (m.movimiento.tipo !== "ingreso" || destinoId === null) return null;
  const { reparto } = await repartoConSaldos(db, m.captura, destinoId);
  const [destino] = await db.select({ nombre: sobres.nombre }).from(sobres).where(eq(sobres.id, destinoId));
  return planDeBorradoDeIngreso({
    montoUsdCentavos: m.movimiento.montoUsdCentavos,
    destino: { nombre: destino?.nombre ?? "Por asignar", saldoCentavos: await saldoDeSobre(db, destinoId) },
    reparto,
  });
}

/** Criterio 7: el ingreso y su reparto, con el candado de "Por asignar"; no deja "Por asignar" en negativo. */
export async function borrarIngreso(id: number): Promise<PlanDeBorrado | { noExiste: true }> {
  return db.transaction(async (tx) => {
    const ingreso = await filaBloqueada(tx, id, "ingreso");
    if (!ingreso?.sobreDestinoId) return { noExiste: true as const };
    await tx.execute(sql`select pg_advisory_xact_lock(${claveReparto}, ${ingreso.sobreDestinoId})`);
    const captura = ingreso.origen === "manual" ? idDeReferencia(ingreso.referenciaExterna) : null;
    const { ids, reparto } = await repartoConSaldos(tx, captura, ingreso.sobreDestinoId);
    const [destino] = await tx
      .select({ nombre: sobres.nombre })
      .from(sobres)
      .where(eq(sobres.id, ingreso.sobreDestinoId));
    const plan = planDeBorradoDeIngreso({
      montoUsdCentavos: ingreso.montoUsdCentavos,
      destino: {
        nombre: destino?.nombre ?? "Por asignar",
        saldoCentavos: await saldoDeSobre(tx, ingreso.sobreDestinoId),
      },
      reparto,
    });
    if (!plan.ok) return plan;
    if (ids.length > 0) await tx.delete(movimientos).where(inArray(movimientos.id, ids));
    await tx.delete(movimientos).where(eq(movimientos.id, ingreso.id));
    return plan;
  });
}
