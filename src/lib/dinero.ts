/** Utilidades de dinero. Los montos viajan siempre como enteros en centavos. */

const formatoNumero = new Intl.NumberFormat("es-VE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatoEntero = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 0 });

/** Las monedas de las cuentas, como el enum `moneda` de la base. */
export type Moneda = "USD" | "USDT" | "USDC" | "VES";

/** Código corto que acompaña a la cifra. */
const unidades: Record<string, string> = {
  USD: "USD",
  USDT: "USDT",
  USDC: "USDC",
  VES: "Bs",
};

/** "VES" → "Bs"; las demás monedas se muestran con su código. */
export function unidadDe(moneda: string): string {
  return unidades[moneda] ?? moneda;
}

/**
 * 123456 → { numero: "1.234,56", entero: "1.234", decimales: "56", unidad: "USD", negativo: false }
 * `entero` y `decimales` permiten atenuar los centavos en cifras grandes.
 */
export function partesCentavos(centavos: number, moneda: string = "USD") {
  const negativo = centavos < 0;
  const numero = formatoNumero.format(Math.abs(centavos) / 100);
  const [entero, decimales = "00"] = numero.split(",");
  return { numero, entero, decimales, unidad: unidadDe(moneda), negativo };
}

/** 123456 → "1.234,56 USD" (con signo si es negativo). */
export function formatearCentavos(centavos: number, moneda: string = "USD"): string {
  const { numero, unidad, negativo } = partesCentavos(centavos, moneda);
  return `${negativo ? "−" : ""}${numero} ${unidad}`;
}

/** 270000 → "2.700"; 18750 → "187,50": sin la unidad ni los centavos en cero, para una pista corta. */
export function formatearCifraCorta(centavos: number): string {
  return partesCentavos(centavos).numero.replace(/,00$/, "");
}

/** −11500 → "−115,00": la cifra con su signo y sin unidad, para los avisos que se leen como frase. */
export function formatearCifra(centavos: number): string {
  const { numero, negativo } = partesCentavos(centavos);
  return `${negativo ? "−" : ""}${numero}`;
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

/**
 * Un número normalizado, multiplicado por 10^decimales y redondeado al entero (mitades lejos de cero),
 * leyendo las cifras como texto: nunca pasa por coma flotante. Solo admite signo, cifras y un punto
 * decimal; "1e3" o "0x10", que `Number` sí entiende, son null. También null si no cabe en un entero seguro.
 */
function escalar(normalizado: string, decimales: number): number | null {
  const partes = /^(-?)(\d*)(?:\.(\d*))?$/.exec(normalizado);
  if (!partes) return null;
  const [, signo, entero = "", fraccion = ""] = partes;
  if (entero === "" && fraccion === "") return null;
  const cifras = fraccion.padEnd(decimales + 1, "0");
  let valor = BigInt(entero || "0") * BigInt(10 ** decimales) + BigInt(cifras.slice(0, decimales) || "0");
  if (Number(cifras[decimales]) >= 5) valor += BigInt(1);
  if (valor > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return signo && valor > BigInt(0) ? -Number(valor) : Number(valor);
}

/** "1.234,56" o "1234.56" → 123456. Lanza si no es un número válido. */
export function aCentavos(texto: string): number {
  const normalizado = normalizar(texto);
  // Vacío no es cero: un monto sin escribir es un error, no un gasto de 0.
  if (normalizado === "") throw new Error("Monto vacío");
  const centavos = escalar(normalizado, 2);
  if (centavos === null) throw new Error(`Monto inválido: ${texto}`);
  return centavos;
}

/** El monto tecleado en centavos, o null mientras no se lee como un monto mayor que cero. Para los avisos en vivo. */
export function montoPositivo(texto: string): number | null {
  try {
    const centavos = aCentavos(texto);
    return centavos > 0 ? centavos : null;
  } catch {
    return null;
  }
}

/**
 * Como aCentavos, pero lanza si el texto trae fracciones de centavo: "10,555" no se redondea en silencio a 10,56.
 * Los ceros de más sí valen ("1,500" es 1,50). Para los montos que se confirman uno por uno, como un reparto.
 */
export function aCentavosExactos(texto: string): number {
  const fraccion = /\.(\d*)$/.exec(normalizar(texto))?.[1] ?? "";
  if (/[1-9]/.test(fraccion.slice(2))) throw new Error(`Más de dos decimales: ${texto}`);
  return aCentavos(texto);
}

/** Un monto que se confirma campo por campo: sus centésimas, o por qué no se pudo leer, para el mensaje del campo. */
export type LecturaExacta = { ok: true; valor: number } | { ok: false; motivo: "vacio" | "decimales" | "invalido" };

/** Lee con aCentavosExactos sin lanzar. Sirve igual para centavos y para puntos base, que también son centésimas. */
export function leerExacto(texto: string): LecturaExacta {
  if (normalizar(texto) === "") return { ok: false, motivo: "vacio" };
  try {
    return { ok: true, valor: aCentavosExactos(texto) };
  } catch {
    // Si aCentavos sí lo lee, lo que sobra son fracciones de centavo; si no, no es un número.
    try {
      aCentavos(texto);
      return { ok: false, motivo: "decimales" };
    } catch {
      return { ok: false, motivo: "invalido" };
    }
  }
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
  const tasaDm = escalar(normalizado, 4);
  if (tasaDm === null) throw new Error(`Tasa inválida: ${texto}`);
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

/**
 * Un total en centavos repartido en partes iguales, hacia arriba al múltiplo dado, sin coma flotante:
 * 120001 centavos al año en 12 meses, al dólar (100) → 10100. Para aportes que nunca se quedan cortos.
 */
export function repartirHaciaArriba(centavos: number, partes: number, multiplo: number): number {
  if (!Number.isSafeInteger(centavos)) throw new RangeError(`Los centavos deben ser enteros: ${centavos}`);
  if (!Number.isSafeInteger(partes) || partes <= 0) throw new RangeError(`Partes inválidas: ${partes}`);
  if (!Number.isSafeInteger(multiplo) || multiplo <= 0) throw new RangeError(`Múltiplo inválido: ${multiplo}`);
  const divisor = BigInt(partes) * BigInt(multiplo);
  const total = BigInt(centavos);
  // La división de BigInt trunca hacia cero: para positivos se suma el divisor menos uno para subir.
  const uno = BigInt(1);
  const bloques = total > BigInt(0) ? (total + divisor - uno) / divisor : total / divisor;
  return Number(bloques * BigInt(multiplo));
}

/** Parte entera y los cuatro decimales de una tasa, sin pasar por coma flotante. */
function partesTasa(tasaDm: number) {
  const resto = tasaDm % DIEZMILESIMAS;
  return { entero: (tasaDm - resto) / DIEZMILESIMAS, decimales: String(resto).padStart(4, "0") };
}

/** 2418000 → "241.8000": el texto que guarda la columna numeric(14,4). */
export function tasaDecimal(tasaDm: number): string {
  const { entero, decimales } = partesTasa(tasaDm);
  return `${entero}.${decimales}`;
}

/** 2418000 → "241,80 Bs/USD". Al menos dos decimales y hasta cuatro si los tiene. */
export function formatearTasa(tasaDm: number): string {
  const { entero, decimales } = partesTasa(tasaDm);
  return `${formatoEntero.format(entero)},${decimales.replace(/0{1,2}$/, "")} Bs/USD`;
}

/**
 * 2550 → "25,50"; 2500 → "25". El monto como se escribe en un campo, para su valor inicial: aCentavos lo lee igual.
 * Con las cifras como texto, nunca pasa por coma flotante.
 */
export function centavosATexto(centavos: number): string {
  const cifras = String(Math.abs(centavos)).padStart(3, "0");
  const entero = cifras.slice(0, -2);
  const decimales = cifras.slice(-2);
  return `${centavos < 0 ? "-" : ""}${entero}${decimales === "00" ? "" : `,${decimales}`}`;
}

/**
 * "221.4000" → "221,40 Bs/USD": la tasa como la devuelve la base. Si no es una tasa válida (cero, negativa, ilegible:
 * la base no lo impide, un import podría traerla), se muestra el texto tal cual en vez de tumbar la página.
 */
export function formatearTasaGuardada(texto: string): string {
  try {
    return formatearTasa(aTasa(texto));
  } catch {
    // Una tasa rara no debe impedir ver el resto de los movimientos: se muestra cruda.
    return texto;
  }
}
