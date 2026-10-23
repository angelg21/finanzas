import { and, count, desc, eq, max, sql } from "drizzle-orm";
import { db } from "./index";
import { categorias, gastosPorCompletar, movimientos } from "./schema";

import { type TipoCategoria, destinoAlEliminar } from "@/lib/categorias";

/*
  Administrar categorías (spec 001, ampliación). Las reglas viven en src/lib/categorias.ts: aquí solo
  lo que toca la base. Las categorías no tocan saldos, así que nada de esto afecta al invariante.
*/

/**
 * Todas las categorías, activas y archivadas, con cuántos movimientos tienen en total (para decidir
 * entre borrar y archivar) y cuántos en los últimos 90 días (para ordenar por uso, criterio 17).
 */
export async function categoriasConUso() {
  const usos =
    sql<number>`count(${movimientos.id}) filter (where ${movimientos.fecha} >= current_date - 90)::int`.mapWith(Number);
  return db
    .select({
      id: categorias.id,
      nombre: categorias.nombre,
      tipo: categorias.tipo,
      icono: categorias.icono,
      color: categorias.color,
      activa: categorias.activa,
      // Con los gastos por completar que la usan (spec 009): con alguno, se archiva en vez de borrarse.
      movimientos:
        sql<number>`(count(${movimientos.id}) + (select count(*) from ${gastosPorCompletar} where ${gastosPorCompletar.categoriaId} = ${categorias.id}))::int`.mapWith(
          Number,
        ),
      usos,
    })
    .from(categorias)
    .leftJoin(movimientos, eq(movimientos.categoriaId, categorias.id))
    .groupBy(categorias.id)
    .orderBy(desc(usos), categorias.orden, categorias.id);
}

export type CategoriaConUso = Awaited<ReturnType<typeof categoriasConUso>>[number];

/**
 * Una categoría de ese tipo aunque esté archivada, con lo que pinta su píldora, o null. Al editar un gasto, un
 * ingreso o un gasto por completar se puede dejar la que ya tiene: corregir otra cosa no obliga a recategorizarlo
 * (revisión de la 006; spec 010, criterio 3).
 */
export async function categoriaDelMovimiento(id: number, tipo: TipoCategoria) {
  if (!Number.isSafeInteger(id) || id <= 0 || id > 2_147_483_647) return null;
  const [c] = await db
    .select({ id: categorias.id, nombre: categorias.nombre, icono: categorias.icono, color: categorias.color })
    .from(categorias)
    .where(and(eq(categorias.id, id), eq(categorias.tipo, tipo)));
  return c ?? null;
}

/** Una categoría con su número de movimientos, o null si no existe. */
export async function categoriaPorId(id: number): Promise<CategoriaConUso | null> {
  if (!Number.isInteger(id)) return null;
  return (await categoriasConUso()).find((c) => c.id === id) ?? null;
}

type ValoresCategoria = { nombre: string; tipo: TipoCategoria; icono: string; color: string };

/** Crea una categoría activa al final de su tipo. Devuelve su id. */
export async function crearCategoria(valores: ValoresCategoria): Promise<number> {
  const [{ ultimo }] = await db
    .select({ ultimo: max(categorias.orden) })
    .from(categorias)
    .where(eq(categorias.tipo, valores.tipo));
  const [{ id }] = await db
    .insert(categorias)
    .values({ ...valores, orden: (ultimo ?? 0) + 1 })
    .returning({ id: categorias.id });
  return id;
}

type Transaccion = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Bloquea la fila de la categoría hasta el final de la transacción (FOR UPDATE) y cuenta sus movimientos.
 * El bloqueo choca con el que toma el INSERT de un movimiento sobre la clave foránea, así que un gasto que
 * se esté guardando con esta categoría termina antes de contar. Null si la categoría no existe.
 */
async function bloquearYContar(tx: Transaccion, id: number) {
  const [fila] = await tx.select({ tipo: categorias.tipo }).from(categorias).where(eq(categorias.id, id)).for("update");
  if (!fila) return null;
  const [{ cuantos }] = await tx.select({ cuantos: count() }).from(movimientos).where(eq(movimientos.categoriaId, id));
  // Los gastos por completar también la usan (spec 009): con alguno, ni cambia de tipo ni se borra, se archiva.
  const [{ anotados }] = await tx
    .select({ anotados: count() })
    .from(gastosPorCompletar)
    .where(eq(gastosPorCompletar.categoriaId, id));
  return { tipo: fila.tipo, movimientos: cuantos + anotados };
}

/**
 * Cambia nombre, tipo, icono y color. Es la misma fila: sus movimientos siguen en ella (criterio 20).
 * El tipo no cambia si tiene movimientos, también aquí y no solo en la validación de la acción: un gasto
 * nunca queda con una categoría de ingreso, lo llame quien lo llame.
 */
export async function actualizarCategoria(
  id: number,
  valores: ValoresCategoria,
): Promise<"actualizada" | "tipo-fijo" | "no-existe"> {
  return db.transaction(async (tx) => {
    const actual = await bloquearYContar(tx, id);
    if (!actual) return "no-existe";
    if (actual.tipo !== valores.tipo && actual.movimientos > 0) return "tipo-fijo";
    await tx.update(categorias).set(valores).where(eq(categorias.id, id));
    return "actualizada";
  });
}

/** Criterio 21: sin movimientos se borra; con alguno se archiva, y el historial conserva su categoría. */
export async function eliminarCategoria(id: number): Promise<"borrada" | "archivada" | "no-existe"> {
  return db.transaction(async (tx) => {
    const actual = await bloquearYContar(tx, id);
    if (!actual) return "no-existe";
    if (destinoAlEliminar(actual.movimientos) === "borrar") {
      await tx.delete(categorias).where(eq(categorias.id, id));
      return "borrada";
    }
    await tx.update(categorias).set({ activa: false }).where(eq(categorias.id, id));
    return "archivada";
  });
}

/** Una archivada vuelve a ofrecerse al registrar (criterio 22). */
export async function restaurarCategoria(id: number) {
  await db
    .update(categorias)
    .set({ activa: true })
    .where(and(eq(categorias.id, id), eq(categorias.activa, false)));
}
