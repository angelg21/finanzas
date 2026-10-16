import type { ErroresDeuda, SentidoDeuda } from "@/lib/deudas";

/** Lo tecleado al registrar o editar una deuda, para volver a llenar el formulario si hay que corregir. */
export type ValoresDeuda = {
  /** Vacío al registrar; el id de la deuda al editar. */
  id: string;
  /** El UUID de esta captura (src/lib/captura.ts): el mismo en cada reintento, para no registrar dos veces. */
  idCaptura: string;
  sentido: SentidoDeuda;
  persona: string;
  monto: string;
  /** "" si no tiene fecha. */
  fechaPrevista: string;
  /** "" si no tiene cuenta prevista. */
  cuentaPrevistaId: string;
  nota: string;
};

export type ErroresFormularioDeuda = ErroresDeuda & { general?: string };

export type EstadoDeuda = { ronda: number } & (
  { estado: "inicial" } | { estado: "error"; errores: ErroresFormularioDeuda; valores: ValoresDeuda }
);

function texto(datos: FormData, nombre: string) {
  const valor = datos.get(nombre);
  return typeof valor === "string" ? valor : "";
}

export function tecleadoDe(datos: FormData): ValoresDeuda {
  return {
    id: texto(datos, "id"),
    idCaptura: texto(datos, "idCaptura"),
    sentido: texto(datos, "sentido") === "me_deben" ? "me_deben" : "debo",
    persona: texto(datos, "persona"),
    monto: texto(datos, "monto"),
    fechaPrevista: texto(datos, "fechaPrevista"),
    cuentaPrevistaId: texto(datos, "cuentaPrevistaId"),
    nota: texto(datos, "nota"),
  };
}
