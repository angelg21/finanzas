import type { ErroresReglas } from "@/lib/reglas";

/** Lo elegido en cada sobre editable, por id: "fijo", "porcentaje" o "ninguna", y el valor tal como se escribió. */
export type ValoresReglas = { reglas: Record<string, { tipo: string; valor: string }>; tope: string };

export type ErroresFormularioReglas = ErroresReglas & { tope?: string; general?: string };

export type ResultadoReglas =
  | { estado: "error"; errores: ErroresFormularioReglas; valores: ValoresReglas }
  /** `sinPorcentajes`: lo que quede tras los fijos se quedará en "Por asignar". */
  | { estado: "guardado"; valores: ValoresReglas; sinPorcentajes: boolean };

export type EstadoReglas = { ronda: number } & ({ estado: "inicial" } | ResultadoReglas);

export const campoTipo = (sobreId: number | string) => `tipo-${sobreId}`;
export const campoValor = (sobreId: number | string) => `valor-${sobreId}`;

const campoDeTipo = /^tipo-(\d{1,9})$/;

/** Lo que se envió: el tipo y el valor de cada sobre que trae un campo de tipo, y el tope. */
export function tecleadoDe(datos: FormData): ValoresReglas {
  const leer = (nombre: string) => {
    const valor = datos.get(nombre);
    return typeof valor === "string" ? valor : "";
  };
  const reglas: ValoresReglas["reglas"] = {};
  for (const clave of datos.keys()) {
    const sobre = campoDeTipo.exec(clave)?.[1];
    if (sobre !== undefined) reglas[sobre] = { tipo: leer(campoTipo(sobre)), valor: leer(campoValor(sobre)) };
  }
  return { reglas, tope: leer("tope") };
}
