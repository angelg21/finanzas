/**
 * Criterio ★ 14 de la spec 005 (aviso de liquidez), escrito desde su texto. Las pruebas de construcción viven en
 * liquidez.test.ts; estas fijan los tres estados, el orden por fecha, lo acumulado por cuenta y los textos.
 */
import { describe, expect, it } from "vitest";
import { type CuentaParaLiquidez, type DeudaParaLiquidez, avisosDeLiquidez } from "./liquidez";

const binance = (saldoCentavos: number): CuentaParaLiquidez => ({
  id: 1,
  nombre: "Binance",
  moneda: "USDT",
  saldoCentavos,
});
const efectivo = (saldoCentavos: number): CuentaParaLiquidez => ({
  id: 3,
  nombre: "Efectivo",
  moneda: "USD",
  saldoCentavos,
});
const prima = (saldoCentavos: number): CuentaParaLiquidez => ({
  id: 4,
  nombre: "Cuenta prima",
  moneda: "USD",
  saldoCentavos,
});

function debo(id: number, pendienteCentavos: number, fechaPrevista: string | null, cuentaPrevistaId: number | null) {
  return { id, sentido: "debo", pendienteCentavos, fechaPrevista, cuentaPrevistaId } satisfies DeudaParaLiquidez;
}

const amigo = debo(1, 25_000, "2026-10-22", 1);
const papas = debo(2, 52_000, "2026-12-15", 1);

describe("★ 14 · aviso de liquidez", () => {
  it("el ejemplo acumulado: con Binance en 600,00 y 1.430,00 en total, el amigo está listo y Papás en otra cuenta", () => {
    const avisos = avisosDeLiquidez({ deudas: [amigo, papas], cuentas: [binance(60_000), prima(83_000)] });
    expect(avisos.get(amigo.id)).toEqual({ estado: "lista", texto: null });
    expect(avisos.get(papas.id)?.estado).toBe("en_otra_cuenta");
    expect(avisos.get(papas.id)?.texto).toMatch(/^Tienes 1\.430,00 USD, pero en Binance solo [\d.,]+ USDT$/);
  });

  it('el texto de "en otra cuenta", con el ejemplo del plan', () => {
    const avisos = avisosDeLiquidez({ deudas: [amigo], cuentas: [binance(8_000), prima(135_000)] });
    expect(avisos.get(amigo.id)).toEqual({
      estado: "en_otra_cuenta",
      texto: "Tienes 1.430,00 USD, pero en Binance solo 80,00 USDT",
    });
  });

  it('"falta" cuando no alcanza ni la suma de las cuentas en dólares: "Te faltan 120,00 para esta deuda"', () => {
    const grande = debo(5, 155_000, "2026-12-15", 1);
    const avisos = avisosDeLiquidez({ deudas: [grande], cuentas: [binance(60_000), prima(83_000)] });
    expect(avisos.get(grande.id)).toEqual({ estado: "falta", texto: "Te faltan 120,00 para esta deuda" });
  });

  it("lista cuando el saldo de la cuenta prevista, 1 a 1, cubre lo acumulado en ella", () => {
    const avisos = avisosDeLiquidez({ deudas: [amigo, papas], cuentas: [binance(77_000)] });
    expect(avisos.get(amigo.id)?.estado).toBe("lista");
    expect(avisos.get(papas.id)?.estado).toBe("lista");
  });

  it("ordena por fecha, con las que no tienen fecha al final, aunque lleguen en otro orden", () => {
    const sinFecha = debo(3, 40_000, null, 1);
    const octubre = debo(4, 30_000, "2026-10-30", 1);
    const avisos = avisosDeLiquidez({ deudas: [sinFecha, papas, octubre], cuentas: [binance(60_000), prima(150_000)] });
    // Octubre toma 300,00 de los 600,00; Papás ya no cabe; la sin fecha, después de todas, tampoco.
    expect(avisos.get(octubre.id)?.estado).toBe("lista");
    expect(avisos.get(papas.id)?.estado).toBe("en_otra_cuenta");
    expect(avisos.get(sinFecha.id)?.estado).toBe("en_otra_cuenta");
  });

  it("acumula por cuenta: lo que se paga desde otra cuenta no le quita a esta", () => {
    const deBinance = debo(6, 50_000, "2026-10-20", 1);
    const deEfectivo = debo(7, 20_000, "2026-11-10", 3);
    const otraDeBinance = debo(8, 10_000, "2026-12-01", 1);
    const avisos = avisosDeLiquidez({
      deudas: [deBinance, deEfectivo, otraDeBinance],
      cuentas: [binance(60_000), efectivo(20_000)],
    });
    expect(avisos.get(deBinance.id)?.estado).toBe("lista");
    expect(avisos.get(deEfectivo.id)?.estado).toBe("lista");
    expect(avisos.get(otraDeBinance.id)?.estado).toBe("lista");
  });

  it("los bolívares no cuentan en la suma de las cuentas en dólares", () => {
    const bolivares: CuentaParaLiquidez = { id: 5, nombre: "Bolívares", moneda: "VES", saldoCentavos: 100_000_000 };
    const avisos = avisosDeLiquidez({ deudas: [amigo], cuentas: [binance(10_000), bolivares] });
    expect(avisos.get(amigo.id)).toEqual({ estado: "falta", texto: "Te faltan 150,00 para esta deuda" });
  });

  it("solo mira las abiertas que debo con cuenta prevista", () => {
    const sinCuenta = debo(9, 99_000, "2026-10-20", null);
    const pagada = debo(10, 0, "2026-10-20", 1);
    const meDeben: DeudaParaLiquidez = { ...debo(11, 99_000, "2026-10-20", null), sentido: "me_deben" };
    const avisos = avisosDeLiquidez({ deudas: [sinCuenta, pagada, meDeben], cuentas: [binance(0)] });
    expect(avisos.size).toBe(0);
  });
});
