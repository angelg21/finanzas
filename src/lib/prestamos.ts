/**
 * Lo que me deben (spec 005, criterios 4 y 5): prestar crea una deuda "me deben" en 0 y un movimiento que sale de una
 * cuenta y de un sobre; cobrar entra a una cuenta y a "Por asignar". Ninguno es gasto ni ingreso. Es pura: la base
 * guarda la deuda y el préstamo juntos, y vuelve a comprobar el pendiente del cobro con candado.
 */
import { puedeApartarDesde } from "./apartado";
import {
  type CuentaDeuda,
  type DeudaParaSaldar,
  type EntradaPago,
  type FilaDeuda,
  type FilaMovimientoDeuda,
  estadoDe,
  leerMontoHastaPendiente,
  sinCuentaEnDolares,
  validarDeuda,
} from "./deudas";
import { type Moneda, aCentavos } from "./dinero";
import { fechaDesdeAtajo, fechaValida } from "./fechas";

/** Lo que llega del formulario de préstamo, con el monto como texto. */
export type EntradaPrestamo = {
  persona: string;
  monto: string;
  /** "hoy", "ayer" o el día, como en la captura de gasto. */
  fecha: string;
  /** "" si no tiene: cuándo se espera cobrarlo. */
  fechaPrevista: string;
  nota: string;
  cuenta: CuentaDeuda | null;
  sobreOrigenId: number | null;
};

/** El movimiento del préstamo, sin la deuda: la base se la pone al guardarlas juntas. */
export type FilaPrestamo = {
  fecha: string;
  tipo: "prestamo";
  montoCentavos: number;
  moneda: Moneda;
  montoUsdCentavos: number;
  montoDestinoCentavos: null;
  monedaDestino: null;
  tasa: null;
  cuentaOrigenId: number;
  cuentaDestinoId: null;
  sobreOrigenId: number;
  sobreDestinoId: null;
  categoriaId: null;
  nota: string | null;
  origen: "manual";
};

export type ErroresPrestamo = Partial<
  Record<"persona" | "monto" | "fecha" | "fechaPrevista" | "cuenta" | "sobre", string>
>;
export type PrestamoPreparado =
  { ok: true; deuda: FilaDeuda; fila: FilaPrestamo } | { ok: false; errores: ErroresPrestamo };

/** De qué sobres sale un préstamo: los mismos que al apartar, nunca Deudas ni Inversión; "Por asignar" sí. */
export const puedePrestarDesde = puedeApartarDesde;

function leerMonto(texto: string): number | string {
  if (texto.trim() === "") return "Escribe el monto";
  try {
    const centavos = aCentavos(texto);
    if (centavos >= 1 && Number.isSafeInteger(centavos)) return centavos;
  } catch {
    // aCentavos lanza con un mensaje técnico; al usuario se le muestra el del campo.
  }
  return "Escribe un monto mayor que cero";
}

/**
 * Un préstamo a otro (criterio 4): la deuda "me deben" con monto inicial 0, su persona, su fecha prevista y su nota, y
 * el movimiento desde una cuenta en dólares, 1 a 1, y un sobre que puede prestar. Sin categoría: no es gasto.
 */
export function prepararPrestamo(
  e: EntradaPrestamo,
  sobres: { id: number; tipo: string }[],
  hoy: string,
): PrestamoPreparado {
  const errores: ErroresPrestamo = {};
  // La persona, la fecha prevista y la nota se leen como en una deuda; el monto inicial es 0 y se valida aparte.
  const comoDeuda = validarDeuda(
    {
      sentido: "me_deben",
      persona: e.persona,
      monto: "0",
      fechaPrevista: e.fechaPrevista,
      cuentaPrevistaId: null,
      nota: e.nota,
    },
    [],
    { prestadoCentavos: 0, saldadoCentavos: 0 },
  );
  if (!comoDeuda.ok) {
    if (comoDeuda.errores.persona) errores.persona = comoDeuda.errores.persona;
    if (comoDeuda.errores.fechaPrevista) errores.fechaPrevista = comoDeuda.errores.fechaPrevista;
  }
  const monto = leerMonto(e.monto);
  if (typeof monto === "string") errores.monto = monto;
  if (!e.cuenta || e.cuenta.moneda === "VES") errores.cuenta = sinCuentaEnDolares;
  const sobre = sobres.find((s) => s.id === e.sobreOrigenId && puedePrestarDesde(s.tipo));
  if (!sobre) errores.sobre = "Elige de qué sobre sale";
  const fecha = fechaDesdeAtajo(e.fecha, hoy);
  if (!fechaValida(fecha, hoy)) errores.fecha = "Elige hoy o un día anterior";

  if (Object.keys(errores).length > 0 || !comoDeuda.ok || typeof monto === "string" || !e.cuenta || !sobre) {
    return { ok: false, errores };
  }
  return {
    ok: true,
    deuda: comoDeuda.deuda,
    fila: {
      fecha,
      tipo: "prestamo",
      montoCentavos: monto,
      moneda: e.cuenta.moneda,
      // USD, USDT y USDC valen 1 a 1; los bolívares no llegan aquí.
      montoUsdCentavos: monto,
      montoDestinoCentavos: null,
      monedaDestino: null,
      tasa: null,
      cuentaOrigenId: e.cuenta.id,
      cuentaDestinoId: null,
      sobreOrigenId: sobre.id,
      sobreDestinoId: null,
      categoriaId: null,
      nota: comoDeuda.deuda.nota,
      origen: "manual",
    },
  };
}

export type CobroPreparado =
  | { ok: true; fila: FilaMovimientoDeuda }
  | { ok: false; errores: Partial<Record<"monto" | "cuenta" | "fecha" | "deuda", string>> };

/**
 * Un cobro de algo que me deben (criterio 5): entra a una cuenta en dólares, 1 a 1, y a "Por asignar", que se reparte
 * después. Sin categoría: no es ingreso. De 0,01 al pendiente.
 */
export function prepararCobro(
  e: EntradaPago,
  deuda: DeudaParaSaldar,
  porAsignarId: number,
  hoy: string,
): CobroPreparado {
  if (deuda.sentido !== "me_deben") return { ok: false, errores: { deuda: "Esto no es algo que te deban" } };
  if (estadoDe(deuda.pendienteCentavos) === "pagada") return { ok: false, errores: { deuda: "Ya está cobrado" } };

  const errores: Partial<Record<"monto" | "cuenta" | "fecha", string>> = {};
  const monto = leerMontoHastaPendiente(e.monto, deuda.pendienteCentavos);
  if (typeof monto === "string") errores.monto = monto;
  if (!e.cuenta || e.cuenta.moneda === "VES") errores.cuenta = sinCuentaEnDolares;
  const fecha = fechaDesdeAtajo(e.fecha, hoy);
  if (!fechaValida(fecha, hoy)) errores.fecha = "Elige hoy o un día anterior";
  if (Object.keys(errores).length > 0 || typeof monto === "string" || !e.cuenta) return { ok: false, errores };

  return {
    ok: true,
    fila: {
      fecha,
      tipo: "cobro_prestamo",
      montoCentavos: monto,
      moneda: e.cuenta.moneda,
      montoUsdCentavos: monto,
      montoDestinoCentavos: null,
      monedaDestino: null,
      tasa: null,
      cuentaOrigenId: null,
      cuentaDestinoId: e.cuenta.id,
      sobreOrigenId: null,
      sobreDestinoId: porAsignarId,
      categoriaId: null,
      deudaId: deuda.id,
      nota: e.nota.trim() || null,
      origen: "manual",
    },
  };
}
