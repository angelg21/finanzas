import type { Moneda } from "@/lib/dinero";
import { type ErroresIngreso, asignacionesDelFormulario } from "@/lib/ingresos";

/** Lo que se tecleó, para volver a llenar el formulario si hay que corregir, proponer o confirmar. */
export type ValoresIngreso = {
  monto: string;
  cuentaId: string;
  categoriaId: string;
  fecha: string;
  nota: string;
  /** El UUID de esta captura (src/lib/captura.ts): el mismo en cada reintento, para no duplicar el ingreso. */
  idCaptura: string;
  /** La etiqueta elegida, o lo escrito para crearla (spec 008). */
  etiquetaId: string;
  etiquetaNueva: string;
  /**
   * El monto y la fecha para los que se mostró la propuesta. Si no coinciden con los enviados, el envío propone en
   * vez de guardar: sin JavaScript, el primer envío llena los campos del reparto y el segundo guarda (criterio 13).
   */
  propuestaDe: string;
  /** Por id de sobre, lo escrito en su campo del reparto. */
  asignaciones: Record<string, string>;
};

export type ErroresFormularioIngreso = ErroresIngreso & { categoria?: string; etiqueta?: string; general?: string };

/** Lo registrado, para el estado de éxito. */
export type ResumenIngreso = {
  montoCentavos: number;
  moneda: Moneda;
  cuenta: string;
  categoria: string;
  repartido: { nombre: string; centavos: number }[];
  sinAsignarCentavos: number;
};

export type ResultadoIngreso =
  | { estado: "error"; errores: ErroresFormularioIngreso; valores: ValoresIngreso }
  /** Sin JavaScript: los campos del reparto ya llevan la propuesta; el próximo envío guarda. */
  | { estado: "proponer"; valores: ValoresIngreso }
  /** Queda algo en "Por asignar": hace falta un segundo clic (criterio 8). */
  | { estado: "confirmar"; valores: ValoresIngreso; sinAsignarCentavos: number }
  | { estado: "guardado"; resumen: ResumenIngreso; cuentaId: string; siguienteCaptura: string };

/** `ronda` cuenta las respuestas: como `key`, los campos se montan de nuevo con lo tecleado, también sin JavaScript. */
export type EstadoIngreso = { ronda: number } & ({ estado: "inicial" } | ResultadoIngreso);

/** La propuesta depende del monto y del mes de la fecha. */
export function claveDePropuesta(monto: string, fecha: string): string {
  return `${monto.trim()}|${fecha}`;
}

/** Lo que se envió, campo por campo; lo que falta, vacío. Los campos del reparto, por id de sobre. */
export function tecleadoDe(datos: FormData): ValoresIngreso {
  const leer = (nombre: string) => {
    const valor = datos.get(nombre);
    return typeof valor === "string" ? valor : "";
  };
  return {
    monto: leer("monto"),
    cuentaId: leer("cuentaId"),
    categoriaId: leer("categoriaId"),
    fecha: leer("fecha"),
    nota: leer("nota"),
    idCaptura: leer("idCaptura"),
    etiquetaId: leer("etiquetaId"),
    etiquetaNueva: leer("etiquetaNueva"),
    propuestaDe: leer("propuestaDe"),
    asignaciones: asignacionesDelFormulario(datos),
  };
}
