/**
 * Qué mueve cada tipo de movimiento, decidido en un solo lugar (spec 005, criterio 9). Un tipo nuevo no compila
 * hasta que se le da su efecto aquí, y en tiempo de ejecución un tipo desconocido lanza: antes se trataba en
 * silencio como reasignación. Las sumas de SQL de src/db repiten estas reglas y se comparan con saldosTras contra
 * la base en scripts/comprobar-005.ts.
 */

export const tiposDeMovimiento = [
  "ingreso",
  "gasto",
  "transferencia",
  "reasignacion",
  "pago_deuda",
  "prestamo",
  "cobro_prestamo",
] as const;

export type TipoMovimiento = (typeof tiposDeMovimiento)[number];

/**
 * Lados que toca un tipo. Sale de la cuenta de origen el monto en su moneda; entra en la de destino lo recibido
 * en su moneda (montoDestinoCentavos) o, si no se indica, el monto. Los sobres se mueven siempre en USD.
 */
export type Efecto = {
  saleDeCuenta: boolean;
  entraACuenta: boolean;
  saleDeSobre: boolean;
  entraASobre: boolean;
};

const comoGasto: Efecto = { saleDeCuenta: true, entraACuenta: false, saleDeSobre: true, entraASobre: false };
const comoIngreso: Efecto = { saleDeCuenta: false, entraACuenta: true, saleDeSobre: false, entraASobre: true };

export function efectoDe(tipo: TipoMovimiento): Efecto {
  switch (tipo) {
    case "ingreso":
      return comoIngreso;
    case "gasto":
      return comoGasto;
    case "transferencia":
      return { saleDeCuenta: true, entraACuenta: true, saleDeSobre: false, entraASobre: false };
    case "reasignacion":
      return { saleDeCuenta: false, entraACuenta: false, saleDeSobre: true, entraASobre: true };
    // Pagar y prestar cambian dinero por deuda: salen como un gasto, pero no son gasto (criterios 3 y 4).
    case "pago_deuda":
    case "prestamo":
      return comoGasto;
    // Cobrar cambia deuda por dinero: entra como un ingreso, a Por asignar, pero no es ingreso (criterio 5).
    case "cobro_prestamo":
      return comoIngreso;
    default: {
      const desconocido: never = tipo;
      throw new Error(`Tipo de movimiento sin efecto definido: ${String(desconocido)}`);
    }
  }
}

type SaldosPorId = Record<number, number>;

/** Lo que mueve saldos en una fila de cualquier tipo. Las del gasto no traen sobre destino. */
export type FilaQueMueve = {
  tipo: TipoMovimiento;
  montoCentavos: number;
  montoUsdCentavos: number;
  montoDestinoCentavos: number | null;
  cuentaOrigenId: number | null;
  cuentaDestinoId: number | null;
  sobreOrigenId: number | null;
  sobreDestinoId?: number | null;
};

function sumar(saldos: SaldosPorId, id: number | null | undefined, centavos: number) {
  if (id !== null && id !== undefined) saldos[id] = (saldos[id] ?? 0) + centavos;
}

/**
 * Saldos de cuentas (en su moneda) y de sobres (en USD) después de aplicar las filas, con las mismas
 * reglas que saldosPorCuenta y saldosPorSobre en src/db/consultas.ts. Sirve para el resumen tras guardar,
 * para el "Antes y después" mientras se escribe y para comprobar el invariante. No modifica los saldos que recibe.
 */
export function saldosTras(filas: FilaQueMueve[], cuentas: SaldosPorId, sobres: SaldosPorId) {
  const c: SaldosPorId = { ...cuentas };
  const s: SaldosPorId = { ...sobres };
  for (const f of filas) {
    const e = efectoDe(f.tipo);
    if (e.saleDeCuenta) sumar(c, f.cuentaOrigenId, -f.montoCentavos);
    if (e.entraACuenta) sumar(c, f.cuentaDestinoId, f.montoDestinoCentavos ?? f.montoCentavos);
    if (e.saleDeSobre) sumar(s, f.sobreOrigenId, -f.montoUsdCentavos);
    if (e.entraASobre) sumar(s, f.sobreDestinoId, f.montoUsdCentavos);
  }
  return { cuentas: c, sobres: s };
}
