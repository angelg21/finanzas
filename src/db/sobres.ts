import { and, eq, sql } from "drizzle-orm";
import { pendientePorSentido } from "@/lib/deudas";
import { type NivelDeSobre, nivelParaIcono } from "@/lib/sobres";
import { saldosPorSobre } from "./consultas";
import { deudasConPendiente } from "./deudas";
import { db } from "./index";
import { partidasSobre, reglasReparto } from "./schema";

/*
  Lo que necesita el icono de cada sobre para llenarse: su saldo, su tope, su regla fija, lo que pide su desglose
  del año y, en Deudas, lo que se debe. La aritmética está en src/lib/sobres.ts.
*/

/** Por sobre, el valor de su regla fija activa y la suma anual de su desglose; y lo que debo, para Deudas. */
async function medidasPorSobre() {
  const [fijas, anuales, debidoCentavos] = await Promise.all([
    db
      .select({ sobreId: reglasReparto.sobreId, valor: reglasReparto.valor })
      .from(reglasReparto)
      .where(and(eq(reglasReparto.activa, true), eq(reglasReparto.tipo, "fijo"))),
    db
      .select({
        sobreId: partidasSobre.sobreId,
        // En numeric, que no desborda: una suma fuera de los enteros seguros la descarta nivelParaIcono.
        centavos: sql<number>`sum(${partidasSobre.montoCentavos}::numeric * ${partidasSobre.vecesPorAnio})`.mapWith(
          Number,
        ),
      })
      .from(partidasSobre)
      .where(eq(partidasSobre.activa, true))
      .groupBy(partidasSobre.sobreId),
    // Una deuda con datos rotos hace lanzar a pendienteDe: aquí deja a Deudas sin medida, como nivelParaIcono, y no
    // tumba el inicio, /sobres ni el reparto. /deudas sí lo dice (guardian-datos, T6).
    deudasConPendiente().then(
      (deudas) => pendientePorSentido(deudas).deboCentavos,
      () => null,
    ),
  ]);
  return {
    fijoDe: new Map(fijas.map((f) => [f.sobreId, f.valor])),
    anualDe: new Map(anuales.map((a) => [a.sobreId, a.centavos])),
    debidoCentavos,
  };
}

/** Los sobres activos con su saldo, como saldosPorSobre, y cuánto de lleno está cada uno. */
export async function sobresConNivel(): Promise<
  (Awaited<ReturnType<typeof saldosPorSobre>>[number] & { nivel: NivelDeSobre })[]
> {
  const [sobres, { fijoDe, anualDe, debidoCentavos }] = await Promise.all([saldosPorSobre(), medidasPorSobre()]);
  return sobres.map((s) => ({
    ...s,
    nivel: nivelParaIcono({
      saldoCentavos: s.saldoCentavos,
      topeCentavos: s.topeCentavos,
      anualCentavos: anualDe.get(s.id) ?? null,
      fijoMensualCentavos: fijoDe.get(s.id) ?? null,
      debidoCentavos: s.tipo === "deudas" ? debidoCentavos : null,
    }),
  }));
}
