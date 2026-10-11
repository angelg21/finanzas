/** Utilidades de dinero. Los montos viajan siempre como enteros en centavos. */

const formatoNumero = new Intl.NumberFormat("es-VE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatoEntero = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 0 });

/** Código corto que acompaña a la cifra. */
const unidades: Record<string, string> = {
  USD: "USD",
  USDT: "USDT",
  USDC: "USDC",
  VES: "Bs",
};

/**
 * 123456 → { numero: "1.234,56", entero: "1.234", decimales: "56", unidad: "USD", negativo: false }
 * `entero` y `decimales` permiten atenuar los centavos en cifras grandes.
 */
export function partesCentavos(centavos: number, moneda: string = "USD") {
  const negativo = centavos < 0;
  const numero = formatoNumero.format(Math.abs(centavos) / 100);
  const [entero, decimales = "00"] = numero.split(",");
  return { numero, entero, decimales, unidad: unidades[moneda] ?? moneda, negativo };
}

/** 123456 → "1.234,56 USD" (con signo si es negativo). */
export function formatearCentavos(centavos: number, moneda: string = "USD"): string {
  const { numero, unidad, negativo } = partesCentavos(centavos, moneda);
  return `${negativo ? "−" : ""}${numero} ${unidad}`;
}

/** 123456 → "1.235" (sin decimales, para ejes y resúmenes). */
export function formatearEnteros(centavos: number): string {
  return formatoEntero.format(Math.round(centavos / 100));
}

/** "1.234,56" o "1234.56" → 123456. Lanza si no es un número válido. */
export function aCentavos(texto: string): number {
  const limpio = texto.trim().replace(/\s/g, "");
  // Vacío no es cero: un monto sin escribir es un error, no un gasto de 0.
  if (limpio === "") throw new Error("Monto vacío");
  // Si hay coma y punto, el último separador es el decimal.
  const ultimaComa = limpio.lastIndexOf(",");
  const ultimoPunto = limpio.lastIndexOf(".");
  const normalizado = ultimaComa > ultimoPunto ? limpio.replace(/\./g, "").replace(",", ".") : limpio.replace(/,/g, "");
  const valor = Number(normalizado);
  if (!Number.isFinite(valor)) throw new Error(`Monto inválido: ${texto}`);
  return Math.round(valor * 100);
}
