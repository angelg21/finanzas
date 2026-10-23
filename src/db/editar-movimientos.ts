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
import type { EtiquetaPedida } from "../lib/etiquetas";
import type { ErroresGasto, FilaMovimiento } from "../lib/gastos";
import { resolverEtiqueta } from "./etiquetas";
import { db } from "./index";
import { type Ejecutor, claveReparto, guardadasDeCaptura, saldoDeSobre } from "./movimientos";
import { movimientos, sobres } from "./schema";

/*
  Editar o borrar un gasto o un ingreso (spec 006). Cada operación es una transacción: se vuelve a leer la fila y lo
  enlazado por su captura, se pide el plan a src/lib con lo leído ahí dentro, y solo entonces se escribe. Las de un
  ingreso toman antes el candado de "Por asignar" (el del reparto): nadie reparte ni paga desde él a la vez.
*/

const soloEditables = ["gasto", "ingreso"] as const;

/** El mayor id de una columna integer: uno más grande no existe, y Postgres lo rechazaría con 22003 (guardian, T3). */
const idMaximo = 2_147_483_647;
const idValido = (id: number) => Number.isSafeInteger(id) && id > 0 && id <= idMaximo;

/**
 * Los valores que la edición puede cambiar en una fila, campo por campo: nunca el tipo, el origen, la referencia ni
 * la fecha de creación. El escritor no se fía de lo que traiga el plan más allá de esto (guardian, T3).
 */
const valoresDeGasto = (f: FilaMovimiento) => ({
  fecha: f.fecha,
  montoCentavos: f.montoCentavos,
  moneda: f.moneda,
  montoUsdCentavos: f.montoUsdCentavos,
  tasa: f.tasa,
  cuentaOrigenId: f.cuentaOrigenId,
  sobreOrigenId: f.sobreOrigenId,
  categoriaId: f.categoriaId,
  nota: f.nota,
});
const valoresDeVenta = (f: FilaMovimiento) => ({
  fecha: f.fecha,
  montoCentavos: f.montoCentavos,
  moneda: f.moneda,
  montoUsdCentavos: f.montoUsdCentavos,
  montoDestinoCentavos: f.montoDestinoCentavos,
  monedaDestino: f.monedaDestino,
  tasa: f.tasa,
  cuentaOrigenId: f.cuentaOrigenId,
  cuentaDestinoId: f.cuentaDestinoId,
});

/** Un gasto o un ingreso con lo enlazado por su captura; null si no existe o es de otro tipo (criterio 8). */
export async function movimientoParaEditar(id: number) {
  if (!idValido(id)) return null;
  const [movimiento] = await db
    .select()
    .from(movimientos)
    .where(and(eq(movimientos.id, id), inArray(movimientos.tipo, [...soloEditables])));
  if (!movimiento) return null;
  const captura = movimiento.origen === "manual" ? idDeReferencia(movimiento.referenciaExterna) : null;
  const enlazadas = captura ? (await guardadasDeCaptura(captura)).filter((f) => f.id !== movimiento.id) : [];
  // Solo el gasto de una captura con venta propia ("captura-X-gasto") tiene la venta; los de "completar varios"
  // ("captura-X-gasto-<n>", spec 009) la comparten y no es de ninguno (guardian-datos, 009, segunda vuelta).
  const ventaPropia = captura !== null && movimiento.referenciaExterna === referenciaDeCaptura(captura, "gasto");
  const venta =
    movimiento.tipo === "gasto" && ventaPropia ? (enlazadas.find((f) => f.tipo === "transferencia") ?? null) : null;
  const reparto =
    movimiento.tipo === "ingreso"
      ? enlazadas.filter((f) => f.tipo === "reasignacion" && f.sobreOrigenId === movimiento.sobreDestinoId)
      : [];
  return { movimiento, captura, venta, reparto };
}

export type MovimientoParaEditar = NonNullable<Awaited<ReturnType<typeof movimientoParaEditar>>>;

/** La fila, bloqueada hasta el final de la transacción, si es del tipo pedido. */
async function filaBloqueada(tx: Ejecutor, id: number, tipo: (typeof soloEditables)[number]) {
  if (!idValido(id)) return null;
  const [fila] = await tx
    .select()
    .from(movimientos)
    .where(and(eq(movimientos.id, id), eq(movimientos.tipo, tipo)))
    .for("update");
  return fila ?? null;
}

/**
 * La venta de la captura de un gasto, bloqueada, si es solo suya. Se decide por la referencia del gasto, no contando
 * los que quedan: "captura-X-gasto" tiene venta propia; los de "completar varios" ("captura-X-gasto-<n>" y
 * "captura-X-gasto-resto", spec 009) comparten una que no se actualiza, no se reemplaza ni se borra al editar o borrar
 * uno de ellos: lo vendido se vendió (guardian-datos, 009, primera y segunda vuelta).
 */
async function ventaBloqueada(tx: Ejecutor, captura: string | null, referenciaDelGasto: string | null) {
  if (!captura) return { venta: null, compartida: false };
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
  if (!venta) return { venta: null, compartida: false };
  return referenciaDelGasto === referenciaDeCaptura(captura, "gasto")
    ? { venta, compartida: false }
    : { venta: null, compartida: true };
}

export type ResultadoEdicion<E> = { ok: true } | { ok: false; errores: E } | { noExiste: true };

/** Criterios 2 y 3: el gasto conserva su fila (y su origen y referencia); la venta se actualiza, se crea o se borra. */
export async function editarGasto(
  id: number,
  planear: (guardado: GastoGuardado) => PlanDeGasto,
  etiqueta: EtiquetaPedida,
): Promise<ResultadoEdicion<ErroresGasto>> {
  return db.transaction(async (tx) => {
    const gasto = await filaBloqueada(tx, id, "gasto");
    if (!gasto) return { noExiste: true as const };
    const captura = gasto.origen === "manual" ? idDeReferencia(gasto.referenciaExterna) : null;
    const { venta, compartida } = await ventaBloqueada(tx, captura, gasto.referenciaExterna);
    const plan = planear({ gastoId: gasto.id, ventaId: venta?.id ?? null });
    if (!plan.ok) return plan;
    if (
      plan.gasto.fila.tipo !== "gasto" ||
      (plan.venta && plan.venta.accion !== "borrar" && plan.venta.fila.tipo !== "transferencia")
    ) {
      throw new Error("El plan de un gasto trae filas de otro tipo");
    }
    if (plan.venta?.accion === "crear" && compartida) {
      const vendido =
        "Este gasto se pagó con una venta compartida: para cambiarle la forma de pago, bórralo y regístralo de nuevo";
      return { ok: false as const, errores: { vendido } };
    }
    if (plan.venta?.accion === "crear" && !captura) {
      // Sin captura, la venta nueva no quedaría enlazada al gasto (criterio 8).
      const vendido = "Este gasto no se registró en la app: para pagarlo vendiendo USDT, bórralo y regístralo de nuevo";
      return { ok: false as const, errores: { vendido } };
    }
    // La etiqueta, después de todo lo que rechaza: una edición que no se guarda no deja etiquetas (spec 008).
    const etiquetaId = await resolverEtiqueta(tx, etiqueta);
    await tx
      .update(movimientos)
      .set({ ...valoresDeGasto(plan.gasto.fila), etiquetaId })
      .where(eq(movimientos.id, gasto.id));
    // La venta se toca por el id leído bajo el bloqueo, nunca por el que traiga el plan.
    if (plan.venta?.accion === "actualizar" && venta) {
      await tx.update(movimientos).set(valoresDeVenta(plan.venta.fila)).where(eq(movimientos.id, venta.id));
    } else if (plan.venta?.accion === "crear" && captura && !venta) {
      await tx.insert(movimientos).values({
        ...valoresDeVenta(plan.venta.fila),
        tipo: "transferencia",
        origen: "manual",
        referenciaExterna: referenciaDeCaptura(captura, "transferencia"),
      });
    } else if (plan.venta?.accion === "borrar" && venta) {
      await tx.delete(movimientos).where(eq(movimientos.id, venta.id));
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
    // Una venta compartida se queda: lo vendido se vendió, y lo de este gasto vuelve a Bolívares como vuelto.
    const { venta } = await ventaBloqueada(tx, captura, gasto.referenciaExterna);
    if (venta) await tx.delete(movimientos).where(eq(movimientos.id, venta.id));
    await tx.delete(movimientos).where(eq(movimientos.id, gasto.id));
    return { ok: true as const, conVenta: venta !== null };
  });
}

/** Criterios 4 y 5: con el candado del sobre que lo recibió y su saldo leído ahí dentro. Su reparto no cambia. */
export async function editarIngreso(
  id: number,
  planear: (guardado: IngresoGuardado, saldoDestinoCentavos: number) => PlanDeIngreso,
  etiqueta: EtiquetaPedida,
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
    if (plan.fila.tipo !== "ingreso" || plan.fila.sobreDestinoId !== ingreso.sobreDestinoId) {
      throw new Error("El plan de un ingreso no es de este ingreso");
    }
    // Campo por campo: ni el tipo, ni el sobre que lo recibió, ni el origen o la referencia cambian.
    const f = plan.fila;
    const etiquetaId = await resolverEtiqueta(tx, etiqueta);
    await tx
      .update(movimientos)
      .set({
        fecha: f.fecha,
        montoCentavos: f.montoCentavos,
        moneda: f.moneda,
        montoUsdCentavos: f.montoUsdCentavos,
        cuentaDestinoId: f.cuentaDestinoId,
        categoriaId: f.categoriaId,
        nota: f.nota,
        etiquetaId,
      })
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

/**
 * Lo que pasaría al borrar un ingreso, para la confirmación (criterio 7), y su reparto con el nombre de cada sobre.
 * Sin candado: la acción vuelve a mirar.
 */
export async function vistaPreviaDeBorrado(
  m: MovimientoParaEditar,
): Promise<{ plan: PlanDeBorrado; reparto: RepartoGuardado[] } | null> {
  const destinoId = m.movimiento.sobreDestinoId;
  if (m.movimiento.tipo !== "ingreso" || destinoId === null) return null;
  const { reparto } = await repartoConSaldos(db, m.captura, destinoId);
  const [destino] = await db.select({ nombre: sobres.nombre }).from(sobres).where(eq(sobres.id, destinoId));
  const plan = planDeBorradoDeIngreso({
    montoUsdCentavos: m.movimiento.montoUsdCentavos,
    destino: { nombre: destino?.nombre ?? "Por asignar", saldoCentavos: await saldoDeSobre(db, destinoId) },
    reparto,
  });
  return { plan, reparto };
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
