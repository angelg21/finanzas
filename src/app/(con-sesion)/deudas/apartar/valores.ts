import type { ErroresApartado } from "@/lib/apartado";

/** Lo tecleado al apartar para deudas, para volver a llenar el formulario si hay que corregir. */
export type ValoresApartado = {
  /** El UUID de esta captura (src/lib/captura.ts): el mismo en cada reintento, para no apartar dos veces. */
  idCaptura: string;
  sobreOrigenId: string;
  monto: string;
};

export type ErroresFormularioApartado = ErroresApartado & { general?: string };

export type EstadoApartado = { ronda: number } & (
  { estado: "inicial" } | { estado: "error"; errores: ErroresFormularioApartado; valores: ValoresApartado }
);

function texto(datos: FormData, nombre: string) {
  const valor = datos.get(nombre);
  return typeof valor === "string" ? valor : "";
}

export function tecleadoDe(datos: FormData): ValoresApartado {
  return {
    idCaptura: texto(datos, "idCaptura"),
    sobreOrigenId: texto(datos, "sobreOrigenId"),
    monto: texto(datos, "monto"),
  };
}
