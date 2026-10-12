import { describe, expect, it } from "vitest";
import { type EntradaGasto, prepararGasto, sobreSugerido } from "./gastos";

const hoy = "2026-10-11";
const binance = { id: 1, moneda: "USDT" as const };
const bolivares = { id: 5, moneda: "VES" as const };
const gastosDelMes = 2;
const comida = 3;

function entrada(cambios: Partial<EntradaGasto>): EntradaGasto {
  return {
    forma: "dolares",
    monto: "42",
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

function filas(e: EntradaGasto) {
  const resultado = prepararGasto(e, hoy);
  if (!resultado.ok) throw new Error(`Se esperaban filas y hubo errores: ${JSON.stringify(resultado.errores)}`);
  return resultado.filas;
}

function errores(e: EntradaGasto) {
  const resultado = prepararGasto(e, hoy);
  if (resultado.ok) throw new Error("Se esperaban errores y hubo filas");
  return resultado.errores;
}

describe("prepararGasto: gasto en dólares (criterio 1)", () => {
  it("un solo gasto en la moneda de la cuenta, valorado 1 a 1 en USD y sin tasa", () => {
    expect(filas(entrada({}))).toEqual([
      {
        fecha: hoy,
        tipo: "gasto",
        montoCentavos: 4_200,
        moneda: "USDT",
        montoUsdCentavos: 4_200,
        montoDestinoCentavos: null,
        monedaDestino: null,
        tasa: null,
        cuentaOrigenId: 1,
        cuentaDestinoId: null,
        sobreOrigenId: gastosDelMes,
        categoriaId: comida,
        nota: null,
        origen: "manual",
      },
    ]);
  });
  it("si el pago es en dólares la tasa no se pide ni se guarda (criterio 6)", () => {
    expect(filas(entrada({ tasa: "241,8" }))[0].tasa).toBeNull();
    expect(filas(entrada({ tasa: "abc" }))[0].tasa).toBeNull();
  });
  it("no acepta una cuenta en bolívares como cuenta en dólares", () => {
    expect(errores(entrada({ cuentaOrigen: bolivares })).cuenta).toBeDefined();
  });
});

describe("prepararGasto: bolívares vendiendo USDT (criterios 2 y 4)", () => {
  it("una transferencia a Bolívares y un gasto en VES, con la misma fecha y tasa", () => {
    const [transferencia, gasto] = filas(entrada({ forma: "vendiendo", vendido: "20", tasa: "241,8", monto: "2100" }));
    expect(transferencia).toEqual({
      fecha: hoy,
      tipo: "transferencia",
      montoCentavos: 2_000,
      moneda: "USDT",
      montoUsdCentavos: 2_000,
      montoDestinoCentavos: 483_600,
      monedaDestino: "VES",
      tasa: "241.8000",
      cuentaOrigenId: 1,
      cuentaDestinoId: 5,
      sobreOrigenId: null,
      categoriaId: null,
      nota: null,
      origen: "manual",
    });
    expect(gasto).toEqual({
      fecha: hoy,
      tipo: "gasto",
      montoCentavos: 210_000,
      moneda: "VES",
      montoUsdCentavos: 868,
      montoDestinoCentavos: null,
      monedaDestino: null,
      tasa: "241.8000",
      cuentaOrigenId: 5,
      cuentaDestinoId: null,
      sobreOrigenId: gastosDelMes,
      categoriaId: comida,
      nota: null,
      origen: "manual",
    });
    // El vuelto queda en la cuenta Bolívares.
    expect(transferencia.montoDestinoCentavos! - gasto.montoCentavos).toBe(273_600);
  });
  it("si se gasta más de lo recibido, el gasto va completo y Bolívares queda en negativo", () => {
    const [transferencia, gasto] = filas(entrada({ forma: "vendiendo", vendido: "10", tasa: "240", monto: "2500" }));
    expect(transferencia.montoDestinoCentavos).toBe(240_000);
    expect(gasto.montoCentavos).toBe(250_000);
    expect(gasto.montoUsdCentavos).toBe(1_042);
    expect(transferencia.montoDestinoCentavos! - gasto.montoCentavos).toBe(-10_000);
  });
  it("la venta puede salir de cualquier cuenta en dólares, con su moneda", () => {
    const prima = { id: 4, moneda: "USD" as const };
    const [transferencia] = filas(entrada({ forma: "vendiendo", cuentaOrigen: prima, vendido: "20", tasa: "241,8" }));
    expect(transferencia).toMatchObject({ cuentaOrigenId: 4, moneda: "USD", montoCentavos: 2_000 });
  });
  it("exige lo vendido como monto positivo", () => {
    for (const vendido of ["", "0", "-3", "abc"]) {
      expect(errores(entrada({ forma: "vendiendo", vendido, tasa: "241,8", monto: "2100" })).vendido).toBeDefined();
    }
  });
});

describe("prepararGasto: bolívares del saldo (criterio 3)", () => {
  it("un solo gasto desde Bolívares en VES con su tasa", () => {
    expect(filas(entrada({ forma: "saldo", monto: "500", tasa: "241,8" }))).toEqual([
      {
        fecha: hoy,
        tipo: "gasto",
        montoCentavos: 50_000,
        moneda: "VES",
        montoUsdCentavos: 207,
        montoDestinoCentavos: null,
        monedaDestino: null,
        tasa: "241.8000",
        cuentaOrigenId: 5,
        cuentaDestinoId: null,
        sobreOrigenId: gastosDelMes,
        categoriaId: comida,
        nota: null,
        origen: "manual",
      },
    ]);
  });
  it("el repele que vale menos de medio centavo se guarda con 1 centavo de USD (criterio 7)", () => {
    expect(filas(entrada({ forma: "saldo", monto: "1", tasa: "241,8" }))[0].montoUsdCentavos).toBe(1);
  });
  it("sin cuenta en bolívares no hay gasto en bolívares", () => {
    expect(
      errores(entrada({ forma: "saldo", monto: "500", tasa: "241,8", cuentaBolivares: null })).cuenta,
    ).toBeDefined();
  });
});

describe("prepararGasto: montos inválidos (criterio 5)", () => {
  it("rechaza vacío, cero, negativo y texto", () => {
    for (const monto of ["", "  ", "0", "0,00", "-5", "abc"]) {
      expect(errores(entrada({ monto })).monto).toBeDefined();
    }
  });
  it("acepta coma o punto decimal y valen lo mismo", () => {
    expect(filas(entrada({ monto: "1.234,56" }))[0].montoCentavos).toBe(123_456);
    expect(filas(entrada({ monto: "1234.56" }))[0].montoCentavos).toBe(123_456);
  });
  it("rechaza montos que no caben en un entero seguro", () => {
    expect(errores(entrada({ monto: "999999999999999999" })).monto).toBeDefined();
  });
});

describe("prepararGasto: tasa (criterio 6)", () => {
  it("en bolívares rechaza tasa vacía, cero, negativa o texto", () => {
    for (const forma of ["vendiendo", "saldo"] as const) {
      for (const tasa of ["", "0", "-1", "abc"]) {
        expect(errores(entrada({ forma, tasa, vendido: "20", monto: "2100" })).tasa).toBeDefined();
      }
    }
  });
});

describe("prepararGasto: fecha y nota", () => {
  it("rechaza fechas futuras o que no existen (criterio 11)", () => {
    expect(errores(entrada({ fecha: "2026-10-12" })).fecha).toBeDefined();
    expect(errores(entrada({ fecha: "2026-02-30" })).fecha).toBeDefined();
    expect(filas(entrada({ fecha: "2026-10-10" }))[0].fecha).toBe("2026-10-10");
  });
  it("la nota se recorta y vacía es null", () => {
    expect(filas(entrada({ nota: "  " }))[0].nota).toBeNull();
    expect(filas(entrada({ nota: " pan " }))[0].nota).toBe("pan");
  });
  it("informa todos los errores a la vez", () => {
    expect(Object.keys(errores(entrada({ forma: "saldo", monto: "", tasa: "", fecha: "2030-01-01" }))).sort()).toEqual([
      "fecha",
      "monto",
      "tasa",
    ]);
  });
});

describe("sobreSugerido (criterio 8)", () => {
  const sobres = [
    { id: 1, nombre: "Por asignar" },
    { id: 2, nombre: "Gastos del mes" },
    { id: 3, nombre: "Familia" },
    { id: 6, nombre: "Ocasiones" },
    { id: 7, nombre: "Inversión" },
  ];
  it("Familia va a Familia y Regalos a Ocasiones", () => {
    expect(sobreSugerido("Familia", sobres)).toBe(3);
    expect(sobreSugerido("Regalos", sobres)).toBe(6);
  });
  it("cualquier otra categoría va a Gastos del mes", () => {
    expect(sobreSugerido("Comida", sobres)).toBe(2);
    expect(sobreSugerido("Transporte", sobres)).toBe(2);
  });
  it("si el sobre sugerido no existe, no sugiere nada", () => {
    expect(sobreSugerido("Comida", [{ id: 3, nombre: "Familia" }])).toBeNull();
  });
});
