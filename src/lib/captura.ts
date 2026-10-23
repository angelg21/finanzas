/**
 * Una captura, una sola vez (spec 002, criterio 19). Cada captura de gasto o de ingreso lleva un UUID que la página genera al
 * abrirla y que viaja con lo tecleado. Cada fila se guarda con una referencia sacada de él, y el índice único de
 * (origen, referencia_externa) hace que un reintento tras un corte a medias (el gasto llegó, la respuesta no) no
 * lo duplique.
 */

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function esIdCaptura(texto: string): boolean {
  return uuid.test(texto);
}

/**
 * El id de la captura que guardó una fila, de su referencia "captura-<id>-<tipo>", o null si no vino de una captura
 * (importada, de demostración). Con él se encuentra lo enlazado: la venta de un gasto o el reparto de un ingreso.
 */
export function idDeReferencia(referencia: string | null): string | null {
  const id = /^captura-([0-9a-f-]{36})-[a-z]/i.exec(referencia ?? "")?.[1];
  return id && esIdCaptura(id) ? id.toLowerCase() : null;
}

/**
 * "captura-<id>-gasto": una por fila, igual en cada reintento. Nunca empieza por "demo-". "deuda" es la fila de la
 * tabla deudas; las demás, movimientos (spec 005, criterio 7).
 */
export function referenciaDeCaptura(
  id: string,
  tipo: "gasto" | "transferencia" | "ingreso" | "deuda" | "pago" | "prestamo" | "cobro" | "pendiente",
): string {
  return `captura-${id.toLowerCase()}-${tipo}`;
}

/**
 * "captura-<id>-": el comienzo de todas las referencias de una captura, para releerlas con LIKE tras un choque. Solo
 * con un UUID, que no trae comodines de LIKE; el guion final impide abarcar otra captura.
 */
export function prefijoDeCaptura(id: string): string {
  if (!esIdCaptura(id)) throw new RangeError("Id de captura inválido");
  return `captura-${id.toLowerCase()}-`;
}

/** "captura-<id>-reasignacion-<sobre>": un ingreso se reparte en varias, una por sobre (spec 004, criterio 7). */
export function referenciaDeReasignacion(id: string, sobreId: number): string {
  if (!Number.isSafeInteger(sobreId) || sobreId <= 0) throw new RangeError(`Sobre inválido: ${sobreId}`);
  return `captura-${id.toLowerCase()}-reasignacion-${sobreId}`;
}

/** Lo que distingue en la referencia lo que se mueve a mano de lo que se reparte. */
export const marcaDeMover = "-mover-";

/**
 * "captura-<id>-mover-<sobre>": lo que se mueve a mano entre sobres (spec 007). Es una reasignación como las del
 * reparto, pero el reparto no la cuenta como recibido de "Por asignar": Mover no cuenta (spec 007, criterio 10).
 */
export function referenciaDeMover(id: string, sobreId: number): string {
  if (!Number.isSafeInteger(sobreId) || sobreId <= 0) throw new RangeError(`Sobre inválido: ${sobreId}`);
  return `captura-${id.toLowerCase()}${marcaDeMover}${sobreId}`;
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
  "deudaId",
  "nota",
] as const;

type FilaComparable = { [C in (typeof camposQueCuentan)[number]]?: string | number | null };

/** Lo que define una deuda registrada (spec 005, criterio 7). */
const camposDeDeuda = [
  "sentido",
  "persona",
  "montoInicialCentavos",
  "fechaPrevista",
  "cuentaPrevistaId",
  "nota",
] as const;

type DeudaComparable = { [C in (typeof camposDeDeuda)[number]]?: string | number | null };

/** Un reintento llega a los segundos; una página vieja con un id ya usado, mucho después. */
const ventanaDeReintento = 15 * 60_000;

function huella<F extends Partial<Record<C, string | number | null>>, C extends string>(campos: readonly C[], fila: F) {
  return campos.map((campo) => String(fila[campo] === "" ? null : (fila[campo] ?? null))).join("|");
}

function esReciente(guardada: { creadoEn: Date }, ahora: Date) {
  return ahora.getTime() - guardada.creadoEn.getTime() <= ventanaDeReintento;
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
  if (!guardadas.every((g) => esReciente(g, ahora))) return "otra";
  const antes = guardadas.map((g) => huella(camposQueCuentan, g)).sort();
  const ahoraHuellas = preparadas.map((p) => huella(camposQueCuentan, p)).sort();
  return antes.every((h, i) => h === ahoraHuellas[i]) ? "ya-estaba" : "otra";
}

/** Como resolverReintento, para la fila de deudas que se registra sola: la misma y reciente es "ya-estaba". */
export function resolverReintentoDeDeuda(
  guardada: DeudaComparable & { creadoEn: Date },
  preparada: DeudaComparable,
  ahora: Date,
): "ya-estaba" | "otra" {
  if (!esReciente(guardada, ahora)) return "otra";
  return huella(camposDeDeuda, guardada) === huella(camposDeDeuda, preparada) ? "ya-estaba" : "otra";
}
