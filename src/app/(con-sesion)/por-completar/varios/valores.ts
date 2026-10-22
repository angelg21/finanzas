import type { ErroresVarios } from "@/lib/por-completar";

/** Lo tecleado al completar varios (spec 009, criterios 8 a 10), para volver a llenar el formulario. */
export type ValoresVarios = {
  /** El UUID de esta captura: el mismo en cada reintento, para no registrar dos veces. */
  idCaptura: string;
  forma: string;
  cuentaId: string;
  cuentaVentaId: string;
  tasa: string;
  vendido: string;
  /** Los pendientes marcados, por id. */
  elegidos: string[];
  /** Por id de pendiente, su monto y su sobre. */
  montos: Record<string, string>;
  sobres: Record<string, string>;
  /** Qué hacer con lo que sobre de la venta: "", "bolivares" o "gasto". */
  resto: string;
  restoCategoriaId: string;
  restoSobreId: string;
};

export type EstadoVarios = { ronda: number } & (
  | { estado: "inicial" }
  | { estado: "error"; errores: ErroresVarios; valores: ValoresVarios }
  /** Sobran bolívares de la venta: la pantalla pregunta qué hacer con ellos. */
  | { estado: "resto"; restoBs: number; valores: ValoresVarios }
);

export function tecleadoDe(datos: FormData): ValoresVarios {
  const leer = (nombre: string) => {
    const valor = datos.get(nombre);
    return typeof valor === "string" ? valor : "";
  };
  const montos: Record<string, string> = {};
  const sobres: Record<string, string> = {};
  for (const [clave, valor] of datos.entries()) {
    if (typeof valor !== "string") continue;
    const monto = /^monto-(\d{1,10})$/.exec(clave);
    if (monto) montos[monto[1]] = valor;
    const sobre = /^sobre-(\d{1,10})$/.exec(clave);
    if (sobre) sobres[sobre[1]] = valor;
  }
  return {
    idCaptura: leer("idCaptura"),
    forma: leer("forma"),
    cuentaId: leer("cuentaId"),
    cuentaVentaId: leer("cuentaVentaId"),
    tasa: leer("tasa"),
    vendido: leer("vendido"),
    elegidos: datos.getAll("pendiente").filter((v): v is string => typeof v === "string"),
    montos,
    sobres,
    resto: leer("resto"),
    restoCategoriaId: leer("restoCategoriaId"),
    restoSobreId: leer("restoSobreId"),
  };
}
