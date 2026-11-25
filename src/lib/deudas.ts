/**
 * Deudas y préstamos (spec 005): de lo tecleado a la fila de deudas y a los movimientos que la saldan. El pendiente
 * nunca se guarda: sale del monto inicial y de los movimientos de la deuda. Es pura: recibe las cuentas y los totales
 * ya leídos de la base, y la base vuelve a comprobar el pendiente con candado antes de escribir.
 */
import { type Moneda, aCentavos, formatearCifra as cifra } from "./dinero";
import { esFecha, fechaValida } from "./fechas";
import { TOPE_REGLA_CENTAVOS } from "./fondos";

export type SentidoDeuda = "debo" | "me_deben";
export type EstadoDeuda = "abierta" | "pagada";

export type CuentaDeuda = { id: number; moneda: Moneda };

/** Lo que movió una deuda: préstamos, y pagos o cobros según su sentido. */
export type MovidoDeuda = { prestadoCentavos: number; saldadoCentavos: number };

function esCentavos(n: number) {
  return Number.isSafeInteger(n) && n >= 0;
}

/**
 * Pendiente = monto inicial + préstamos − pagos o cobros (criterio 2). En "debo" no hay préstamos. Un pendiente
 * negativo no lo deja ninguna escritura: si aparece, los datos están rotos y se dice en vez de mostrarlo.
 */
export function pendienteDe(d: MovidoDeuda & { sentido: SentidoDeuda; montoInicialCentavos: number }): number {
  if (![d.montoInicialCentavos, d.prestadoCentavos, d.saldadoCentavos].every(esCentavos))
    // Sin volcar la fila: puede traer la persona y la nota, y el error acaba en los registros.
    throw new RangeError("Montos de deuda inválidos");
  if (d.sentido === "debo" && d.prestadoCentavos !== 0) throw new RangeError("Una deuda que debo no tiene préstamos");
  const pendiente = d.montoInicialCentavos + d.prestadoCentavos - d.saldadoCentavos;
  if (pendiente < 0) throw new RangeError(`Pendiente negativo: ${pendiente}`);
  return pendiente;
}

export function estadoDe(pendienteCentavos: number): EstadoDeuda {
  if (!esCentavos(pendienteCentavos)) throw new RangeError(`Pendiente inválido: ${pendienteCentavos}`);
  return pendienteCentavos > 0 ? "abierta" : "pagada";
}

/** Lo pendiente por sentido, para el patrimonio neto y la medida del sobre Deudas. Las pagadas suman cero. */
export function pendientePorSentido(lista: { sentido: SentidoDeuda; pendienteCentavos: number }[]) {
  const total = (sentido: SentidoDeuda) =>
    lista.filter((d) => d.sentido === sentido).reduce((a, d) => a + d.pendienteCentavos, 0);
  return { deboCentavos: total("debo"), meDebenCentavos: total("me_deben") };
}

/** Cuentas + lo que me deben − lo que debo (criterio 15). No entra en el cuadre de sobres y cuentas. */
export function patrimonioNeto(t: { cuentasCentavos: number; meDebenCentavos: number; deboCentavos: number }): number {
  return t.cuentasCentavos + t.meDebenCentavos - t.deboCentavos;
}

/**
 * El monto inicial más bajo que no deja el pendiente en negativo (criterio 16): en "debo", lo ya pagado y nunca menos
 * de 0,01, que exige la base; en "me deben", lo cobrado menos lo prestado, y nunca menos de cero.
 */
export function montoInicialMinimo(d: MovidoDeuda & { sentido: SentidoDeuda }): number {
  if (d.sentido === "debo") return Math.max(1, d.saldadoCentavos);
  return Math.max(0, d.saldadoCentavos - d.prestadoCentavos);
}

/** Lo que llega del formulario de una deuda, con el monto como texto. */
export type EntradaDeuda = {
  sentido: SentidoDeuda;
  persona: string;
  monto: string;
  /** "" si no tiene fecha. */
  fechaPrevista: string;
  cuentaPrevistaId: number | null;
  nota: string;
};

/** Una fila de deudas lista para insertar o actualizar, sin la referencia. */
export type FilaDeuda = {
  sentido: SentidoDeuda;
  persona: string;
  montoInicialCentavos: number;
  fechaPrevista: string | null;
  cuentaPrevistaId: number | null;
  nota: string | null;
};

export type ErroresDeuda = Partial<Record<"persona" | "monto" | "fechaPrevista" | "cuentaPrevista", string>>;
export type DeudaValidada = { ok: true; deuda: FilaDeuda } | { ok: false; errores: ErroresDeuda };

const largoPersona = 80;
export const sinCuentaEnDolares = "Elige una cuenta en dólares";

/** El monto que exige la base para una deuda nueva o editada, o el mensaje de su campo. */
function leerMontoInicial(texto: string, minimo: number, sentido: SentidoDeuda, movido?: MovidoDeuda): number | string {
  if (texto.trim() === "") return "Escribe el monto";
  let centavos: number;
  try {
    centavos = aCentavos(texto);
  } catch {
    return "Escribe un monto mayor que cero";
  }
  if (centavos > TOPE_REGLA_CENTAVOS) return `No puede pasar de ${cifra(TOPE_REGLA_CENTAVOS)}`;
  if (centavos >= minimo) return centavos;
  // Por debajo del mínimo, el mensaje dice por qué: lo ya pagado o cobrado, o simplemente cero.
  if (minimo <= 1 || !movido) return "Escribe un monto mayor que cero";
  return sentido === "debo"
    ? `Ya pagaste ${cifra(minimo)}: no puede ser menos`
    : `Ya te devolvieron ${cifra(minimo)}: no puede ser menos`;
}

/**
 * Registrar o editar una deuda (criterios 1 y 16). Al crear, `movido` no llega y el monto empieza en 0,01; al editar,
 * llega lo que ya movió la deuda y el monto no puede bajar de montoInicialMinimo. La cuenta prevista solo se guarda en
 * "debo": en "me deben" se ignora, porque sin JavaScript el formulario la envía igual.
 */
export function validarDeuda(e: EntradaDeuda, cuentasEnDolares: CuentaDeuda[], movido?: MovidoDeuda): DeudaValidada {
  const errores: ErroresDeuda = {};
  const persona = e.persona.trim();
  if (persona === "") errores.persona = "Escribe a quién";
  else if ([...persona].length > largoPersona) errores.persona = `Usa hasta ${largoPersona} caracteres`;

  const minimo = movido ? montoInicialMinimo({ sentido: e.sentido, ...movido }) : 1;
  const monto = leerMontoInicial(e.monto, minimo, e.sentido, movido);
  if (typeof monto === "string") errores.monto = monto;

  const fechaPrevista = e.fechaPrevista.trim() === "" ? null : e.fechaPrevista.trim();
  if (fechaPrevista !== null && !esFecha(fechaPrevista)) errores.fechaPrevista = "Elige una fecha válida";

  const cuentaPrevistaId = e.sentido === "debo" ? e.cuentaPrevistaId : null;
  const cuentaValida =
    cuentaPrevistaId === null || cuentasEnDolares.some((c) => c.id === cuentaPrevistaId && c.moneda !== "VES");
  if (!cuentaValida) errores.cuentaPrevista = sinCuentaEnDolares;

  if (Object.keys(errores).length > 0 || typeof monto === "string") return { ok: false, errores };
  return {
    ok: true,
    deuda: {
      sentido: e.sentido,
      persona,
      montoInicialCentavos: monto,
      fechaPrevista,
      cuentaPrevistaId,
      nota: e.nota.trim() || null,
    },
  };
}

/** La cuenta que viene elegida al pagar: la prevista si sigue en la lista y es en dólares; si no, la primera en dólares. */
export function cuentaParaPagar(cuentaPrevistaId: number | null, cuentas: CuentaDeuda[]): number | null {
  const enDolares = cuentas.filter((c) => c.moneda !== "VES");
  return enDolares.find((c) => c.id === cuentaPrevistaId)?.id ?? enDolares[0]?.id ?? null;
}

/**
 * La línea antes de guardar: lo que tiene el sobre y en cuánto quedará, en negativo si no alcanza. Se guarda igual.
 * En el pago es Deudas (criterio 3); al prestar, el sobre de origen (observación 11, decidido el 2026-10-16).
 */
export function avisoDelSobre(nombre: string, saldoCentavos: number, montoCentavos: number) {
  const queda = saldoCentavos - montoCentavos;
  return { texto: `${nombre} tiene ${cifra(saldoCentavos)}; quedará en ${cifra(queda)}`, negativo: queda < 0 };
}

/** La línea del formulario de pago: lo que tiene Deudas y en cuánto quedará (criterio 3). */
export function avisoDelSobreDeudas(saldoCentavos: number, montoCentavos: number) {
  return avisoDelSobre("Deudas", saldoCentavos, montoCentavos);
}

/** Un movimiento de deudas listo para insertar, con la forma que exige el check por tipo (criterio 8). */
export type FilaMovimientoDeuda = {
  fecha: string;
  tipo: "pago_deuda" | "cobro_prestamo";
  montoCentavos: number;
  moneda: Moneda;
  montoUsdCentavos: number;
  montoDestinoCentavos: null;
  monedaDestino: null;
  tasa: null;
  cuentaOrigenId: number | null;
  cuentaDestinoId: number | null;
  sobreOrigenId: number | null;
  sobreDestinoId: number | null;
  /** Solo un pago, y solo si también cuenta como gasto (spec 014); el cobro nunca. */
  categoriaId: number | null;
  deudaId: number;
  nota: string | null;
  origen: "manual";
};

export type EntradaPago = {
  monto: string;
  fecha: string;
  nota: string;
  cuenta: CuentaDeuda | null;
  /** Una categoría de gasto ya comprobada si el pago también cuenta como gasto (spec 014); nada, si no. */
  categoriaId?: number | null;
};
export type DeudaParaSaldar = { id: number; sentido: SentidoDeuda; pendienteCentavos: number };
export type ErroresPago = Partial<Record<"monto" | "cuenta" | "fecha" | "deuda" | "sobre" | "categoria", string>>;

/** Spec 014: una deuda se paga desde cualquier sobre menos Por asignar, que primero se reparte. */
export function sobreAceptaPago(tipoSobre: string): boolean {
  return tipoSobre !== "por_asignar";
}
export type PagoPreparado = { ok: true; fila: FilaMovimientoDeuda } | { ok: false; errores: ErroresPago };

/** De 0,01 al pendiente, o el mensaje del campo (criterio 6). Lo comparten el pago y el cobro. */
export function leerMontoHastaPendiente(texto: string, pendiente: number): number | string {
  if (texto.trim() === "") return "Escribe el monto";
  try {
    const centavos = aCentavos(texto);
    if (centavos > pendiente) return `No puede pasar de lo pendiente: ${cifra(pendiente)}`;
    if (centavos >= 1) return centavos;
  } catch {
    // aCentavos lanza con un mensaje técnico; al usuario se le muestra el del campo.
  }
  return "Escribe un monto mayor que cero";
}

/**
 * Un pago de una deuda que debo (criterio 3): sale de una cuenta en dólares, 1 a 1, y del sobre elegido, Deudas por
 * defecto (spec 014). Sin categoría no es gasto; con ella también cuenta como gasto, pero sigue siendo un solo
 * movimiento: el dinero sale una vez. Si el sobre no alcanza se guarda igual; el aviso lo da avisoDelSobre.
 */
export function prepararPago(e: EntradaPago, deuda: DeudaParaSaldar, sobreId: number, hoy: string): PagoPreparado {
  if (deuda.sentido !== "debo") return { ok: false, errores: { deuda: "Esto no es algo que debas" } };
  if (estadoDe(deuda.pendienteCentavos) === "pagada")
    return { ok: false, errores: { deuda: "Esta deuda ya está pagada" } };

  const errores: ErroresPago = {};
  const monto = leerMontoHastaPendiente(e.monto, deuda.pendienteCentavos);
  if (typeof monto === "string") errores.monto = monto;
  if (!e.cuenta || e.cuenta.moneda === "VES") errores.cuenta = sinCuentaEnDolares;
  if (!fechaValida(e.fecha, hoy)) errores.fecha = "Elige hoy o un día anterior";
  if (Object.keys(errores).length > 0 || typeof monto === "string" || !e.cuenta) return { ok: false, errores };

  return {
    ok: true,
    fila: {
      fecha: e.fecha,
      tipo: "pago_deuda",
      montoCentavos: monto,
      moneda: e.cuenta.moneda,
      // USD, USDT y USDC valen 1 a 1; los bolívares no llegan aquí.
      montoUsdCentavos: monto,
      montoDestinoCentavos: null,
      monedaDestino: null,
      tasa: null,
      cuentaOrigenId: e.cuenta.id,
      cuentaDestinoId: null,
      sobreOrigenId: sobreId,
      sobreDestinoId: null,
      categoriaId: e.categoriaId ?? null,
      deudaId: deuda.id,
      nota: e.nota.trim() || null,
      origen: "manual",
    },
  };
}
