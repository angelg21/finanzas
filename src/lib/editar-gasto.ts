/**
 * Editar un gasto (spec 006, criterios 1 a 3): se vuelve a preparar con las mismas reglas de la captura y se decide
 * qué pasa con su venta de USDT enlazada. El gasto conserva su fila; la venta se actualiza si sigue habiendo venta,
 * se crea si antes no la había y se borra si la forma de pago nueva ya no vende. Así el resultado es el mismo que
 * si el gasto viejo no hubiera existido y se registrara el nuevo, y el cuadre se mantiene como en la captura.
 */
import { type EntradaGasto, type ErroresGasto, type FilaMovimiento, prepararGasto } from "./gastos";

/** Lo guardado de la captura: la fila del gasto y, si se pagó vendiendo USDT, la de su venta. */
export type GastoGuardado = { gastoId: number; ventaId: number | null };

export type CambioDeVenta =
  | { accion: "actualizar"; id: number; fila: FilaMovimiento }
  | { accion: "crear"; fila: FilaMovimiento }
  | { accion: "borrar"; id: number };

export type PlanDeGasto =
  | { ok: true; gasto: { id: number; fila: FilaMovimiento }; venta: CambioDeVenta | null }
  | { ok: false; errores: ErroresGasto };

export function planDeEdicionDeGasto(guardado: GastoGuardado, nueva: EntradaGasto, hoy: string): PlanDeGasto {
  const preparado = prepararGasto(nueva, hoy);
  if (!preparado.ok) return preparado;
  const gasto = preparado.filas.find((f) => f.tipo === "gasto");
  const venta = preparado.filas.find((f) => f.tipo === "transferencia") ?? null;
  // prepararGasto siempre trae el gasto; esta guarda solo le enseña el tipo a TypeScript.
  if (!gasto) throw new Error("prepararGasto no trajo el gasto");

  let cambio: CambioDeVenta | null = null;
  if (venta && guardado.ventaId !== null) cambio = { accion: "actualizar", id: guardado.ventaId, fila: venta };
  else if (venta) cambio = { accion: "crear", fila: venta };
  else if (guardado.ventaId !== null) cambio = { accion: "borrar", id: guardado.ventaId };
  return { ok: true, gasto: { id: guardado.gastoId, fila: gasto }, venta: cambio };
}
