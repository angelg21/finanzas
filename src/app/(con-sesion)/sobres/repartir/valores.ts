import { type ErroresReparto, asignacionesDelFormulario } from "@/lib/ingresos";

/** Lo que se tecleó, para volver a llenar el reparto si hay que corregir o confirmar. */
export type ValoresRepartir = {
  /** El UUID de este reparto: el mismo en cada reintento, para no repartir dos veces. */
  idCaptura: string;
  /** Por id de sobre, lo escrito en su campo. */
  asignaciones: Record<string, string>;
};

export type ErroresRepartir = ErroresReparto & { general?: string };

export type ResultadoRepartir =
  /** `saldoCentavos`: el saldo de "Por asignar" si cambió desde que se abrió la pantalla. */
  | { estado: "error"; errores: ErroresRepartir; valores: ValoresRepartir; saldoCentavos?: number }
  /** Queda algo en "Por asignar": hace falta un segundo clic. */
  | { estado: "confirmar"; valores: ValoresRepartir; sinAsignarCentavos: number }
  | { estado: "guardado"; repartido: { nombre: string; centavos: number }[]; quedanCentavos: number };

/** `ronda` cuenta las respuestas: como `key`, los campos se montan de nuevo con lo tecleado, también sin JavaScript. */
export type EstadoRepartir = { ronda: number } & ({ estado: "inicial" } | ResultadoRepartir);

/** Lo que se envió; lo que falta, vacío. */
export function tecleadoDe(datos: FormData): ValoresRepartir {
  const id = datos.get("idCaptura");
  return { idCaptura: typeof id === "string" ? id : "", asignaciones: asignacionesDelFormulario(datos) };
}
