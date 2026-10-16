/**
 * Criterio ★ 9 de la spec 005 (el invariante se mantiene) en lo que cumplen las funciones puras, escrito desde su
 * texto. Las pruebas de construcción viven en saldos.test.ts. Que las sumas de SQL den lo mismo que saldosTras, y que
 * /cuentas siga en "Cuadra" tras cada movimiento, lo comprueba scripts/comprobar-005.ts contra la base.
 */
import { describe, expect, it } from "vitest";
import {
  type FilaQueMueve,
  type TipoMovimiento,
  cambioEnSobre,
  efectoDe,
  saldosTras,
  signoDe,
  tiposCon,
  tiposDeMovimiento,
} from "./saldos";

const binance = 1;
const efectivo = 3;
const porAsignar = 1;
const gastosDelMes = 2;
const deudas = 10;

const suma = (saldos: Record<number, number>) => Object.values(saldos).reduce((a, b) => a + b, 0);

function fila(tipo: TipoMovimiento, monto: number, lados: Partial<FilaQueMueve>): FilaQueMueve {
  return {
    tipo,
    montoCentavos: monto,
    montoUsdCentavos: monto,
    montoDestinoCentavos: null,
    cuentaOrigenId: null,
    cuentaDestinoId: null,
    sobreOrigenId: null,
    sobreDestinoId: null,
    ...lados,
  };
}

describe("★ 9 · el invariante se mantiene", () => {
  it("hay siete tipos, con los tres de deudas", () => {
    expect([...tiposDeMovimiento].sort()).toEqual(
      ["cobro_prestamo", "gasto", "ingreso", "pago_deuda", "prestamo", "reasignacion", "transferencia"].sort(),
    );
  });

  it("pago y préstamo salen de una cuenta y de un sobre; el cobro entra a una cuenta y a un sobre", () => {
    const sale = { saleDeCuenta: true, entraACuenta: false, saleDeSobre: true, entraASobre: false };
    const entra = { saleDeCuenta: false, entraACuenta: true, saleDeSobre: false, entraASobre: true };
    expect(efectoDe("pago_deuda")).toEqual(sale);
    expect(efectoDe("prestamo")).toEqual(sale);
    expect(efectoDe("cobro_prestamo")).toEqual(entra);
  });

  it("todo tipo mueve igual a cuentas que a sobres, o solo entre cuentas, o solo entre sobres", () => {
    for (const tipo of tiposDeMovimiento) {
      const e = efectoDe(tipo);
      const enCuentas = Number(e.entraACuenta) - Number(e.saleDeCuenta);
      const enSobres = Number(e.entraASobre) - Number(e.saleDeSobre);
      expect(enCuentas, tipo).toBe(enSobres);
    }
  });

  it("con los siete tipos, la suma de los sobres sigue igual a la de las cuentas", () => {
    const cuentas = { [binance]: 100_000, [efectivo]: 20_000 };
    const sobres = { [porAsignar]: 30_000, [gastosDelMes]: 50_000, [deudas]: 40_000 };
    expect(suma(sobres)).toBe(suma(cuentas));
    const filas = [
      fila("ingreso", 120_000, { cuentaDestinoId: binance, sobreDestinoId: porAsignar }),
      fila("reasignacion", 38_500, { sobreOrigenId: porAsignar, sobreDestinoId: deudas }),
      fila("gasto", 4_200, { cuentaOrigenId: efectivo, sobreOrigenId: gastosDelMes }),
      fila("transferencia", 10_000, { cuentaOrigenId: binance, cuentaDestinoId: efectivo }),
      fila("pago_deuda", 25_000, { cuentaOrigenId: binance, sobreOrigenId: deudas }),
      fila("prestamo", 8_000, { cuentaOrigenId: efectivo, sobreOrigenId: porAsignar }),
      fila("cobro_prestamo", 3_000, { cuentaDestinoId: binance, sobreDestinoId: porAsignar }),
    ];
    expect(new Set(filas.map((f) => f.tipo)).size).toBe(tiposDeMovimiento.length);
    let estado: { cuentas: Record<number, number>; sobres: Record<number, number> } = { cuentas, sobres };
    for (const f of filas) {
      estado = saldosTras([f], estado.cuentas, estado.sobres);
      expect(suma(estado.sobres), f.tipo).toBe(suma(estado.cuentas));
    }
    expect(estado.sobres[deudas]).toBe(40_000 + 38_500 - 25_000);
  });

  it("un tipo desconocido ya no se trata como reasignación", () => {
    const rara = fila("otro" as TipoMovimiento, 100, { sobreOrigenId: porAsignar, sobreDestinoId: deudas });
    expect(() => saldosTras([rara], {}, { [porAsignar]: 100 })).toThrow();
  });

  it("las sumas de SQL se arman con los mismos lados", () => {
    expect(tiposCon("saleDeCuenta")).toEqual(expect.arrayContaining(["pago_deuda", "prestamo"]));
    expect(tiposCon("saleDeSobre")).toEqual(expect.arrayContaining(["pago_deuda", "prestamo"]));
    expect(tiposCon("entraACuenta")).toContain("cobro_prestamo");
    expect(tiposCon("entraASobre")).toContain("cobro_prestamo");
    expect(tiposCon("entraACuenta")).not.toContain("pago_deuda");
    expect(tiposCon("saleDeCuenta")).not.toContain("cobro_prestamo");
  });

  it("el efecto en un sobre, como en /sobres/[id]", () => {
    const pago = { tipo: "pago_deuda" as const, montoUsdCentavos: 25_000, sobreOrigenId: deudas, sobreDestinoId: null };
    const cobro = {
      tipo: "cobro_prestamo" as const,
      montoUsdCentavos: 3_000,
      sobreOrigenId: null,
      sobreDestinoId: porAsignar,
    };
    const prestamo = {
      tipo: "prestamo" as const,
      montoUsdCentavos: 8_000,
      sobreOrigenId: gastosDelMes,
      sobreDestinoId: null,
    };
    expect(cambioEnSobre(pago, deudas)).toBe(-25_000);
    expect(cambioEnSobre(cobro, porAsignar)).toBe(3_000);
    expect(cambioEnSobre(prestamo, gastosDelMes)).toBe(-8_000);
    expect(cambioEnSobre(pago, porAsignar)).toBe(0);
  });

  it("el signo de las filas: pago y préstamo en negativo, cobro en positivo", () => {
    expect(signoDe("pago_deuda")).toBe(-1);
    expect(signoDe("prestamo")).toBe(-1);
    expect(signoDe("cobro_prestamo")).toBe(1);
    expect(signoDe("gasto")).toBe(-1);
    expect(signoDe("ingreso")).toBe(1);
  });
});
