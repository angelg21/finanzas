import type { ErroresPrestamo } from "@/lib/prestamos";

/** Lo tecleado al prestar, para volver a llenar el formulario si hay que corregir. */
export type ValoresPrestamo = {
  /** El UUID de esta captura (src/lib/captura.ts): el mismo en cada reintento, para no prestar dos veces. */
  idCaptura: string;
  persona: string;
  monto: string;
  cuentaId: string;
  sobreOrigenId: string;
  /** "hoy", "ayer" o el día del préstamo. */
  fecha: string;
  /** "" si no tiene: cuándo se espera cobrarlo. */
  fechaPrevista: string;
  nota: string;
};

export type ErroresFormularioPrestamo = ErroresPrestamo & { general?: string };

export type EstadoPrestamo = { ronda: number } & (
  { estado: "inicial" } | { estado: "error"; errores: ErroresFormularioPrestamo; valores: ValoresPrestamo }
);

function texto(datos: FormData, nombre: string) {
  const valor = datos.get(nombre);
  return typeof valor === "string" ? valor : "";
}

export function tecleadoDe(datos: FormData): ValoresPrestamo {
  return {
    idCaptura: texto(datos, "idCaptura"),
    persona: texto(datos, "persona"),
    monto: texto(datos, "monto"),
    cuentaId: texto(datos, "cuentaId"),
    sobreOrigenId: texto(datos, "sobreOrigenId"),
    fecha: texto(datos, "fecha"),
    fechaPrevista: texto(datos, "fechaPrevista"),
    nota: texto(datos, "nota"),
  };
}
