import type { ErroresPago } from "@/lib/deudas";

/** Lo tecleado al pagar una deuda, para volver a llenar el formulario si hay que corregir. */
export type ValoresPago = {
  deudaId: string;
  /** El UUID de esta captura (src/lib/captura.ts): el mismo en cada reintento, para no pagar dos veces. */
  idCaptura: string;
  monto: string;
  cuentaId: string;
  /** El sobre del que sale el pago (spec 014); el cobro no lo usa: entra a Por asignar. */
  sobreId: string;
  /** Vacío si el pago no cuenta como gasto; si cuenta, su categoría de gasto (spec 014). */
  categoriaId: string;
  /** "hoy", "ayer" o el día elegido, como en la captura de gasto. */
  fecha: string;
  nota: string;
};

export type ErroresFormularioPago = ErroresPago & { general?: string };

export type EstadoPago = { ronda: number } & (
  { estado: "inicial" } | { estado: "error"; errores: ErroresFormularioPago; valores: ValoresPago }
);

function texto(datos: FormData, nombre: string) {
  const valor = datos.get(nombre);
  return typeof valor === "string" ? valor : "";
}

export function tecleadoDe(datos: FormData): ValoresPago {
  return {
    deudaId: texto(datos, "deudaId"),
    idCaptura: texto(datos, "idCaptura"),
    monto: texto(datos, "monto"),
    cuentaId: texto(datos, "cuentaId"),
    sobreId: texto(datos, "sobreId"),
    categoriaId: texto(datos, "categoriaId"),
    fecha: texto(datos, "fecha"),
    nota: texto(datos, "nota"),
  };
}
