/**
 * Aviso de liquidez (spec 005, criterio 14): si el dinero para cada deuda está en la cuenta con la que se piensa
 * pagar. Recorre las deudas por fecha y acumula lo que hace falta en cada cuenta; no resuelve nada, solo dice dónde
 * está el dinero. Mover entre cuentas es de otra feature.
 */
import { type Moneda, formatearCentavos, formatearCifra } from "./dinero";
import type { SentidoDeuda } from "./deudas";

export type CuentaParaLiquidez = { id: number; nombre: string; moneda: Moneda; saldoCentavos: number };

export type DeudaParaLiquidez = {
  id: number;
  sentido: SentidoDeuda;
  pendienteCentavos: number;
  fechaPrevista: string | null;
  cuentaPrevistaId: number | null;
};

export type EstadoLiquidez = "lista" | "en_otra_cuenta" | "falta";
export type AvisoLiquidez =
  { estado: "lista"; texto: null } | { estado: Exclude<EstadoLiquidez, "lista">; texto: string };

/** Por fecha, las que no tienen al final; el orden de llegada desempata. */
function porFecha(a: DeudaParaLiquidez, b: DeudaParaLiquidez) {
  if (a.fechaPrevista === b.fechaPrevista) return 0;
  if (a.fechaPrevista === null) return 1;
  if (b.fechaPrevista === null) return -1;
  return a.fechaPrevista < b.fechaPrevista ? -1 : 1;
}

/**
 * Un aviso por cada deuda abierta que debo con cuenta prevista activa, por id de deuda:
 *   lista           → el saldo de la cuenta prevista, en su moneda y 1 a 1, cubre lo acumulado en ella;
 *   en_otra_cuenta  → no lo cubre, pero la suma de las cuentas en dólares sí cubre lo acumulado de todas las deudas;
 *   falta           → no alcanza ni la suma; lo que falta nunca pasa del pendiente de la deuda.
 * "Solo X" es lo que queda en la cuenta prevista después de las deudas anteriores.
 */
export function avisosDeLiquidez({
  deudas,
  cuentas,
}: {
  deudas: DeudaParaLiquidez[];
  cuentas: CuentaParaLiquidez[];
}): Map<number, AvisoLiquidez> {
  for (const d of deudas) {
    if (!Number.isSafeInteger(d.pendienteCentavos) || d.pendienteCentavos < 0)
      throw new RangeError(`Pendiente inválido: ${d.pendienteCentavos}`);
  }
  const enDolares = new Map(cuentas.filter((c) => c.moneda !== "VES").map((c) => [c.id, c]));
  const total = [...enDolares.values()].reduce((a, c) => a + c.saldoCentavos, 0);

  const mira = deudas
    .filter((d) => d.sentido === "debo" && d.pendienteCentavos > 0 && enDolares.has(d.cuentaPrevistaId ?? -1))
    .sort(porFecha);

  const avisos = new Map<number, AvisoLiquidez>();
  const porCuenta = new Map<number, number>();
  let acumulado = 0;
  for (const d of mira) {
    const cuenta = enDolares.get(d.cuentaPrevistaId ?? -1);
    if (!cuenta) continue;
    const antes = porCuenta.get(cuenta.id) ?? 0;
    porCuenta.set(cuenta.id, antes + d.pendienteCentavos);
    acumulado += d.pendienteCentavos;

    if (cuenta.saldoCentavos >= antes + d.pendienteCentavos) {
      avisos.set(d.id, { estado: "lista", texto: null });
    } else if (total >= acumulado) {
      const queda = Math.max(0, cuenta.saldoCentavos - antes);
      const texto = `Tienes ${formatearCentavos(total, "USD")}, pero en ${cuenta.nombre} solo ${formatearCentavos(queda, cuenta.moneda)}`;
      avisos.set(d.id, { estado: "en_otra_cuenta", texto });
    } else {
      const falta = Math.min(d.pendienteCentavos, acumulado - total);
      avisos.set(d.id, { estado: "falta", texto: `Te faltan ${formatearCifra(falta)} para esta deuda` });
    }
  }
  return avisos;
}
