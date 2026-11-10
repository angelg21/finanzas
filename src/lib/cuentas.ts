import { type ColorCategoria, claveDeNombre, coloresCategoria, iconosCategoria } from "./categorias";

/**
 * Las reglas de una cuenta, sin React ni base: su aspecto (círculo de color con icono, como las categorías), cómo se
 * valida al crearla o editarla y qué pasa al eliminarla (spec 013). Una cuenta que nunca se editó no tiene icono ni
 * color guardados: su aspecto sale de su tipo y su moneda, así que una del mismo tipo se ve igual.
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

/** El aspecto automático traducido al catálogo de iconos y colores: lo que el formulario ofrece elegido al editar. */
const enCatalogo: Record<AspectoCuenta, { icono: string; color: ColorCategoria }> = {
  cripto: { icono: "bitcoin", color: "ambar" },
  billetera: { icono: "billetera", color: "turquesa" },
  efectivo: { icono: "billete", color: "verde" },
  exterior: { icono: "banco", color: "azul" },
  bolivares: { icono: "billete", color: "coral" },
  banco: { icono: "banco", color: "indigo" },
};

/** Criterio 6: el icono y el color elegidos, o el equivalente de su aspecto automático si nunca se eligieron. */
export function aspectoParaElegir(cuenta: {
  tipo: string;
  moneda: string;
  icono: string | null;
  color: string | null;
}) {
  if (cuenta.icono && cuenta.color) return { icono: cuenta.icono, color: cuenta.color };
  return enCatalogo[aspectoDeCuenta(cuenta)];
}

export const monedasDeCuenta = ["USD", "USDT", "USDC", "VES"] as const;
export type MonedaCuenta = (typeof monedasDeCuenta)[number];

export const tiposDeCuenta = ["exchange", "billetera", "efectivo", "banco", "transito"] as const;
export type TipoCuenta = (typeof tiposDeCuenta)[number];

export const nombreDeTipo: Record<TipoCuenta, string> = {
  exchange: "Exchange",
  billetera: "Billetera",
  efectivo: "Efectivo",
  banco: "Banco",
  transito: "USD en EE. UU.",
};

const LARGO_MAXIMO = 40;

export type EntradaCuenta = {
  nombre: string;
  moneda: string;
  tipo: string;
  icono: string;
  color: string;
  /** Al editar: la cuenta como está guardada y cuántos movimientos y deudas la usan. */
  edicion?: { id: number; moneda: string; usos: number };
};

export type ErroresCuenta = Partial<Record<"nombre" | "moneda" | "tipo" | "icono" | "color", string>>;

export type ValoresCuenta = { nombre: string; moneda: MonedaCuenta; tipo: TipoCuenta; icono: string; color: string };

export type CuentaValidada = { ok: true; valores: ValoresCuenta } | { ok: false; errores: ErroresCuenta };

const esMoneda = (m: string): m is MonedaCuenta => (monedasDeCuenta as readonly string[]).includes(m);
const esTipo = (t: string): t is TipoCuenta => (tiposDeCuenta as readonly string[]).includes(t);

/**
 * Criterios 3 a 5: nombre limpio y único entre todas las cuentas (también las archivadas: el índice único de la base no
 * distingue), moneda, tipo, icono y color del catálogo, y la moneda fija si la cuenta ya se usa: sus montos están en ella.
 */
export function validarCuenta(
  entrada: EntradaCuenta,
  existentes: { id: number; nombre: string; activa: boolean }[],
): CuentaValidada {
  const errores: ErroresCuenta = {};
  const nombre = entrada.nombre.trim().replace(/\s+/g, " ");

  if (nombre === "") errores.nombre = "Escribe un nombre";
  else if (nombre.length > LARGO_MAXIMO) errores.nombre = `Máximo ${LARGO_MAXIMO} caracteres`;
  else {
    const repetida = existentes.find(
      (c) => c.id !== entrada.edicion?.id && claveDeNombre(c.nombre) === claveDeNombre(nombre),
    );
    if (repetida?.activa) errores.nombre = "Ya existe una cuenta con ese nombre";
    else if (repetida) errores.nombre = "Hay una cuenta archivada con ese nombre: restáurala desde Cuentas";
  }

  if (!esMoneda(entrada.moneda)) errores.moneda = "Elige una moneda";
  else if (entrada.edicion && entrada.edicion.usos > 0 && entrada.edicion.moneda !== entrada.moneda) {
    errores.moneda = "Tiene movimientos: la moneda no cambia";
  }
  if (!esTipo(entrada.tipo)) errores.tipo = "Elige un tipo";
  if (!iconosCategoria.some((i) => i.nombre === entrada.icono)) errores.icono = "Elige un icono";
  if (!coloresCategoria.some((c) => c === entrada.color)) errores.color = "Elige un color";

  if (Object.keys(errores).length > 0 || !esMoneda(entrada.moneda) || !esTipo(entrada.tipo)) {
    return { ok: false, errores };
  }
  return {
    ok: true,
    valores: { nombre, moneda: entrada.moneda, tipo: entrada.tipo, icono: entrada.icono, color: entrada.color },
  };
}

/**
 * Criterios 7 a 9 y 12. Con saldo no se elimina: el dinero desaparecería del cuadre. Cuenta también el equivalente en
 * USD, que en bolívares puede no ser 0 con los Bs en 0 (las tasas de entrada y de salida difieren). Si es la cuenta
 * prevista de una deuda pendiente tampoco: su aviso de liquidez se perdería; primero se cambia en la deuda. En 0, sin
 * movimientos ni deudas que la usen se borra; con historial se archiva para que sus movimientos la conserven.
 */
export function destinoAlEliminarCuenta(cuenta: {
  usos: number;
  saldoCentavos: number;
  saldoUsdCentavos: number;
  /** Deudas con algo pendiente que la tienen como cuenta prevista. */
  deudasPendientes?: number;
}): "con-saldo" | "prevista" | "borrar" | "archivar" {
  if (cuenta.saldoCentavos !== 0 || cuenta.saldoUsdCentavos !== 0) return "con-saldo";
  if ((cuenta.deudasPendientes ?? 0) > 0) return "prevista";
  return cuenta.usos > 0 ? "archivar" : "borrar";
}
