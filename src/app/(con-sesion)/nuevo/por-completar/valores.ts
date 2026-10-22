import type { ErroresPorCompletar } from "@/lib/por-completar";

/** Lo tecleado al anotar un gasto por completar (spec 009), para volver a llenar el formulario si hay que corregir. */
export type ValoresPorCompletar = {
  /** El UUID de esta captura: el mismo en cada reintento, para no anotar dos veces. */
  idCaptura: string;
  categoriaId: string;
  nota: string;
  /** "hoy", "ayer" o el día elegido. */
  fecha: string;
  monto: string;
  /** "VES" o "USD"; solo cuenta si hay monto. */
  moneda: string;
};

export type ErroresFormularioPorCompletar = ErroresPorCompletar & { general?: string };

export type EstadoPorCompletar = { ronda: number } & (
  | { estado: "inicial" }
  | { estado: "error"; errores: ErroresFormularioPorCompletar; valores: ValoresPorCompletar }
  /** Anotado: el formulario vuelve vacío, con una captura nueva, para el siguiente. */
  | { estado: "anotado"; cantidad: number; siguienteCaptura: string }
);

export function tecleadoDe(datos: FormData): ValoresPorCompletar {
  const leer = (nombre: string) => {
    const valor = datos.get(nombre);
    return typeof valor === "string" ? valor : "";
  };
  return {
    idCaptura: leer("idCaptura"),
    categoriaId: leer("categoriaId"),
    nota: leer("nota"),
    fecha: leer("fecha"),
    monto: leer("monto"),
    moneda: leer("moneda"),
  };
}
