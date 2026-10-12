/**
 * Criterios ★ de la spec 001 (captura rápida de gasto) que cumple prepararGasto, escritos desde el texto
 * de cada criterio. Las pruebas de construcción viven en gastos.test.ts; estas fijan lo que la spec promete.
 * Lo que solo se ve en la base (una transacción, el cuadre de /cuentas) lo comprueba scripts/comprobar-001.ts.
 */
import { describe, expect, it } from "vitest";
import { type CuentaGasto, type EntradaGasto, type FilaMovimiento, prepararGasto, saldosTras } from "./gastos";

const hoy = "2026-10-12";
const binance: CuentaGasto = { id: 1, moneda: "USDT" };
const prima: CuentaGasto = { id: 4, moneda: "USD" };
const bolivares: CuentaGasto = { id: 5, moneda: "VES" };
const gastosDelMes = 2;
const ocasiones = 6;
const comida = 3;
const transporte = 4;

function gasto(cambios: Partial<EntradaGasto>): EntradaGasto {
  return {
    forma: "dolares",
    monto: "",
    tasa: "",
    vendido: "",
    cuentaOrigen: binance,
    cuentaBolivares: bolivares,
    sobreId: gastosDelMes,
    categoriaId: comida,
    fecha: hoy,
    nota: "",
    ...cambios,
  };
}

function guardar(cambios: Partial<EntradaGasto>): FilaMovimiento[] {
  const resultado = prepararGasto(gasto(cambios), hoy);
  if (!resultado.ok) throw new Error(`Se esperaba guardar y hubo errores: ${JSON.stringify(resultado.errores)}`);
  return resultado.filas;
}

/** Errores por campo de un gasto que no debe crear ningún movimiento. */
function rechazar(cambios: Partial<EntradaGasto>) {
  const resultado = prepararGasto(gasto(cambios), hoy);
  if (resultado.ok) throw new Error(`No debía guardarse y dio ${resultado.filas.length} movimientos`);
  return resultado.errores;
}

function unaDe(filas: FilaMovimiento[], tipo: FilaMovimiento["tipo"]): FilaMovimiento {
  const deEseTipo = filas.filter((f) => f.tipo === tipo);
  expect(deEseTipo).toHaveLength(1);
  return deEseTipo[0];
}

const suma = (saldos: Record<number, number>) => Object.values(saldos).reduce((a, b) => a + b, 0);

/** Cuentas en dólares (1 a 1 en USD) y sobres que cuadran: los dos suman 60.000 centavos. */
const cuadrados = {
  cuentas: { [binance.id]: 50_000, [prima.id]: 10_000 },
  sobres: { [gastosDelMes]: 45_000, [ocasiones]: 15_000 },
};

describe("★ criterio 1: gasto en dólares", () => {
  it("42 desde Binance en Comida es un gasto de 4200 USDT que vale 4200 USD, manual y sin tasa", () => {
    const filas = guardar({ monto: "42" });
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      fecha: hoy,
      tipo: "gasto",
      montoCentavos: 4_200,
      moneda: "USDT",
      montoUsdCentavos: 4_200,
      cuentaOrigenId: binance.id,
      sobreOrigenId: gastosDelMes,
      categoriaId: comida,
      origen: "manual",
      tasa: null,
    });
  });

  it("la suma de los sobres sigue igual a la suma en USD de las cuentas", () => {
    const despues = saldosTras(guardar({ monto: "42" }), cuadrados.cuentas, cuadrados.sobres);
    expect(suma(despues.cuentas)).toBe(60_000 - 4_200);
    expect(suma(despues.sobres)).toBe(suma(despues.cuentas));
  });
});

describe("★ criterio 2: bolívares vendiendo USDT", () => {
  const venta = () => guardar({ forma: "vendiendo", vendido: "20", tasa: "241,8", monto: "2100" });

  it("son dos movimientos con la misma fecha: la transferencia de la venta y el gasto", () => {
    const filas = venta();
    expect(filas.map((f) => f.tipo).sort()).toEqual(["gasto", "transferencia"]);
    expect(filas.every((f) => f.fecha === hoy)).toBe(true);
  });

  it("la transferencia lleva 20 USDT de Binance a Bolívares, 483600 centavos de Bs a 241.8000", () => {
    expect(unaDe(venta(), "transferencia")).toMatchObject({
      cuentaOrigenId: binance.id,
      cuentaDestinoId: bolivares.id,
      montoCentavos: 2_000,
      moneda: "USDT",
      montoUsdCentavos: 2_000,
      montoDestinoCentavos: 483_600,
      monedaDestino: "VES",
      tasa: "241.8000",
    });
  });

  it("el gasto son 2100 Bs desde Bolívares, que valen 868 centavos USD, en Comida y Gastos del mes", () => {
    expect(unaDe(venta(), "gasto")).toMatchObject({
      cuentaOrigenId: bolivares.id,
      montoCentavos: 210_000,
      moneda: "VES",
      montoUsdCentavos: 868,
      tasa: "241.8000",
      sobreOrigenId: gastosDelMes,
      categoriaId: comida,
    });
  });

  it("de vuelto quedan 273600 centavos de Bs en la cuenta Bolívares", () => {
    const despues = saldosTras(venta(), { [binance.id]: 10_000, [bolivares.id]: 0 }, { [gastosDelMes]: 10_000 });
    expect(despues.cuentas[bolivares.id]).toBe(273_600);
  });
});

describe("★ criterio 3: bolívares del saldo", () => {
  it("500 Bs a 241,8 en Transporte es un solo gasto desde Bolívares que vale 207 centavos USD", () => {
    const filas = guardar({ forma: "saldo", monto: "500", tasa: "241,8", categoriaId: transporte });
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      tipo: "gasto",
      cuentaOrigenId: bolivares.id,
      montoCentavos: 50_000,
      moneda: "VES",
      montoUsdCentavos: 207,
      tasa: "241.8000",
      categoriaId: transporte,
    });
  });
});

describe("★ criterio 4: gastar más bolívares de los recibidos", () => {
  const venta = () => guardar({ forma: "vendiendo", vendido: "10", tasa: "240", monto: "2500" });

  it("el gasto se registra completo: 250000 centavos de Bs que valen 1042 centavos USD", () => {
    expect(unaDe(venta(), "gasto")).toMatchObject({ montoCentavos: 250_000, moneda: "VES", montoUsdCentavos: 1_042 });
  });

  it("la venta da 2400 Bs y Bolívares queda en −10000 centavos de Bs, el saldo que dispara el aviso", () => {
    expect(unaDe(venta(), "transferencia").montoDestinoCentavos).toBe(240_000);
    const despues = saldosTras(venta(), { [binance.id]: 10_000, [bolivares.id]: 0 }, { [gastosDelMes]: 10_000 });
    expect(despues.cuentas[bolivares.id]).toBe(-10_000);
  });
});

describe("★ criterio 5: montos inválidos", () => {
  const formas = {
    dolares: {},
    vendiendo: { vendido: "20", tasa: "241,8" },
    saldo: { tasa: "241,8" },
  } as const;
  const casos = Object.entries(formas).flatMap(([forma, resto]) =>
    ["", "0", "-5", "abc", "doce"].map((monto) => [forma, monto, resto] as const),
  );

  it.each(casos)("pagando %s, el monto %j no crea nada y el error sale junto al monto", (forma, monto, resto) => {
    const errores = rechazar({ forma: forma as EntradaGasto["forma"], monto, ...resto });
    expect(errores.monto).toEqual(expect.any(String));
  });

  it.each(["", "0", "-20", "abc"])("el monto vendido %j tampoco se acepta", (vendido) => {
    const errores = rechazar({ forma: "vendiendo", vendido, tasa: "241,8", monto: "2100" });
    expect(errores.vendido).toEqual(expect.any(String));
  });

  it("1234.56, 1234,56 y 1.234,56 se aceptan y valen lo mismo", () => {
    for (const monto of ["1234.56", "1234,56", "1.234,56"]) {
      expect(guardar({ monto })[0].montoCentavos).toBe(123_456);
    }
  });

  it("2.100 vale 2,10: sin coma, el punto es decimal", () => {
    expect(guardar({ monto: "2.100" })[0].montoCentavos).toBe(210);
  });
});

describe("★ criterio 6: tasa", () => {
  it.each([
    ["vendiendo", ""],
    ["vendiendo", "0"],
    ["vendiendo", "-241,8"],
    ["saldo", ""],
    ["saldo", "0"],
    ["saldo", "-241,8"],
    ["vendiendo", "0,4"],
    ["saldo", "0,4"],
    ["saldo", "0,9999"],
  ] as const)("pagando en bolívares (%s), la tasa %j no guarda nada y da error", (forma, tasa) => {
    const errores = rechazar({ forma, tasa, vendido: "20", monto: "2100" });
    expect(errores.tasa).toEqual(expect.any(String));
  });

  it("la tasa mínima es 1: con 1 se guarda", () => {
    expect(guardar({ forma: "saldo", monto: "500", tasa: "1" })[0]).toMatchObject({
      tasa: "1.0000",
      montoUsdCentavos: 50_000,
    });
  });

  it("se escribe como los montos, con coma o punto, y se guarda con cuatro decimales", () => {
    for (const tasa of ["241,8", "241.8"]) {
      expect(guardar({ forma: "saldo", monto: "500", tasa })[0].tasa).toBe("241.8000");
    }
    expect(guardar({ forma: "saldo", monto: "500", tasa: "36,5" })[0].tasa).toBe("36.5000");
    expect(guardar({ forma: "saldo", monto: "500", tasa: "241,8123" })[0].tasa).toBe("241.8123");
  });

  it("si el pago es en dólares la tasa no se pide ni se guarda", () => {
    for (const tasa of ["", "241,8", "abc"]) {
      expect(guardar({ monto: "42", tasa })[0].tasa).toBeNull();
    }
  });
});

describe("★ criterio 7: el mínimo de un centavo", () => {
  it("1 Bs a 241,8 redondea a 0 USD y se guarda con monto_usd_centavos = 1", () => {
    expect(guardar({ forma: "saldo", monto: "1", tasa: "241,8" })[0]).toMatchObject({
      montoCentavos: 100,
      montoUsdCentavos: 1,
    });
  });

  it("ningún monto de las filas tiene decimales", () => {
    const filas = [
      ...guardar({ monto: "19,99" }),
      ...guardar({ forma: "vendiendo", vendido: "20", tasa: "241,8123", monto: "2100,37" }),
      ...guardar({ forma: "saldo", monto: "0,01", tasa: "36,5" }),
    ];
    for (const f of filas) {
      for (const valor of [f.montoCentavos, f.montoUsdCentavos, f.montoDestinoCentavos ?? 0]) {
        expect(Number.isSafeInteger(valor)).toBe(true);
      }
    }
  });
});

describe("★ criterio 16: cuenta de la prima", () => {
  it("un gasto en Dólares desde la Cuenta prima se registra como desde cualquier otra cuenta", () => {
    const desdeBinance = guardar({ monto: "42" });
    const desdePrima = guardar({ monto: "42", cuentaOrigen: prima });
    expect(desdePrima).toEqual(desdeBinance.map((f) => ({ ...f, cuentaOrigenId: prima.id, moneda: prima.moneda })));
  });

  it("su saldo entra en el cuadre: tras el gasto, sobres y cuentas siguen sumando lo mismo", () => {
    const despues = saldosTras(guardar({ monto: "42", cuentaOrigen: prima }), cuadrados.cuentas, cuadrados.sobres);
    expect(despues.cuentas[prima.id]).toBe(10_000 - 4_200);
    expect(suma(despues.sobres)).toBe(suma(despues.cuentas));
  });
});
