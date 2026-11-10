import type { ErroresFormularioGasto, ValoresGasto } from "../../nuevo/gasto/acciones";

/** Editar un gasto (spec 006): como la captura, sin "guardado", que lleva de vuelta a la lista. */
export type EstadoEdicionGasto = { ronda: number } & (
  | { estado: "inicial" }
  | { estado: "error"; errores: ErroresFormularioGasto; valores: ValoresGasto }
  /** Sobre Inversión: hace falta un segundo clic, como en la captura. */
  | { estado: "confirmar"; valores: ValoresGasto }
);

/** Lo tecleado al editar un ingreso, para volver a llenar el formulario. */
export type ValoresIngresoEditado = {
  monto: string;
  cuentaId: string;
  categoriaId: string;
  fecha: string;
  nota: string;
  /** La etiqueta elegida, o lo escrito para crearla (spec 008). */
  etiquetaId: string;
  etiquetaNueva: string;
};

export type ErroresIngresoEditado = Partial<
  Record<"monto" | "cuenta" | "categoria" | "etiqueta" | "fecha" | "general", string>
>;

export type EstadoEdicionIngreso = { ronda: number } & (
  { estado: "inicial" } | { estado: "error"; errores: ErroresIngresoEditado; valores: ValoresIngresoEditado }
);

export type EstadoBorrar = { error?: string };

/** A dónde volver tras guardar o borrar: el inicio o Movimientos con sus filtros. Cualquier otra cosa, Movimientos. */
export function destinoDeVuelta(texto: string): string {
  return texto === "/" || /^\/movimientos(\?[\w=&%.-]*)?$/.test(texto) || /^\/deudas\/\d{1,10}$/.test(texto)
    ? texto
    : "/movimientos";
}

/** El destino con el aviso de lo hecho: "?editado=gasto", "?editado=ingreso" o "?borrado=1". */
export function conAviso(destino: string, aviso: string): string {
  return `${destino}${destino.includes("?") ? "&" : "?"}${aviso}`;
}

/** El aviso al volver de editar o borrar (spec 006, criterio 11), o null. */
export function avisoDeVuelta(params: Record<string, string | string[] | undefined>): string | null {
  if (params.editado === "gasto") return "Gasto actualizado";
  if (params.editado === "ingreso") return "Ingreso actualizado";
  if (params.borrado === "1") return "Borrado";
  if (params.borrado === "ya") return "Ya estaba borrado";
  if (params.borrado === "deshecho") return "Deshecho";
  return null;
}

/**
 * La dirección de un gasto o un ingreso para editarlo, o de un pago, un cobro o una transferencia entre cuentas para
 * deshacerlo (specs 007 y 011), con a dónde volver. La venta de USDT de un gasto, las reasignaciones y los préstamos
 * no abren nada (spec 006, criterio 8), ni lo importado de la app vieja, que es historial (spec 012).
 */
export function enlaceDeEdicion(
  m: { id: number; tipo: string; entreCuentas?: boolean; historial?: boolean },
  volver: string,
): string | undefined {
  if (m.historial) return undefined;
  const seAbre = ["gasto", "ingreso", "pago_deuda", "cobro_prestamo"].includes(m.tipo);
  if (!seAbre && !(m.tipo === "transferencia" && m.entreCuentas === true)) return undefined;
  return `/movimientos/${m.id}?volver=${encodeURIComponent(volver)}`;
}
