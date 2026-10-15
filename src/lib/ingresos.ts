/**
 * Registro de un ingreso (spec 004, criterios 6 a 8): de lo tecleado a las filas de movimientos. El ingreso entra en
 * su cuenta y en "Por asignar" (ADR 0002); el reparto son reasignaciones en USD desde "Por asignar", con los montos
 * que el usuario confirmó, sin volver a calcularlos. Es pura: recibe la cuenta y los sobres ya leídos de la base.
 */
import { type Moneda, aCentavos, aCentavosExactos, formatearCentavos } from "./dinero";
import { fechaValida } from "./fechas";
import type { Asignacion } from "./reparto";

export type CuentaIngreso = { id: number; moneda: Moneda };

/** El monto de un sobre tal como se tecleó en su campo. */
export type AsignacionTecleada = { sobreId: number; monto: string };

/** Lo que llega del formulario, con los montos como texto, más lo que la acción leyó de la base. */
export type EntradaIngreso = {
  monto: string;
  /** Ya resuelta desde el atajo "hoy" o "ayer". */
  fecha: string;
  nota: string;
  categoriaId: number;
  porAsignarId: number;
  /** Los sobres activos que pueden recibir reparto. */
  sobresValidos: number[];
  asignaciones: AsignacionTecleada[];
};

/** Una fila de ingreso o de reasignación lista para insertar, con la forma que exige el check por tipo. */
export type FilaIngreso = {
  fecha: string;
  tipo: "ingreso" | "reasignacion";
  montoCentavos: number;
  moneda: Moneda;
  montoUsdCentavos: number;
  montoDestinoCentavos: null;
  monedaDestino: null;
  tasa: null;
  cuentaOrigenId: null;
  cuentaDestinoId: number | null;
  sobreOrigenId: number | null;
  sobreDestinoId: number;
  categoriaId: number | null;
  nota: string | null;
  origen: "manual";
};

/** `sobres`: el error de cada campo, por id de sobre. `reparto`: el del total. */
export type ErroresReparto = { reparto?: string; sobres?: Record<number, string> };
export type ErroresIngreso = ErroresReparto & { monto?: string; cuenta?: string; fecha?: string };

export type AsignacionesValidadas =
  { ok: true; asignaciones: Asignacion[]; sinAsignar: number } | { ok: false; errores: ErroresReparto };

export type IngresoPreparado =
  { ok: true; filas: FilaIngreso[]; sinAsignar: number } | { ok: false; errores: ErroresIngreso };

const mensajes = {
  invalido: "Escribe un monto, como 187,50",
  decimales: "Usa hasta dos decimales",
  negativo: "No puede ser negativo",
  noRecibe: "Este sobre no puede recibir reparto",
  repetido: "Este sobre está repetido",
};

/** El monto de un sobre: vacío vale 0. Si no se puede leer, el mensaje de su campo. */
function leerAsignacion(texto: string): number | string {
  if (texto.trim() === "") return 0;
  try {
    const centavos = aCentavosExactos(texto);
    return centavos < 0 ? mensajes.negativo : centavos;
  } catch {
    // Si aCentavos sí lo lee, lo que sobra son fracciones de centavo.
    try {
      aCentavos(texto);
      return mensajes.decimales;
    } catch {
      return mensajes.invalido;
    }
  }
}

/**
 * Los montos confirmados para cada sobre (criterio 8). Cada campo se lee sin redondear; un sobre que no está entre los
 * válidos o se repite es un error en su campo. Solo si todos se leen, la suma no puede pasar del monto; lo que no se
 * repartió queda en "Por asignar" y la acción pide un segundo clic.
 */
export function validarAsignaciones(
  monto: number,
  tecleadas: AsignacionTecleada[],
  sobresValidos: number[],
): AsignacionesValidadas {
  if (!Number.isSafeInteger(monto) || monto < 0) throw new RangeError(`Monto a repartir inválido: ${monto}`);
  const validos = new Set(sobresValidos);
  const vistos = new Set<number>();
  const sobres: Record<number, string> = {};
  const asignaciones: Asignacion[] = [];
  for (const t of tecleadas) {
    if (!validos.has(t.sobreId) || vistos.has(t.sobreId)) {
      sobres[t.sobreId] = vistos.has(t.sobreId) ? mensajes.repetido : mensajes.noRecibe;
      continue;
    }
    vistos.add(t.sobreId);
    const leido = leerAsignacion(t.monto);
    if (typeof leido === "string") sobres[t.sobreId] = leido;
    else asignaciones.push({ sobreId: t.sobreId, centavos: leido });
  }
  if (Object.keys(sobres).length > 0) return { ok: false, errores: { sobres } };

  const repartido = asignaciones.reduce((a, x) => a + x.centavos, 0);
  if (!Number.isSafeInteger(repartido) || repartido > monto) {
    const reparto = `Repartes ${formatearCentavos(repartido)} y hay ${formatearCentavos(monto)}`;
    return { ok: false, errores: { reparto } };
  }
  return { ok: true, asignaciones, sinAsignar: monto - repartido };
}

/** Una reasignación en USD desde "Por asignar" por cada sobre con monto; las de 0 no se guardan. */
export function filasDeReparto(porAsignarId: number, asignaciones: Asignacion[], fecha: string): FilaIngreso[] {
  return asignaciones
    .filter((a) => a.centavos > 0)
    .map((a) => ({
      fecha,
      tipo: "reasignacion",
      montoCentavos: a.centavos,
      moneda: "USD",
      montoUsdCentavos: a.centavos,
      montoDestinoCentavos: null,
      monedaDestino: null,
      tasa: null,
      cuentaOrigenId: null,
      cuentaDestinoId: null,
      sobreOrigenId: porAsignarId,
      sobreDestinoId: a.sobreId,
      categoriaId: null,
      nota: null,
      origen: "manual",
    }));
}

/** El monto del ingreso, con aCentavos y mayor que cero. Si no se puede, anota el error del campo y devuelve 0. */
function leerMonto(texto: string, errores: ErroresIngreso): number {
  if (texto.trim() === "") {
    errores.monto = "Escribe el monto";
    return 0;
  }
  try {
    const centavos = aCentavos(texto);
    if (centavos >= 1) return centavos;
  } catch {
    // aCentavos lanza con un mensaje técnico; al usuario se le muestra el del campo.
  }
  errores.monto = "Escribe un monto mayor que cero";
  return 0;
}

export function prepararIngreso(e: EntradaIngreso, hoy: string, cuenta: CuentaIngreso | null): IngresoPreparado {
  const errores: ErroresIngreso = {};
  const monto = leerMonto(e.monto, errores);
  if (!cuenta || cuenta.moneda === "VES") errores.cuenta = "Elige una cuenta en dólares";
  if (!fechaValida(e.fecha, hoy)) errores.fecha = "Elige hoy o un día anterior";
  // "Por asignar" no se reparte a sí mismo, aunque llegue entre los sobres válidos.
  const validos = e.sobresValidos.filter((id) => id !== e.porAsignarId);
  const reparto = monto > 0 ? validarAsignaciones(monto, e.asignaciones, validos) : null;
  if (reparto && !reparto.ok) Object.assign(errores, reparto.errores);
  if (Object.keys(errores).length > 0 || !cuenta || !reparto || !reparto.ok) return { ok: false, errores };

  const ingreso: FilaIngreso = {
    fecha: e.fecha,
    tipo: "ingreso",
    montoCentavos: monto,
    moneda: cuenta.moneda,
    // USD, USDT y USDC valen 1 a 1; los bolívares no llegan aquí.
    montoUsdCentavos: monto,
    montoDestinoCentavos: null,
    monedaDestino: null,
    tasa: null,
    cuentaOrigenId: null,
    cuentaDestinoId: cuenta.id,
    sobreOrigenId: null,
    sobreDestinoId: e.porAsignarId,
    categoriaId: e.categoriaId,
    nota: e.nota.trim() || null,
    origen: "manual",
  };
  return {
    ok: true,
    filas: [ingreso, ...filasDeReparto(e.porAsignarId, reparto.asignaciones, e.fecha)],
    sinAsignar: reparto.sinAsignar,
  };
}
