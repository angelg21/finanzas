/**
 * Una captura, una sola vez (spec 002, criterio 19). Cada captura de gasto lleva un UUID que la página genera al
 * abrirla y que viaja con lo tecleado. Cada fila se guarda con una referencia sacada de él, y el índice único de
 * (origen, referencia_externa) hace que un reintento tras un corte a medias (el gasto llegó, la respuesta no) no
 * lo duplique.
 */

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function esIdCaptura(texto: string): boolean {
  return uuid.test(texto);
}

/** "captura-<id>-gasto": una por fila, igual en cada reintento. Nunca empieza por "demo-". */
export function referenciaDeCaptura(id: string, tipo: "gasto" | "transferencia"): string {
  return `captura-${id.toLowerCase()}-${tipo}`;
}

/** Lo que define una fila del gasto: si algo de esto cambió entre intentos, ya no es la misma captura. */
const camposQueCuentan = [
  "tipo",
  "fecha",
  "montoCentavos",
  "moneda",
  "montoUsdCentavos",
  "montoDestinoCentavos",
  "monedaDestino",
  "tasa",
  "cuentaOrigenId",
  "cuentaDestinoId",
  "sobreOrigenId",
  "sobreDestinoId",
  "categoriaId",
  "nota",
] as const;

type FilaComparable = { [C in (typeof camposQueCuentan)[number]]?: string | number | null };

/** Un reintento llega a los segundos; una página vieja con un id ya usado, mucho después. */
const ventanaDeReintento = 15 * 60_000;

function huella(fila: FilaComparable) {
  return camposQueCuentan.map((campo) => String(fila[campo] === "" ? null : (fila[campo] ?? null))).join("|");
}

/**
 * Qué hacer cuando las referencias de una captura ya estaban guardadas. "ya-estaba" solo si lo guardado es lo mismo
 * que ahora se quiso guardar, fila por fila, y es de hace menos de 15 minutos: el primer intento llegó y la respuesta
 * se perdió. Si no, "otra": se cambió algo entre intentos (la confirmación mentiría) o es una página vieja con un id
 * ya usado (se perdería un gasto nuevo); la acción avisa y entrega un id nuevo.
 */
export function resolverReintento(
  guardadas: (FilaComparable & { creadoEn: Date })[],
  preparadas: FilaComparable[],
  ahora: Date,
): "ya-estaba" | "otra" {
  if (guardadas.length === 0 || guardadas.length !== preparadas.length) return "otra";
  if (guardadas.some((g) => ahora.getTime() - g.creadoEn.getTime() > ventanaDeReintento)) return "otra";
  const antes = guardadas.map(huella).sort();
  const ahoraHuellas = preparadas.map(huella).sort();
  return antes.every((h, i) => h === ahoraHuellas[i]) ? "ya-estaba" : "otra";
}
