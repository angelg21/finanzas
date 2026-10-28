import type { ErroresTransferencia } from "@/lib/transferencias";

/** Lo tecleado al transferir entre cuentas, para volver a llenar el formulario si hay que corregir. */
export type ValoresTransferir = {
  /** El UUID de esta captura (src/lib/captura.ts): el mismo en cada reintento, para no transferir dos veces. */
  idCaptura: string;
  origenId: string;
  destinoId: string;
  salio: string;
  llego: string;
  sobreId: string;
  fecha: string;
  nota: string;
};

export type ErroresFormularioTransferir = ErroresTransferencia & { general?: string };

export type EstadoTransferir = { ronda: number } & (
  { estado: "inicial" } | { estado: "error"; errores: ErroresFormularioTransferir; valores: ValoresTransferir }
);

function texto(datos: FormData, nombre: string) {
  const valor = datos.get(nombre);
  return typeof valor === "string" ? valor : "";
}

export function tecleadoDe(datos: FormData): ValoresTransferir {
  return {
    idCaptura: texto(datos, "idCaptura"),
    origenId: texto(datos, "origenId"),
    destinoId: texto(datos, "destinoId"),
    salio: texto(datos, "salio"),
    llego: texto(datos, "llego"),
    sobreId: texto(datos, "sobreId"),
    fecha: texto(datos, "fecha"),
    nota: texto(datos, "nota"),
  };
}
