import { db } from "./index";
import { type NuevoMovimiento, movimientos } from "./schema";

/*
  Escritura de movimientos. Los saldos nunca se guardan: se calculan desde estas filas
  (src/db/consultas.ts). Las filas llegan ya preparadas por src/lib, con su forma por tipo.
*/

/**
 * Inserta varias filas en una sola sentencia: en Postgres un INSERT es atómico, así que entran todas
 * o ninguna. Un gasto en bolívares vendiendo USDT son dos filas (transferencia y gasto) que no pueden
 * quedar a medias. Sin BEGIN ni COMMIT aparte: dos viajes menos a la base en la captura de un gasto.
 * Devuelve los ids insertados; quien necesite uno en concreto que lo busque por tipo, no por posición.
 */
export async function registrarMovimientos(filas: NuevoMovimiento[]): Promise<number[]> {
  if (filas.length === 0) return [];
  const insertadas = await db.insert(movimientos).values(filas).returning({ id: movimientos.id });
  return insertadas.map((f) => f.id);
}
