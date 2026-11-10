import { and, count, eq, max, or, sql } from "drizzle-orm";
import { db } from "./index";
import { cuentas, deudas, movimientos } from "./schema";
import { efectoEnCuenta, efectoEnCuentaUsd } from "./sumas-de-saldo";
import { type ValoresCuenta, destinoAlEliminarCuenta } from "@/lib/cuentas";

/*
  Administrar cuentas (spec 013). Las reglas viven en src/lib/cuentas.ts: aquí solo lo que toca la base. Crear una
  cuenta inserta solo su fila, con saldo 0: el invariante no cambia. Eliminar exige saldo 0, medido con la fila
  bloqueada; con historial se archiva, y saldosPorCuenta la vuelve a mostrar si su saldo deja de ser 0.
*/

const tocaLaCuenta = (id: number | typeof cuentas.id) =>
  or(eq(movimientos.cuentaOrigenId, id), eq(movimientos.cuentaDestinoId, id));

/** Todas las cuentas, activas y archivadas, con su saldo y cuántos movimientos y deudas la usan. */
export async function cuentasConUso() {
  return db
    .select({
      id: cuentas.id,
      nombre: cuentas.nombre,
      moneda: cuentas.moneda,
      tipo: cuentas.tipo,
      icono: cuentas.icono,
      color: cuentas.color,
      activa: cuentas.activa,
      saldoCentavos: sql<number>`coalesce(sum(${efectoEnCuenta(cuentas.id)}), 0)::bigint`.mapWith(Number),
      saldoUsdCentavos: sql<number>`coalesce(sum(${efectoEnCuentaUsd(cuentas.id)}), 0)::bigint`.mapWith(Number),
      usos: sql<number>`(count(${movimientos.id})
        + (select count(*) from ${deudas} where ${deudas.cuentaPrevistaId} = ${cuentas.id}))::int`.mapWith(Number),
    })
    .from(cuentas)
    .leftJoin(movimientos, tocaLaCuenta(cuentas.id))
    .groupBy(cuentas.id)
    .orderBy(cuentas.orden, cuentas.id);
}

export type CuentaConUso = Awaited<ReturnType<typeof cuentasConUso>>[number];

export async function cuentaPorId(id: number): Promise<CuentaConUso | null> {
  if (!Number.isInteger(id)) return null;
  return (await cuentasConUso()).find((c) => c.id === id) ?? null;
}

/** Crea una cuenta activa al final de la lista. Devuelve su id. */
export async function crearCuenta(valores: ValoresCuenta): Promise<number> {
  const [{ ultimo }] = await db.select({ ultimo: max(cuentas.orden) }).from(cuentas);
  const [{ id }] = await db
    .insert(cuentas)
    .values({ ...valores, orden: (ultimo ?? 0) + 1 })
    .returning({ id: cuentas.id });
  return id;
}

type Transaccion = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Bloquea la fila de la cuenta hasta el final de la transacción (FOR UPDATE) y mide sus usos y su saldo. El bloqueo
 * choca con el que toma el INSERT de un movimiento sobre la clave foránea, así que uno que se esté guardando con esta
 * cuenta termina antes de medir. Null si no existe.
 */
async function bloquearYMedir(tx: Transaccion, id: number) {
  const [fila] = await tx.select({ moneda: cuentas.moneda }).from(cuentas).where(eq(cuentas.id, id)).for("update");
  if (!fila) return null;
  const [suma] = await tx
    .select({
      cuantos: count(),
      saldoCentavos: sql<number>`coalesce(sum(${efectoEnCuenta(id)}), 0)::bigint`.mapWith(Number),
      saldoUsdCentavos: sql<number>`coalesce(sum(${efectoEnCuentaUsd(id)}), 0)::bigint`.mapWith(Number),
    })
    .from(movimientos)
    .where(tocaLaCuenta(id));
  const [{ previstas }] = await tx.select({ previstas: count() }).from(deudas).where(eq(deudas.cuentaPrevistaId, id));
  return {
    moneda: fila.moneda,
    usos: suma.cuantos + previstas,
    saldoCentavos: suma.saldoCentavos,
    saldoUsdCentavos: suma.saldoUsdCentavos,
  };
}

/**
 * Cambia nombre, moneda, tipo, icono y color. La moneda no cambia si la cuenta ya se usa, también aquí y no solo en la
 * validación de la acción: sus montos están en esa moneda (criterio 5).
 */
export async function actualizarCuenta(
  id: number,
  valores: ValoresCuenta,
): Promise<"actualizada" | "moneda-fija" | "no-existe"> {
  return db.transaction(async (tx) => {
    const actual = await bloquearYMedir(tx, id);
    if (!actual) return "no-existe";
    if (actual.moneda !== valores.moneda && actual.usos > 0) return "moneda-fija";
    await tx.update(cuentas).set(valores).where(eq(cuentas.id, id));
    return "actualizada";
  });
}

/** Criterios 7 a 9: con saldo no se toca; en 0, sin usos se borra y con historial se archiva. */
export async function eliminarCuenta(id: number): Promise<"borrada" | "archivada" | "con-saldo" | "no-existe"> {
  return db.transaction(async (tx) => {
    const actual = await bloquearYMedir(tx, id);
    if (!actual) return "no-existe";
    const destino = destinoAlEliminarCuenta(actual);
    if (destino === "con-saldo") return "con-saldo";
    if (destino === "borrar") {
      await tx.delete(cuentas).where(eq(cuentas.id, id));
      return "borrada";
    }
    await tx.update(cuentas).set({ activa: false }).where(eq(cuentas.id, id));
    return "archivada";
  });
}

/** Criterio 11: una archivada vuelve a la lista y a los formularios de registro. */
export async function restaurarCuenta(id: number) {
  await db
    .update(cuentas)
    .set({ activa: true })
    .where(and(eq(cuentas.id, id), eq(cuentas.activa, false)));
}
