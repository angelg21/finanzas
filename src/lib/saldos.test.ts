/**
 * Criterio 9 de la spec 005: el efecto de cada tipo de movimiento se decide en un solo lugar, y con los siete tipos
 * la suma de los sobres sigue igual a la suma de las cuentas. Las sumas de SQL se comparan con saldosTras contra la
 * base en scripts/comprobar-005.ts.
 */
import { describe, expect, it } from "vitest";
import { type FilaQueMueve, type TipoMovimiento, efectoDe, saldosTras, tiposDeMovimiento } from "./saldos";

const binance = 1;
const prima = 2;
const porAsignar = 10;
const gastosDelMes = 11;
const deudas = 12;

const vacia = {
  montoDestinoCentavos: null,
  cuentaOrigenId: null,
  cuentaDestinoId: null,
  sobreOrigenId: null,
  sobreDestinoId: null,
};

function fila(tipo: TipoMovimiento, montoCentavos: number, lados: Partial<FilaQueMueve>): FilaQueMueve {
  return { ...vacia, tipo, montoCentavos, montoUsdCentavos: montoCentavos, ...lados };
}

const suma = (saldos: Record<number, number>) => Object.values(saldos).reduce((a, b) => a + b, 0);

describe("efectoDe: qué lado mueve cada tipo", () => {
  it("cubre los siete tipos, ni uno más", () => {
    expect([...tiposDeMovimiento].sort()).toEqual(
      ["cobro_prestamo", "gasto", "ingreso", "pago_deuda", "prestamo", "reasignacion", "transferencia"].sort(),
    );
  });

  it.each([
    ["ingreso", { saleDeCuenta: false, entraACuenta: true, saleDeSobre: false, entraASobre: true }],
    ["gasto", { saleDeCuenta: true, entraACuenta: false, saleDeSobre: true, entraASobre: false }],
    ["transferencia", { saleDeCuenta: true, entraACuenta: true, saleDeSobre: false, entraASobre: false }],
    ["reasignacion", { saleDeCuenta: false, entraACuenta: false, saleDeSobre: true, entraASobre: true }],
    ["pago_deuda", { saleDeCuenta: true, entraACuenta: false, saleDeSobre: true, entraASobre: false }],
    ["prestamo", { saleDeCuenta: true, entraACuenta: false, saleDeSobre: true, entraASobre: false }],
    ["cobro_prestamo", { saleDeCuenta: false, entraACuenta: true, saleDeSobre: false, entraASobre: true }],
  ] as const)("%s", (tipo, efecto) => {
    expect(efectoDe(tipo)).toEqual(efecto);
  });

  it("todo tipo que toca una cuenta y un sobre los toca por el mismo lado: si sale de uno, sale del otro", () => {
    for (const tipo of tiposDeMovimiento) {
      const e = efectoDe(tipo);
      const tocaAmbos = (e.saleDeCuenta || e.entraACuenta) && (e.saleDeSobre || e.entraASobre);
      if (tocaAmbos) expect([tipo, e.saleDeCuenta, e.entraACuenta]).toEqual([tipo, e.saleDeSobre, e.entraASobre]);
    }
  });

  it("un tipo desconocido lanza en vez de tratarse como reasignación", () => {
    expect(() => efectoDe("regalo" as TipoMovimiento)).toThrow(/regalo/);
  });
});

describe("saldosTras con los tipos de deudas", () => {
  it("un pago de deuda resta de la cuenta en su moneda y del sobre Deudas en USD", () => {
    const pago = fila("pago_deuda", 25_000, { cuentaOrigenId: binance, sobreOrigenId: deudas });
    expect(saldosTras([pago], { [binance]: 60_000 }, { [deudas]: 38_500 })).toEqual({
      cuentas: { [binance]: 35_000 },
      sobres: { [deudas]: 13_500 },
    });
  });

  it("Deudas puede quedar en negativo tras un pago", () => {
    const pago = fila("pago_deuda", 25_000, { cuentaOrigenId: binance, sobreOrigenId: deudas });
    expect(saldosTras([pago], { [binance]: 60_000 }, { [deudas]: 13_500 }).sobres[deudas]).toBe(-11_500);
  });

  it("un préstamo resta de la cuenta y del sobre de origen", () => {
    const prestamo = fila("prestamo", 14_000, { cuentaOrigenId: prima, sobreOrigenId: porAsignar });
    expect(saldosTras([prestamo], { [prima]: 100_000 }, { [porAsignar]: 20_000 })).toEqual({
      cuentas: { [prima]: 86_000 },
      sobres: { [porAsignar]: 6_000 },
    });
  });

  it("un cobro suma a la cuenta de destino y a Por asignar", () => {
    const cobro = fila("cobro_prestamo", 5_000, { cuentaDestinoId: binance, sobreDestinoId: porAsignar });
    expect(saldosTras([cobro], { [binance]: 0 }, { [porAsignar]: 0 })).toEqual({
      cuentas: { [binance]: 5_000 },
      sobres: { [porAsignar]: 5_000 },
    });
  });

  it("los campos que el tipo no usa no mueven nada", () => {
    // Un pago que por error trajera destinos sigue moviendo solo sus orígenes: el efecto lo decide el tipo.
    const pago = fila("pago_deuda", 1_000, {
      cuentaOrigenId: binance,
      sobreOrigenId: deudas,
      cuentaDestinoId: prima,
      sobreDestinoId: porAsignar,
    });
    expect(saldosTras([pago], {}, {})).toEqual({ cuentas: { [binance]: -1_000 }, sobres: { [deudas]: -1_000 } });
  });

  it("una transferencia suma en el destino lo recibido en su moneda, o el monto si no se indica", () => {
    const venta = fila("transferencia", 2_000, { cuentaOrigenId: binance, cuentaDestinoId: 5 });
    expect(saldosTras([{ ...venta, montoDestinoCentavos: 483_600 }], {}, {}).cuentas).toEqual({
      [binance]: -2_000,
      5: 483_600,
    });
    expect(saldosTras([venta], {}, {}).cuentas).toEqual({ [binance]: -2_000, 5: 2_000 });
  });
});

describe("el invariante con los siete tipos (criterio 9)", () => {
  it("cuentas en dólares y sobres siguen sumando lo mismo tras un mes con todos los tipos", () => {
    const cuentas = { [binance]: 50_000, [prima]: 100_000 };
    const sobres = { [porAsignar]: 0, [gastosDelMes]: 90_000, [deudas]: 60_000 };
    expect(suma(sobres)).toBe(suma(cuentas));

    const mes: FilaQueMueve[] = [
      fila("ingreso", 120_000, { cuentaDestinoId: binance, sobreDestinoId: porAsignar }),
      fila("reasignacion", 38_500, { sobreOrigenId: porAsignar, sobreDestinoId: deudas }),
      fila("gasto", 4_200, { cuentaOrigenId: binance, sobreOrigenId: gastosDelMes }),
      fila("transferencia", 30_000, { cuentaOrigenId: prima, cuentaDestinoId: binance }),
      fila("pago_deuda", 25_000, { cuentaOrigenId: binance, sobreOrigenId: deudas }),
      fila("prestamo", 14_000, { cuentaOrigenId: prima, sobreOrigenId: porAsignar }),
      fila("cobro_prestamo", 5_000, { cuentaDestinoId: binance, sobreDestinoId: porAsignar }),
    ];
    expect(new Set(mes.map((f) => f.tipo))).toEqual(new Set(tiposDeMovimiento));

    const despues = saldosTras(mes, cuentas, sobres);
    expect(suma(despues.cuentas)).toBe(150_000 + 120_000 - 4_200 - 25_000 - 14_000 + 5_000);
    expect(suma(despues.sobres)).toBe(suma(despues.cuentas));
  });
});
