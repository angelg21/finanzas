import { and, eq, sql } from "drizzle-orm";
import { db } from "./index";
import { type NuevaPartidaSobre, partidasSobre, reglasReparto } from "./schema";

import { aporteMensualCentavos, cabeEnRegla, totalAnualCentavos } from "@/lib/fondos";

/** La base o la transacción en curso: las escrituras del desglose van juntas. */
type Ejecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Una transacción a la vez por sobre: dos ediciones simultáneas del desglose leerían las mismas partidas y la regla
 * quedaría por debajo de lo que suman. El candado se suelta solo al terminar la transacción.
 */
async function bloquearDesglose(ejecutor: Ejecutor, sobreId: number) {
  await ejecutor.execute(sql`select pg_advisory_xact_lock(${claveDesglose}, ${sobreId})`);
}

/** Espacio de los candados del desglose, para no chocar con otros candados de la app. */
const claveDesglose = 2;

/** El desglose daría un aporte mensual que no cabe en la regla; la transacción se deshace entera. */
export class AporteFueraDeRango extends Error {}

/*
  Fondos de reserva: sobres que se alimentan con un aporte fijo mensual calculado
  a partir del desglose de ocasiones del año (tabla partidas_sobre).
  La aritmética vive en src/lib/fondos.ts; aquí solo lo que toca la base.
*/

/**
 * Recalcula la regla de reparto del sobre a partir de sus partidas activas.
 * Si no hay partidas, deja la regla como está (vale el monto manual). Devuelve el aporte fijado o null.
 */
export async function sincronizarAporte(sobreId: number, ejecutor: Ejecutor = db) {
  const partidas = await ejecutor
    .select({ montoCentavos: partidasSobre.montoCentavos, vecesPorAnio: partidasSobre.vecesPorAnio })
    .from(partidasSobre)
    .where(and(eq(partidasSobre.sobreId, sobreId), eq(partidasSobre.activa, true)));
  if (partidas.length === 0) return null;
  const aporte = aporteMensualCentavos(totalAnualCentavos(partidas));
  await fijarReglaFija(sobreId, aporte, ejecutor);
  return aporte;
}

/**
 * Agrega una ocasión al desglose y recalcula el aporte, en una sola transacción: si el aporte no cabe o algo falla,
 * no queda la partida sin su aporte, y un reintento no la duplica.
 */
export async function agregarPartidaYSincronizar(partida: NuevaPartidaSobre) {
  await db.transaction(async (tx) => {
    await bloquearDesglose(tx, partida.sobreId);
    await tx.insert(partidasSobre).values(partida);
    await sincronizarAporte(partida.sobreId, tx);
  });
}

/** Quita una ocasión del desglose y recalcula el aporte, en una sola transacción. */
export async function eliminarPartidaYSincronizar(id: number, sobreId: number) {
  await db.transaction(async (tx) => {
    await bloquearDesglose(tx, sobreId);
    await tx.delete(partidasSobre).where(and(eq(partidasSobre.id, id), eq(partidasSobre.sobreId, sobreId)));
    await sincronizarAporte(sobreId, tx);
  });
}

/** Deja la regla del sobre como fija con ese valor; la crea al final del orden si no existía. */
export async function fijarReglaFija(sobreId: number, valorCentavos: number, ejecutor: Ejecutor = db) {
  if (!cabeEnRegla(valorCentavos)) throw new AporteFueraDeRango(`Aporte de ${valorCentavos} centavos fuera de rango`);
  const actualizadas = await ejecutor
    .update(reglasReparto)
    .set({ tipo: "fijo", valor: valorCentavos })
    .where(eq(reglasReparto.sobreId, sobreId))
    .returning({ id: reglasReparto.id });
  if (actualizadas.length > 0) return;
  const [{ maximo }] = await ejecutor
    .select({ maximo: sql<number>`coalesce(max(${reglasReparto.orden}), 0)`.mapWith(Number) })
    .from(reglasReparto);
  await ejecutor.insert(reglasReparto).values({ sobreId, tipo: "fijo", valor: valorCentavos, orden: maximo + 1 });
}
