import { describe, expect, it } from "vitest";
import { aspectoDeCuenta, aspectoParaElegir, destinoAlEliminarCuenta, validarCuenta } from "./cuentas";

describe("aspectoDeCuenta: el icono y el color de una cuenta salen de su tipo y su moneda", () => {
  it("un aspecto por tipo: exchange, billetera, efectivo, la cuenta de la prima y bolívares", () => {
    expect(aspectoDeCuenta({ tipo: "exchange", moneda: "USDT" })).toBe("cripto");
    expect(aspectoDeCuenta({ tipo: "billetera", moneda: "USDC" })).toBe("billetera");
    expect(aspectoDeCuenta({ tipo: "efectivo", moneda: "USD" })).toBe("efectivo");
    expect(aspectoDeCuenta({ tipo: "transito", moneda: "USD" })).toBe("exterior");
    expect(aspectoDeCuenta({ tipo: "banco", moneda: "VES" })).toBe("bolivares");
  });

  it("los bolívares mandan sobre el tipo: cualquier cuenta en VES es de bolívares", () => {
    expect(aspectoDeCuenta({ tipo: "efectivo", moneda: "VES" })).toBe("bolivares");
    expect(aspectoDeCuenta({ tipo: "billetera", moneda: "VES" })).toBe("bolivares");
  });

  it("un banco en dólares es un banco, y un tipo desconocido también", () => {
    expect(aspectoDeCuenta({ tipo: "banco", moneda: "USD" })).toBe("banco");
    expect(aspectoDeCuenta({ tipo: "otro", moneda: "USD" })).toBe("banco");
  });
});

// Spec 013: administrar cuentas desde la app.
describe("validarCuenta (spec 013, criterios 3 a 5)", () => {
  const existentes = [
    { id: 1, nombre: "Binance", activa: true },
    { id: 2, nombre: "Zinli", activa: false },
  ];
  const nueva = { nombre: "Wally", moneda: "USD", tipo: "billetera", icono: "billetera", color: "turquesa" };

  it("una cuenta nueva válida sale limpia: sin espacios de más", () => {
    const r = validarCuenta({ ...nueva, nombre: "  Wally   Tech " }, existentes);
    expect(r).toEqual({
      ok: true,
      valores: { nombre: "Wally Tech", moneda: "USD", tipo: "billetera", icono: "billetera", color: "turquesa" },
    });
  });

  it("nombre vacío o largo no se guarda", () => {
    expect(validarCuenta({ ...nueva, nombre: "  " }, existentes)).toMatchObject({
      ok: false,
      errores: { nombre: "Escribe un nombre" },
    });
    expect(validarCuenta({ ...nueva, nombre: "x".repeat(41) }, existentes)).toMatchObject({ ok: false });
  });

  it("★ 3: un nombre repetido, sin importar mayúsculas ni acentos, no se guarda; si es archivada, lo dice", () => {
    const activa = validarCuenta({ ...nueva, nombre: "BINANCE" }, existentes);
    expect(activa).toMatchObject({ ok: false, errores: { nombre: "Ya existe una cuenta con ese nombre" } });
    const archivada = validarCuenta({ ...nueva, nombre: "zínli" }, existentes);
    expect(archivada).toMatchObject({ ok: false, errores: { nombre: expect.stringContaining("archivada") } });
  });

  it("al editar, su propio nombre no cuenta como repetido", () => {
    const r = validarCuenta({ ...nueva, nombre: "binance", edicion: { id: 1, moneda: "USD", usos: 3 } }, existentes);
    expect(r.ok).toBe(true);
  });

  it("moneda, tipo, icono y color fuera del catálogo no se guardan", () => {
    const r = validarCuenta({ nombre: "X", moneda: "EUR", tipo: "otro", icono: "nada", color: "#fff" }, existentes);
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(Object.keys(r.errores).sort()).toEqual(["color", "icono", "moneda", "tipo"]);
  });

  it("★ 5: con movimientos la moneda no cambia; sin ellos, sí", () => {
    const con = validarCuenta({ ...nueva, moneda: "VES", edicion: { id: 9, moneda: "USD", usos: 1 } }, existentes);
    expect(con).toMatchObject({ ok: false, errores: { moneda: "Tiene movimientos: la moneda no cambia" } });
    const sin = validarCuenta({ ...nueva, moneda: "VES", edicion: { id: 9, moneda: "USD", usos: 0 } }, existentes);
    expect(sin.ok).toBe(true);
  });
});

describe("destinoAlEliminarCuenta (spec 013, criterios 7 a 9)", () => {
  it("★ 7: con saldo no se elimina, tampoco si solo el equivalente en USD no es 0", () => {
    expect(destinoAlEliminarCuenta({ usos: 4, saldoCentavos: 100, saldoUsdCentavos: 100 })).toBe("con-saldo");
    expect(destinoAlEliminarCuenta({ usos: 4, saldoCentavos: 0, saldoUsdCentavos: -3 })).toBe("con-saldo");
    expect(destinoAlEliminarCuenta({ usos: 0, saldoCentavos: -1, saldoUsdCentavos: 0 })).toBe("con-saldo");
  });

  it("★ 8 y 9: en 0, sin usos se borra y con historial se archiva", () => {
    expect(destinoAlEliminarCuenta({ usos: 0, saldoCentavos: 0, saldoUsdCentavos: 0 })).toBe("borrar");
    expect(destinoAlEliminarCuenta({ usos: 2, saldoCentavos: 0, saldoUsdCentavos: 0 })).toBe("archivar");
  });
});

describe("aspectoParaElegir (spec 013, criterio 6)", () => {
  it("con icono y color elegidos, esos; sin ellos, el equivalente de su aspecto automático en el catálogo", () => {
    expect(aspectoParaElegir({ tipo: "exchange", moneda: "USDT", icono: "tarjeta", color: "rosa" })).toEqual({
      icono: "tarjeta",
      color: "rosa",
    });
    expect(aspectoParaElegir({ tipo: "exchange", moneda: "USDT", icono: null, color: null })).toEqual({
      icono: "bitcoin",
      color: "ambar",
    });
    expect(aspectoParaElegir({ tipo: "banco", moneda: "VES", icono: null, color: null }).color).toBe("coral");
  });
});
