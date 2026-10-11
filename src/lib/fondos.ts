/** Aritmética de los fondos de reserva. Pura, sin base de datos, para poder probarla. */

export function totalAnualCentavos(partidas: { montoCentavos: number; vecesPorAnio: number }[]) {
  return partidas.reduce((acc, p) => acc + p.montoCentavos * p.vecesPorAnio, 0);
}

/** Total anual entre doce, redondeado hacia arriba al dólar entero. */
export function aporteMensualCentavos(totalAnual: number) {
  return Math.ceil(totalAnual / 12 / 100) * 100;
}
