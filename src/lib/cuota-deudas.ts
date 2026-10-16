/**
 * La cuota del sobre Deudas (spec 005, criterios 11 y 12): cuánto debe recibir este mes para tener cada deuda lista
 * al empezar el mes de su fecha. Se calcula al repartir y nunca se guarda: guardada, quedaría vieja al cambiar el mes
 * o al pagar. Entra en el reparto como una regla fija más, antes que todas las demás.
 */
import { formatearCifraCorta, repartirHaciaArriba } from "./dinero";
import type { SentidoDeuda } from "./deudas";
import { type Mes, diaYMes, esFecha, mesDe } from "./fechas";
import type { ReglaParaRepartir } from "./reparto";

export type DeudaParaCuota = { sentido: SentidoDeuda; pendienteCentavos: number; fechaPrevista: string | null };

export type EntradaCuota = {
  deudas: DeudaParaCuota[];
  /** El saldo de Deudas al empezar el mes: el de hoy menos lo recibido desde "Por asignar" en el mes. */
  apartado: number;
  /** "AAAA-MM-DD", el día de Caracas. */
  hoy: string;
};

function indiceDeMes({ anio, mes }: Mes) {
  return anio * 12 + (mes - 1);
}

function exigirFecha(texto: string, que: string) {
  if (!esFecha(texto)) throw new RangeError(`${que} no es una fecha: ${texto}`);
}

/**
 * Para cada mes M con vencimientos: lo que vence hasta M, menos lo apartado, entre los meses que quedan hasta M (al
 * menos uno), hacia arriba al dólar y sin pasar de lo que falta. La cuota es la mayor de esas necesidades. Las deudas
 * sin fecha no piden cuota: se apartan a mano.
 */
export function cuotaDeDeudas({ deudas, apartado, hoy }: EntradaCuota): number {
  exigirFecha(hoy, "Hoy");
  if (!Number.isSafeInteger(apartado)) throw new RangeError(`Lo apartado debe ser un entero: ${apartado}`);
  const esteMes = indiceDeMes(mesDe(hoy));

  const vencePorMes = new Map<number, number>();
  for (const d of deudas) {
    if (!Number.isSafeInteger(d.pendienteCentavos) || d.pendienteCentavos < 0)
      throw new RangeError(`Pendiente inválido: ${d.pendienteCentavos}`);
    if (d.fechaPrevista !== null) exigirFecha(d.fechaPrevista, "La fecha prevista");
    if (d.sentido !== "debo" || d.pendienteCentavos === 0 || d.fechaPrevista === null) continue;
    const mes = indiceDeMes(mesDe(d.fechaPrevista));
    vencePorMes.set(mes, (vencePorMes.get(mes) ?? 0) + d.pendienteCentavos);
  }

  let cuota = 0;
  let acumulado = 0;
  for (const mes of [...vencePorMes.keys()].sort((a, b) => a - b)) {
    acumulado += vencePorMes.get(mes) ?? 0;
    const falta = acumulado - apartado;
    if (falta <= 0) continue;
    const meses = Math.max(1, mes - esteMes);
    cuota = Math.max(cuota, Math.min(falta, repartirHaciaArriba(falta, meses, 100)));
  }
  return cuota;
}

/**
 * La cuota como regla fija para proponerReparto, con un orden menor que el de todas las demás: va antes que todas
 * las fijas, por la regla de uso del plan. Con cuota 0 no hay regla, y Deudas no sale en el reparto.
 */
export function reglaDeDeudas(
  sobreDeudasId: number,
  cuotaCentavos: number,
  reglas: ReglaParaRepartir[],
): ReglaParaRepartir | null {
  if (cuotaCentavos <= 0) return null;
  const orden = Math.min(1, ...reglas.map((r) => r.orden)) - 1;
  return { sobreId: sobreDeudasId, orden, tipo: "fijo", valor: cuotaCentavos, topeCentavos: null };
}

/** La fecha más cercana entre las deudas abiertas que debo, aunque ya haya pasado; null si ninguna tiene fecha. */
export function proximoVencimiento(deudas: DeudaParaCuota[]): string | null {
  const fechas = deudas
    .flatMap((d) => (d.sentido === "debo" && d.pendienteCentavos > 0 && d.fechaPrevista ? [d.fechaPrevista] : []))
    .sort();
  return fechas[0] ?? null;
}

/**
 * Lo que dice la fila de Deudas en el reparto: "cuota · faltan 385 este mes · vence 22 oct". Lo que falta es la cuota
 * menos lo recibido en el mes, como los fijos; la fecha es la del vencimiento más cercano.
 */
export function pistaDeCuota(
  cuotaCentavos: number,
  recibidoEnElMes: number,
  vencimiento: string | null,
  hoy: string,
): string {
  const falta = Math.max(0, cuotaCentavos - recibidoEnElMes);
  const partes = [falta > 0 ? `cuota · faltan ${formatearCifraCorta(falta)} este mes` : "cuota · cubierta este mes"];
  if (vencimiento !== null) partes.push(`${vencimiento < hoy ? "venció" : "vence"} ${diaYMes(vencimiento)}`);
  return partes.join(" · ");
}
