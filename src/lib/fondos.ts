/** Aritmética de los fondos de reserva. Pura, sin base de datos, para poder probarla. */
import { repartirHaciaArriba } from "./dinero";

export function totalAnualCentavos(partidas: { montoCentavos: number; vecesPorAnio: number }[]) {
  return partidas.reduce((acc, p) => acc + p.montoCentavos * p.vecesPorAnio, 0);
}

/** Total anual entre doce, redondeado hacia arriba al dólar entero. */
export function aporteMensualCentavos(totalAnual: number) {
  return repartirHaciaArriba(totalAnual, 12, 100);
}

/** El valor de una regla de reparto es una columna integer de Postgres. */
export const TOPE_REGLA_CENTAVOS = 2_147_483_647;

/** Si un aporte mensual cabe en la regla: un entero de al menos un centavo y no más que el tope. */
export function cabeEnRegla(centavos: number): boolean {
  return Number.isInteger(centavos) && centavos >= 1 && centavos <= TOPE_REGLA_CENTAVOS;
}
