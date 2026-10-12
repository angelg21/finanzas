/**
 * Fechas de los movimientos: texto "AAAA-MM-DD", como la columna date de la base.
 * "Hoy" es el de Caracas, no el del servidor: desplegado en UTC, un gasto de las
 * 21:00 quedaría con la fecha de mañana.
 */

const formatoCaracas = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Caracas",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** El día que es en Caracas en ese instante: 2026-10-12T01:00Z → "2026-10-11". */
export function hoyEnCaracas(instante: Date): string {
  const partes = Object.fromEntries(formatoCaracas.formatToParts(instante).map((p) => [p.type, p.value]));
  return `${partes.year}-${partes.month}-${partes.day}`;
}

/** "2026-03-01" → "2026-02-28". */
export function diaAnterior(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Una fecha real en formato AAAA-MM-DD que no es posterior a `hoy`. */
export function fechaValida(texto: string, hoy: string): boolean {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!partes) return false;
  const [anio, mes, dia] = partes.slice(1).map(Number);
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  const existe = d.getUTCFullYear() === anio && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
  // Mismo formato de ancho fijo: comparar como texto es comparar como fecha.
  return existe && texto <= hoy;
}
