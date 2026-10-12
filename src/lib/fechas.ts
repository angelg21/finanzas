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

/**
 * Lo que manda el selector de fecha: "hoy", "ayer" o una fecha concreta. Los atajos se resuelven con el `hoy`
 * del momento de guardar: una pantalla abierta antes de la medianoche, o "Registrar otro" a la mañana
 * siguiente, no guarda la fecha de ayer con "Hoy" marcado.
 */
export function fechaDesdeAtajo(texto: string, hoy: string): string {
  if (texto === "hoy") return hoy;
  if (texto === "ayer") return diaAnterior(hoy);
  return texto;
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

/*
  Calendario propio del formulario de gasto. Nombres escritos a mano en vez de Intl, para que la
  etiqueta sea la misma en cualquier navegador y no dependa de su versión de ICU.
*/

const meses = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];
const dias = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

const mayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

function partes(fecha: string) {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return { anio, mes, dia, semana: new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay() };
}

/** 10 → "Octubre". */
export function nombreMes(mes: number): string {
  return mayuscula(meses[mes - 1] ?? "");
}

/** "2026-10-09" → "Vie 9 oct", para la píldora de la fecha elegida. */
export function etiquetaFecha(fecha: string): string {
  const { mes, dia, semana } = partes(fecha);
  return `${mayuscula(dias[semana].slice(0, 3))} ${dia} ${meses[mes - 1].slice(0, 3)}`;
}

/** "2026-10-09" → "viernes 9 de octubre de 2026", para el lector de pantalla. */
export function fechaLarga(fecha: string): string {
  const { anio, mes, dia, semana } = partes(fecha);
  return `${dias[semana]} ${dia} de ${meses[mes - 1]} de ${anio}`;
}

export type Mes = { anio: number; mes: number };

/** "2026-10-09" → { anio: 2026, mes: 10 }. */
export function mesDe(fecha: string): Mes {
  const { anio, mes } = partes(fecha);
  return { anio, mes };
}

/** Suma o resta meses cruzando el año: { 2026, 1 } − 1 → { 2025, 12 }. */
export function moverMes({ anio, mes }: Mes, delta: number): Mes {
  const total = anio * 12 + (mes - 1) + delta;
  return { anio: Math.floor(total / 12), mes: (total % 12) + 1 };
}

/**
 * Cuadrícula del mes de lunes a domingo: null en los huecos antes del 1 y después del último día,
 * hasta completar semanas enteras; "AAAA-MM-DD" en cada día.
 */
export function celdasDelMes(anio: number, mes: number): (string | null)[] {
  const primero = new Date(Date.UTC(anio, mes - 1, 1)).getUTCDay();
  const huecos = (primero + 6) % 7;
  const total = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const celdas: (string | null)[] = Array(huecos).fill(null);
  for (let dia = 1; dia <= total; dia++) {
    celdas.push(`${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`);
  }
  while (celdas.length % 7 !== 0) celdas.push(null);
  return celdas;
}
