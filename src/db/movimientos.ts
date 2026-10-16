import { and, eq, inArray, like, ne, sql } from "drizzle-orm";
import { prefijoDeCaptura } from "../lib/captura";
import { db } from "./index";
import { type Movimiento, type NuevoMovimiento, movimientos, sobres } from "./schema";
import { efectoEnSobre } from "./sumas-de-saldo";

/*
  Escritura de movimientos. Los saldos nunca se guardan: se calculan desde estas filas
  (src/db/consultas.ts). Las filas llegan ya preparadas por src/lib, con su forma por tipo.
*/

/** La base o la transacción en curso. */
type Ejecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Inserta varias filas en una sola sentencia: en Postgres un INSERT es atómico, así que entran todas
 * o ninguna. Un gasto en bolívares vendiendo USDT son dos filas (transferencia y gasto) que no pueden
 * quedar a medias. Sin BEGIN ni COMMIT aparte: dos viajes menos a la base en la captura de un gasto.
 * Devuelve los ids insertados; quien necesite uno en concreto que lo busque por tipo, no por posición.
 * Una referencia repetida aborta la sentencia entera: nada queda a medias.
 */
export async function registrarMovimientos(filas: NuevoMovimiento[], ejecutor: Ejecutor = db): Promise<number[]> {
  if (filas.length === 0) return [];
  const insertadas = await ejecutor.insert(movimientos).values(filas).returning({ id: movimientos.id });
  return insertadas.map((f) => f.id);
}

/** El choque con el índice único de (origen, referencia_externa); drizzle envuelve el error de Postgres en `cause`. */
function esReferenciaRepetida(error: unknown) {
  const deLaBase = (error as { cause?: { code?: string; constraint_name?: string } } | null)?.cause;
  return deLaBase?.code === "23505" && deLaBase.constraint_name === "movimientos_origen_referencia_unico";
}

/**
 * Todo lo guardado a mano con el id de esa captura, sea gasto, venta, ingreso o reparto. Un LIKE sin índice (la
 * intercalación no lo permite): solo corre tras un choque, o al repartir, que es raro; nunca en la captura de un gasto.
 */
export async function guardadasDeCaptura(idCaptura: string, ejecutor: Ejecutor = db) {
  return ejecutor
    .select()
    .from(movimientos)
    .where(
      and(eq(movimientos.origen, "manual"), like(movimientos.referenciaExterna, `${prefijoDeCaptura(idCaptura)}%`)),
    );
}

type ResultadoCaptura = { nueva: true } | { nueva: false; guardadas: Movimiento[] };

/**
 * Registra las filas de una captura (spec 002, criterio 19; spec 004, criterio 7). Si sus referencias ya estaban,
 * porque el primer intento llegó y la respuesta se perdió, la sentencia no inserta nada y devuelve todo lo guardado
 * con el id de esa captura, sea cual sea su forma, para que la acción compare antes de decir "ya estaba".
 */
export async function registrarCaptura(idCaptura: string, filas: NuevoMovimiento[]): Promise<ResultadoCaptura> {
  try {
    await registrarMovimientos(filas);
    return { nueva: true };
  } catch (error) {
    if (!esReferenciaRepetida(error)) throw error;
    return { nueva: false, guardadas: await guardadasDeCaptura(idCaptura) };
  }
}

/** Espacio de los candados del reparto, para no chocar con los del desglose (src/db/fondos.ts). */
const claveReparto = 3;

/** Saldo en USD de un sobre, leído dentro de la transacción: las mismas reglas que saldosPorSobre. */
async function saldoDeSobre(ejecutor: Ejecutor, sobreId: number) {
  const [fila] = await ejecutor
    .select({
      saldo: sql<number>`coalesce(sum(${efectoEnSobre(sobreId)}), 0)::bigint`.mapWith(Number),
    })
    .from(movimientos)
    .where(sql`${movimientos.sobreOrigenId} = ${sobreId} or ${movimientos.sobreDestinoId} = ${sobreId}`);
  return fila?.saldo ?? 0;
}

/**
 * Reparte lo que ya está en "Por asignar" (spec 004, criterio 10): solo reasignaciones desde él, a sobres activos.
 * Una transacción con candado por sobre: dos pestañas que reparten a la vez esperan su turno, y cada una vuelve a
 * leer el saldo antes de insertar, así que nunca se reparte más de lo que hay.
 *
 * Un reintento con el mismo id se reconoce antes de mirar el saldo y devuelve lo guardado (guardian-datos, T5): si el
 * primer intento se llevó todo, comparar primero el saldo diría "no alcanza" de un reparto que sí se guardó, y unos
 * sobres distintos no chocarían con el índice y guardarían un segundo reparto.
 */
export async function repartirPorAsignar(
  idCaptura: string,
  porAsignarId: number,
  filas: NuevoMovimiento[],
): Promise<ResultadoCaptura | { sinSaldo: true; saldoCentavos: number }> {
  const prefijo = prefijoDeCaptura(idCaptura);
  const forma = (f: NuevoMovimiento) =>
    f.tipo === "reasignacion" && f.sobreOrigenId === porAsignarId && f.referenciaExterna?.startsWith(prefijo);
  if (filas.length === 0 || !filas.every(forma)) {
    throw new Error("Repartir solo admite reasignaciones desde Por asignar con la referencia de la captura");
  }
  const destinos = [...new Set(filas.map((f) => f.sobreDestinoId ?? 0))];
  const total = filas.reduce((a, f) => a + f.montoUsdCentavos, 0);
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${claveReparto}, ${porAsignarId})`);
      const previas = await guardadasDeCaptura(idCaptura, tx);
      if (previas.length > 0) return { nueva: false as const, guardadas: previas };
      // Un sobre inactivo no sale en saldosPorSobre: un reparto hacia él descuadraría la pantalla Cuentas.
      const [{ aptos }] = await tx
        .select({ aptos: sql<number>`count(*)::int`.mapWith(Number) })
        .from(sobres)
        .where(and(inArray(sobres.id, destinos), eq(sobres.activo, true), ne(sobres.tipo, "por_asignar")));
      if (aptos !== destinos.length) throw new Error("Repartir solo a sobres activos que no sean Por asignar");
      const saldo = await saldoDeSobre(tx, porAsignarId);
      if (total > saldo) return { sinSaldo: true as const, saldoCentavos: saldo };
      await registrarMovimientos(filas, tx);
      return { nueva: true as const };
    });
  } catch (error) {
    if (!esReferenciaRepetida(error)) throw error;
    return { nueva: false, guardadas: await guardadasDeCaptura(idCaptura) };
  }
}
