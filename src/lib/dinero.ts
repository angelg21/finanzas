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

/** Quita los espacios y deja el punto como único separador decimal. */
function normalizar(texto: string): string {
  const limpio = texto.trim().replace(/\s/g, "");
  // Si hay coma y punto, el último separador es el decimal. Sin coma, un punto solo es decimal: "2.100" vale 2,10.
  const ultimaComa = limpio.lastIndexOf(",");
  const ultimoPunto = limpio.lastIndexOf(".");
  return ultimaComa > ultimoPunto ? limpio.replace(/\./g, "").replace(",", ".") : limpio.replace(/,/g, "");
}

/** "1.234,56" o "1234.56" → 123456. Lanza si no es un número válido. */
export function aCentavos(texto: string): number {
  const normalizado = normalizar(texto);
  // Vacío no es cero: un monto sin escribir es un error, no un gasto de 0.
  if (normalizado === "") throw new Error("Monto vacío");
  const valor = Number(normalizado);
  if (!Number.isFinite(valor)) throw new Error(`Monto inválido: ${texto}`);
  return Math.round(valor * 100);
}

/*
  Tasas: bolívares por dólar. En memoria viajan como enteros en diezmilésimas
  (241,8 → 2418000), la misma precisión que guarda la base en numeric(14,4),
  para que la conversión entre monedas nunca pase por coma flotante.
*/

const DIEZMILESIMAS = 10_000;
/** numeric(14,4) admite hasta 10 dígitos enteros. */
const TASA_MAXIMA = 10 ** 14 - 1;

/** "241,8" o "241.8" → 2418000. Se escribe como los montos. Lanza si está vacía, no es número o no es mayor que cero. */
export function aTasa(texto: string): number {
  const normalizado = normalizar(texto);
  if (normalizado === "") throw new Error("Tasa vacía");
  const valor = Number(normalizado);
  if (!Number.isFinite(valor)) throw new Error(`Tasa inválida: ${texto}`);
  const tasaDm = Math.round(valor * DIEZMILESIMAS);
  if (tasaDm <= 0) throw new Error(`La tasa debe ser mayor que cero: ${texto}`);
  if (tasaDm > TASA_MAXIMA) throw new Error(`Tasa demasiado grande: ${texto}`);
  return tasaDm;
}

function comprobarEnteros(centavos: number, tasaDm: number) {
  if (!Number.isSafeInteger(centavos)) throw new RangeError(`Los centavos deben ser enteros: ${centavos}`);
  if (!Number.isSafeInteger(tasaDm) || tasaDm <= 0) throw new RangeError(`Tasa inválida: ${tasaDm}`);
}

/** Cociente entero redondeado al más cercano, las mitades lejos de cero. El divisor es positivo. */
function dividirRedondeando(numerador: bigint, divisor: bigint): number {
  const dos = BigInt(2);
  const negativo = numerador < BigInt(0);
  const absoluto = negativo ? -numerador : numerador;
  const cociente = (dos * absoluto + divisor) / (dos * divisor);
  return Number(negativo ? -cociente : cociente);
}

/** Centavos de dólar → centavos de bolívar a la tasa dada: 2000 a 2418000 → 483600. */
export function bolivaresDesdeUsd(usdCentavos: number, tasaDm: number): number {
  comprobarEnteros(usdCentavos, tasaDm);
  return dividirRedondeando(BigInt(usdCentavos) * BigInt(tasaDm), BigInt(DIEZMILESIMAS));
}

/** Centavos de bolívar → centavos de dólar a la tasa dada: 210000 a 2418000 → 868. */
export function usdDesdeBolivares(bsCentavos: number, tasaDm: number): number {
  comprobarEnteros(bsCentavos, tasaDm);
  return dividirRedondeando(BigInt(bsCentavos) * BigInt(DIEZMILESIMAS), BigInt(tasaDm));
}

/** 2418000 → "241,80 Bs/USD". Al menos dos decimales y hasta cuatro si los tiene. */
export function formatearTasa(tasaDm: number): string {
  const resto = tasaDm % DIEZMILESIMAS;
  const entero = (tasaDm - resto) / DIEZMILESIMAS;
  const decimales = String(resto)
    .padStart(4, "0")
    .replace(/0{1,2}$/, "");
  return `${formatoEntero.format(entero)},${decimales} Bs/USD`;
}
