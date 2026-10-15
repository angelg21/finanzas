/**
 * El aspecto de una cuenta, para su círculo de color con icono (como el de las categorías): sale de su tipo y su
 * moneda, no de su nombre, así que una cuenta nueva del mismo tipo se ve igual. Los bolívares mandan sobre el tipo.
 * Cuando se puedan administrar las cuentas (observación 3), cada una podrá elegir el suyo.
 */

export type AspectoCuenta = "cripto" | "billetera" | "efectivo" | "exterior" | "bolivares" | "banco";

const porTipo: Record<string, AspectoCuenta> = {
  exchange: "cripto",
  billetera: "billetera",
  efectivo: "efectivo",
  transito: "exterior",
  banco: "banco",
};

export function aspectoDeCuenta({ tipo, moneda }: { tipo: string; moneda: string }): AspectoCuenta {
  if (moneda === "VES") return "bolivares";
  return porTipo[tipo] ?? "banco";
}
