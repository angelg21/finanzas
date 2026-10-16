/**
 * Captura de un gasto: de lo que se tecleó en el formulario a las filas de movimientos.
 * Tres formas de pago (spec 001):
 *   dolares    → un gasto desde una cuenta en dólares, valorado 1 a 1 en USD
 *   vendiendo  → una transferencia de dólares a Bolívares y un gasto en VES, con la misma tasa
 *   saldo      → un gasto en VES desde Bolívares
 * Es pura: recibe las cuentas ya leídas de la base y devuelve filas o un error por campo.
 */
import { claveDeNombre } from "./categorias";
import { type Moneda, aCentavos, aTasa, bolivaresDesdeUsd, tasaDecimal, usdDesdeBolivares } from "./dinero";
import { fechaValida } from "./fechas";

export type FormaPago = "dolares" | "vendiendo" | "saldo";

export type CuentaGasto = { id: number; moneda: Moneda };

/** Lo que llega del formulario, con los montos como texto tal como se teclearon. */
export type EntradaGasto = {
  forma: FormaPago;
  /** En la moneda de la cuenta si se paga en dólares; en bolívares si no. */
  monto: string;
  /** Bolívares por dólar. Solo se lee al pagar en bolívares. */
  tasa: string;
  /** Dólares vendidos. Solo se lee al vender. */
  vendido: string;
  /** La cuenta del gasto en dólares, o de donde salen los dólares vendidos. */
  cuentaOrigen: CuentaGasto;
  cuentaBolivares: CuentaGasto | null;
  sobreId: number;
  categoriaId: number;
  fecha: string;
  nota: string;
};

/** Una fila lista para insertar en movimientos, con la forma que exige el check por tipo. */
export type FilaMovimiento = {
  fecha: string;
  tipo: "gasto" | "transferencia";
  montoCentavos: number;
  moneda: Moneda;
  montoUsdCentavos: number;
  montoDestinoCentavos: number | null;
  monedaDestino: Moneda | null;
  /** Texto con cuatro decimales, como la columna numeric(14,4). */
  tasa: string | null;
  cuentaOrigenId: number;
  cuentaDestinoId: number | null;
  sobreOrigenId: number | null;
  categoriaId: number | null;
  nota: string | null;
  origen: "manual";
};

export type CampoGasto = "monto" | "tasa" | "vendido" | "cuenta" | "fecha";
export type ErroresGasto = Partial<Record<CampoGasto, string>>;
export type GastoPreparado = { ok: true; filas: FilaMovimiento[] } | { ok: false; errores: ErroresGasto };

const mensajes = {
  monto: { vacio: "Escribe el monto", invalido: "Escribe un monto mayor que cero" },
  vendido: { vacio: "Escribe cuánto vendiste", invalido: "Escribe un monto vendido mayor que cero" },
  tasa: { vacio: "Escribe la tasa", invalido: "Escribe la tasa en Bs por dólar, como 241,8" },
};

/** Una tasa menor que 1 Bs/USD es un error de tecleo ("0,4" en vez de "40") e inflaría el valor en USD. */
const tasaMinima = aTasa("1");

/** Lee un monto positivo o una tasa de 1 o más. Si no se puede, anota el error del campo y devuelve 0. */
function leer(campo: keyof typeof mensajes, texto: string, errores: ErroresGasto): number {
  if (texto.trim() === "") {
    errores[campo] = mensajes[campo].vacio;
    return 0;
  }
  try {
    const valor = campo === "tasa" ? aTasa(texto) : aCentavos(texto);
    const minimo = campo === "tasa" ? tasaMinima : 1;
    if (valor >= minimo && Number.isSafeInteger(valor)) return valor;
  } catch {
    // aCentavos y aTasa lanzan con un mensaje técnico; al usuario se le muestra el del campo.
  }
  errores[campo] = mensajes[campo].invalido;
  return 0;
}

export function prepararGasto(e: EntradaGasto, hoy: string): GastoPreparado {
  const errores: ErroresGasto = {};
  const enBolivares = e.forma !== "dolares";

  const monto = leer("monto", e.monto, errores);
  const tasa = enBolivares ? leer("tasa", e.tasa, errores) : 0;
  const vendido = e.forma === "vendiendo" ? leer("vendido", e.vendido, errores) : 0;
  if (e.forma !== "saldo" && e.cuentaOrigen.moneda === "VES") errores.cuenta = "Elige una cuenta en dólares";
  const bolivares = e.cuentaBolivares?.moneda === "VES" ? e.cuentaBolivares : null;
  const sinBolivares = "No hay una cuenta en bolívares activa";
  if (enBolivares && !bolivares) errores.cuenta = sinBolivares;
  if (!fechaValida(e.fecha, hoy)) errores.fecha = "Elige hoy o un día anterior";
  if (Object.keys(errores).length > 0) return { ok: false, errores };

  const nota = e.nota.trim() || null;
  const sinDestino = { montoDestinoCentavos: null, monedaDestino: null, cuentaDestinoId: null };

  if (e.forma === "dolares") {
    const gasto: FilaMovimiento = {
      fecha: e.fecha,
      tipo: "gasto",
      montoCentavos: monto,
      moneda: e.cuentaOrigen.moneda,
      montoUsdCentavos: monto,
      ...sinDestino,
      tasa: null,
      cuentaOrigenId: e.cuentaOrigen.id,
      sobreOrigenId: e.sobreId,
      categoriaId: e.categoriaId,
      nota,
      origen: "manual",
    };
    return { ok: true, filas: [gasto] };
  }

  // Ya se comprobó arriba; esta guarda solo le enseña el tipo a TypeScript.
  if (!bolivares) return { ok: false, errores: { cuenta: sinBolivares } };
  const tasaTexto = tasaDecimal(tasa);
  const gasto: FilaMovimiento = {
    fecha: e.fecha,
    tipo: "gasto",
    montoCentavos: monto,
    moneda: "VES",
    // La base exige un valor positivo: el repele que vale menos de medio centavo cuenta como 1.
    montoUsdCentavos: Math.max(1, usdDesdeBolivares(monto, tasa)),
    ...sinDestino,
    tasa: tasaTexto,
    cuentaOrigenId: bolivares.id,
    sobreOrigenId: e.sobreId,
    categoriaId: e.categoriaId,
    nota,
    origen: "manual",
  };
  if (e.forma === "saldo") return { ok: true, filas: [gasto] };

  const recibidos = bolivaresDesdeUsd(vendido, tasa);
  if (!Number.isSafeInteger(recibidos)) return { ok: false, errores: { vendido: mensajes.vendido.invalido } };
  // Con la tasa mínima de 1 no debería pasar; si cambia, una venta que no entrega nada sigue sin guardarse.
  if (recibidos <= 0) return { ok: false, errores: { vendido: "A esa tasa la venta no llega a 0,01 Bs" } };
  // La venta mueve dinero real entre cuentas y no toca sobres; el gasto sale del sobre elegido.
  const transferencia: FilaMovimiento = {
    fecha: e.fecha,
    tipo: "transferencia",
    montoCentavos: vendido,
    moneda: e.cuentaOrigen.moneda,
    montoUsdCentavos: vendido,
    montoDestinoCentavos: recibidos,
    monedaDestino: "VES",
    tasa: tasaTexto,
    cuentaOrigenId: e.cuentaOrigen.id,
    cuentaDestinoId: bolivares.id,
    sobreOrigenId: null,
    categoriaId: null,
    nota: null,
    origen: "manual",
  };
  return { ok: true, filas: [transferencia, gasto] };
}

/**
 * Familia va a Familia; Regalos, a Ocasiones; cualquier otra, a Gastos del mes. Por la clave del nombre, como
 * los nombres repetidos: "familia" también. Un renombre de verdad pierde la sugerencia (limitación aceptada).
 */
const sobrePorCategoria = new Map([
  [claveDeNombre("Familia"), "Familia"],
  [claveDeNombre("Regalos"), "Ocasiones"],
]);

/** Sobre que se preselecciona al elegir la categoría (criterio 8), o null si ese sobre no existe. */
export function sobreSugerido(nombreCategoria: string, sobres: { id: number; nombre: string }[]): number | null {
  const nombre = sobrePorCategoria.get(claveDeNombre(nombreCategoria)) ?? "Gastos del mes";
  return sobres.find((s) => s.nombre === nombre)?.id ?? null;
}
