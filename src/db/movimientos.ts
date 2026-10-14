import { and, eq, inArray } from "drizzle-orm";
import { referenciaDeCaptura } from "../lib/captura";
import { db } from "./index";
import { type Movimiento, type NuevoMovimiento, movimientos } from "./schema";

/*
  Escritura de movimientos. Los saldos nunca se guardan: se calculan desde estas filas
  (src/db/consultas.ts). Las filas llegan ya preparadas por src/lib, con su forma por tipo.
*/

/**
 * Inserta varias filas en una sola sentencia: en Postgres un INSERT es atómico, así que entran todas
 * o ninguna. Un gasto en bolívares vendiendo USDT son dos filas (transferencia y gasto) que no pueden
 * quedar a medias. Sin BEGIN ni COMMIT aparte: dos viajes menos a la base en la captura de un gasto.
 * Devuelve los ids insertados; quien necesite uno en concreto que lo busque por tipo, no por posición.
 * Una referencia repetida aborta la sentencia entera: nada queda a medias.
 */
export async function registrarMovimientos(filas: NuevoMovimiento[]): Promise<number[]> {
  if (filas.length === 0) return [];
  const insertadas = await db.insert(movimientos).values(filas).returning({ id: movimientos.id });
  return insertadas.map((f) => f.id);
}

/** El choque con el índice único de (origen, referencia_externa); drizzle envuelve el error de Postgres en `cause`. */
function esReferenciaRepetida(error: unknown) {
  const deLaBase = (error as { cause?: { code?: string; constraint_name?: string } } | null)?.cause;
  return deLaBase?.code === "23505" && deLaBase.constraint_name === "movimientos_origen_referencia_unico";
}

/**
 * Registra las filas de una captura de gasto (spec 002, criterio 19). Si sus referencias ya estaban, porque el primer
 * intento llegó y la respuesta se perdió, la sentencia no inserta nada y devuelve todo lo guardado con el id de esa
 * captura, sea cual sea su forma de pago, para que la acción compare antes de decir "ya estaba".
 */
export async function registrarCaptura(
  idCaptura: string,
  filas: NuevoMovimiento[],
): Promise<{ nueva: true } | { nueva: false; guardadas: Movimiento[] }> {
  try {
    await registrarMovimientos(filas);
    return { nueva: true };
  } catch (error) {
    if (!esReferenciaRepetida(error)) throw error;
    const referencias = [referenciaDeCaptura(idCaptura, "gasto"), referenciaDeCaptura(idCaptura, "transferencia")];
    const guardadas = await db
      .select()
      .from(movimientos)
      .where(and(eq(movimientos.origen, "manual"), inArray(movimientos.referenciaExterna, referencias)));
    return { nueva: false, guardadas };
  }
}
