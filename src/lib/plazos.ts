/**
 * Cuándo vence una deuda, como se lee en /deudas (spec 005, pantallas): en días si está cerca o ya pasó, y la fecha si
 * falta más de una semana. "hoy" es el día de Caracas.
 */
import { diaYMes, diasEntre } from "./fechas";

/** Hasta aquí se cuenta en días: "vence en 7 días"; desde el octavo, la fecha. */
const diasDeCerca = 7;

export function plazoDeDeuda(fechaPrevista: string | null, hoy: string): string {
  if (fechaPrevista === null) return "sin fecha";
  const dias = diasEntre(hoy, fechaPrevista);
  if (dias < -1) return `vencida hace ${-dias} días`;
  if (dias === -1) return "vencida ayer";
  if (dias === 0) return "vence hoy";
  if (dias === 1) return "vence mañana";
  if (dias <= diasDeCerca) return `vence en ${dias} días`;
  const otroAnio = fechaPrevista.slice(0, 4) !== hoy.slice(0, 4);
  return `para el ${diaYMes(fechaPrevista)}${otroAnio ? ` ${fechaPrevista.slice(0, 4)}` : ""}`;
}
