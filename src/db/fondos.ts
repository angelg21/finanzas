import { and, eq, sql } from "drizzle-orm";
import { db } from "./index";
import { partidasSobre, reglasReparto } from "./schema";

import { aporteMensualCentavos, totalAnualCentavos } from "@/lib/fondos";

/*
  Fondos de reserva: sobres que se alimentan con un aporte fijo mensual calculado
  a partir del desglose de ocasiones del año (tabla partidas_sobre).
  La aritmética vive en src/lib/fondos.ts; aquí solo lo que toca la base.
*/

/**
 * Recalcula la regla de reparto del sobre a partir de sus partidas activas.
 * Si no hay partidas, deja la regla como está (vale el monto manual). Devuelve el aporte fijado o null.
 */
export async function sincronizarAporte(sobreId: number) {
  const partidas = await db
    .select({ montoCentavos: partidasSobre.montoCentavos, vecesPorAnio: partidasSobre.vecesPorAnio })
    .from(partidasSobre)
    .where(and(eq(partidasSobre.sobreId, sobreId), eq(partidasSobre.activa, true)));
  if (partidas.length === 0) return null;
  const aporte = aporteMensualCentavos(totalAnualCentavos(partidas));
  await fijarReglaFija(sobreId, aporte);
  return aporte;
}

/** Deja la regla del sobre como fija con ese valor; la crea al final del orden si no existía. */
export async function fijarReglaFija(sobreId: number, valorCentavos: number) {
  const actualizadas = await db
    .update(reglasReparto)
    .set({ tipo: "fijo", valor: valorCentavos })
    .where(eq(reglasReparto.sobreId, sobreId))
    .returning({ id: reglasReparto.id });
  if (actualizadas.length > 0) return;
  const [{ maximo }] = await db
    .select({ maximo: sql<number>`coalesce(max(${reglasReparto.orden}), 0)`.mapWith(Number) })
    .from(reglasReparto);
  await db.insert(reglasReparto).values({ sobreId, tipo: "fijo", valor: valorCentavos, orden: maximo + 1 });
}
