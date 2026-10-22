import { asc, count, eq, inArray } from "drizzle-orm";
import type { FilaPorCompletar } from "../lib/por-completar";
import { db } from "./index";
import { esReferenciaRepetida, guardadasDeCaptura, registrarMovimientos } from "./movimientos";
import { type Movimiento, type NuevoMovimiento, categorias, gastosPorCompletar } from "./schema";

/*
  Gastos por completar (spec 009). Anotar no toca movimientos. Completar inserta los movimientos y borra los
  pendientes en una sola transacción, con los pendientes bloqueados: completar dos veces el mismo, o completarlo
  mientras se descarta, deja uno de los dos y nunca un gasto sin su pendiente borrado (criterios 6, 7, 9 y 10).
*/

/** Anota un pendiente. Un reintento con la misma referencia no lo anota dos veces (criterio 3). */
export async function anotarPorCompletar(fila: FilaPorCompletar & { referencia: string }) {
  const insertadas = await db
    .insert(gastosPorCompletar)
    .values(fila)
    .onConflictDoNothing({ target: gastosPorCompletar.referencia })
    .returning({ id: gastosPorCompletar.id });
  return { nueva: insertadas.length > 0 };
}

/** Los pendientes, del más viejo al más nuevo, con su categoría (criterio 4). */
export async function listarPorCompletar() {
  return db
    .select({
      id: gastosPorCompletar.id,
      fecha: gastosPorCompletar.fecha,
      nota: gastosPorCompletar.nota,
      montoCentavos: gastosPorCompletar.montoCentavos,
      moneda: gastosPorCompletar.moneda,
      categoriaId: gastosPorCompletar.categoriaId,
      categoria: categorias.nombre,
      icono: categorias.icono,
      color: categorias.color,
    })
    .from(gastosPorCompletar)
    .innerJoin(categorias, eq(gastosPorCompletar.categoriaId, categorias.id))
    .orderBy(asc(gastosPorCompletar.fecha), asc(gastosPorCompletar.id));
}

export type PorCompletar = Awaited<ReturnType<typeof listarPorCompletar>>[number];

/** Cuántos hay, para el aviso del inicio y de Registrar (criterio 5). */
export async function contarPorCompletar() {
  const [{ cantidad }] = await db.select({ cantidad: count() }).from(gastosPorCompletar);
  return cantidad;
}

/** Un pendiente por su id, o null. */
export async function porCompletarPorId(id: number) {
  if (!Number.isSafeInteger(id) || id <= 0 || id > 2_147_483_647) return null;
  const [p] = await db.select().from(gastosPorCompletar).where(eq(gastosPorCompletar.id, id));
  return p ?? null;
}

/** Descarta un pendiente; false si ya no estaba. */
export async function descartarPorCompletar(id: number) {
  if (!Number.isSafeInteger(id) || id <= 0 || id > 2_147_483_647) return false;
  const borradas = await db
    .delete(gastosPorCompletar)
    .where(eq(gastosPorCompletar.id, id))
    .returning({ id: gastosPorCompletar.id });
  return borradas.length > 0;
}

type Resultado = { nueva: true } | { nueva: false; guardadas: Movimiento[] } | { faltan: true };

/**
 * Completa uno o varios pendientes: inserta sus movimientos (gastos, y la venta si la hay) y los borra, todo junto.
 * Un reintento de la misma captura se reconoce antes de mirar los pendientes, que el primer intento ya borró. Si
 * alguno ya no está (se completó en otra pestaña o se descartó), no se escribe nada.
 */
export async function completarPorCompletar(
  idCaptura: string,
  ids: number[],
  filas: NuevoMovimiento[],
): Promise<Resultado> {
  if (ids.length === 0 || filas.length === 0) throw new Error("Completar pide pendientes y movimientos");
  try {
    return await db.transaction(async (tx) => {
      const bloqueados = await tx
        .select({ id: gastosPorCompletar.id })
        .from(gastosPorCompletar)
        .where(inArray(gastosPorCompletar.id, ids))
        .for("update");
      const previas = await guardadasDeCaptura(idCaptura, tx);
      if (previas.length > 0) return { nueva: false as const, guardadas: previas };
      if (bloqueados.length !== new Set(ids).size) return { faltan: true as const };
      await registrarMovimientos(filas, tx);
      await tx.delete(gastosPorCompletar).where(inArray(gastosPorCompletar.id, ids));
      return { nueva: true as const };
    });
  } catch (error) {
    if (!esReferenciaRepetida(error)) throw error;
    return { nueva: false, guardadas: await guardadasDeCaptura(idCaptura) };
  }
}
