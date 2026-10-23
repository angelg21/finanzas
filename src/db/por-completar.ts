import { asc, count, eq, inArray } from "drizzle-orm";
import { type EtiquetaPedida, conEtiqueta } from "../lib/etiquetas";
import type { FilaPorCompletar } from "../lib/por-completar";
import { resolverEtiqueta } from "./etiquetas";
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

/**
 * Corrige un pendiente (spec 010): lo mismo que se anota, campo por campo; nunca la referencia ni la fecha de
 * creación. false si ya no estaba (se completó o se descartó en otra pestaña).
 */
export async function editarPorCompletar(id: number, fila: FilaPorCompletar) {
  if (!Number.isSafeInteger(id) || id <= 0 || id > 2_147_483_647) return false;
  const editadas = await db
    .update(gastosPorCompletar)
    .set({
      fecha: fila.fecha,
      categoriaId: fila.categoriaId,
      nota: fila.nota,
      montoCentavos: fila.montoCentavos,
      moneda: fila.moneda,
    })
    .where(eq(gastosPorCompletar.id, id))
    .returning({ id: gastosPorCompletar.id });
  return editadas.length > 0;
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

type Resultado = { nueva: true } | { nueva: false; guardadas: Movimiento[] } | { faltan: true } | { otra: true };

/**
 * Completa uno o varios pendientes: inserta sus movimientos (gastos, y la venta si la hay) y los borra, todo junto.
 * Un reintento de la misma captura se reconoce antes de mirar los pendientes, que el primer intento ya borró. Si
 * alguno ya no está (se completó en otra pestaña o se descartó), no se escribe nada, tampoco la etiqueta pedida: se
 * crea al final, cuando ya no hay nada que rechace (spec 008).
 */
export async function completarPorCompletar(
  idCaptura: string,
  ids: number[],
  filas: NuevoMovimiento[],
  etiqueta: EtiquetaPedida = null,
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
      // Lo guardado con este id es de otra cosa si los pendientes siguen ahí: un reintento de verdad ya los borró
      // (guardian-datos, 0007, hallazgo 4).
      if (previas.length > 0 && bloqueados.length > 0) return { otra: true as const };
      if (previas.length > 0) return { nueva: false as const, guardadas: previas };
      if (bloqueados.length !== new Set(ids).size) return { faltan: true as const };
      await registrarMovimientos(conEtiqueta(filas, await resolverEtiqueta(tx, etiqueta)), tx);
      await tx.delete(gastosPorCompletar).where(inArray(gastosPorCompletar.id, ids));
      return { nueva: true as const };
    });
  } catch (error) {
    if (!esReferenciaRepetida(error)) throw error;
    return { nueva: false, guardadas: await guardadasDeCaptura(idCaptura) };
  }
}
