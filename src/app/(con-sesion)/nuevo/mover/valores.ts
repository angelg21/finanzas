import type { ErroresMover } from "@/lib/mover";

/** Lo tecleado al mover entre sobres, para volver a llenar el formulario si hay que corregir o confirmar. */
export type ValoresMover = {
  /** El UUID de esta captura (src/lib/captura.ts): el mismo en cada reintento, para no mover dos veces. */
  idCaptura: string;
  origenId: string;
  destinoId: string;
  monto: string;
  nota: string;
};

export type ErroresFormularioMover = ErroresMover & { general?: string };

export type EstadoMover = { ronda: number } & (
  | { estado: "inicial" }
  | { estado: "error"; errores: ErroresFormularioMover; valores: ValoresMover }
  /** Desde Inversión: hace falta un segundo clic (spec 007, criterio 8). */
  | { estado: "confirmar"; valores: ValoresMover }
);

function texto(datos: FormData, nombre: string) {
  const valor = datos.get(nombre);
  return typeof valor === "string" ? valor : "";
}

export function tecleadoDe(datos: FormData): ValoresMover {
  return {
    idCaptura: texto(datos, "idCaptura"),
    origenId: texto(datos, "origenId"),
    destinoId: texto(datos, "destinoId"),
    monto: texto(datos, "monto"),
    nota: texto(datos, "nota"),
  };
}
