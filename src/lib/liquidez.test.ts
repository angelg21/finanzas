/**
 * Criterio 14 de la spec 005: si el dinero para cada deuda está en la cuenta con la que se piensa pagar. El aviso no
 * resuelve nada: dice dónde está el dinero.
 */
import { describe, expect, it } from "vitest";
import { type CuentaParaLiquidez, type DeudaParaLiquidez, avisosDeLiquidez } from "./liquidez";

const binance: CuentaParaLiquidez = { id: 1, nombre: "Binance", moneda: "USDT", saldoCentavos: 60_000 };
const prima: CuentaParaLiquidez = { id: 4, nombre: "Prima", moneda: "USD", saldoCentavos: 83_000 };
const bolivares: CuentaParaLiquidez = { id: 5, nombre: "Bolívares", moneda: "VES", saldoCentavos: 9_000_000 };
const cuentas = [binance, prima, bolivares];

const amigo: DeudaParaLiquidez = {
  id: 10,
  sentido: "debo",
  pendienteCentavos: 25_000,
  fechaPrevista: "2026-10-22",
  cuentaPrevistaId: binance.id,
};
const papas: DeudaParaLiquidez = {
  id: 11,
  sentido: "debo",
  pendienteCentavos: 52_000,
  fechaPrevista: "2026-12-15",
  cuentaPrevistaId: binance.id,
};

const estados = (avisos: ReturnType<typeof avisosDeLiquidez>) =>
  Object.fromEntries([...avisos].map(([id, a]) => [id, a.estado]));

describe("avisosDeLiquidez: los tres estados (criterio 14)", () => {
  it("el ejemplo acumulado: Binance en 600,00 y 1.430,00 en total; el amigo está lista y Papás en otra cuenta", () => {
    const avisos = avisosDeLiquidez({ deudas: [papas, amigo], cuentas });
    expect(avisos.get(amigo.id)).toEqual({ estado: "lista", texto: null });
    expect(avisos.get(papas.id)).toEqual({
      estado: "en_otra_cuenta",
      texto: "Tienes 1.430,00 USD, pero en Binance solo 350,00 USDT",
    });
  });

  it("el ejemplo del plan: Binance con 80,00 USDT y una deuda de 250,00", () => {
    const avisos = avisosDeLiquidez({ deudas: [amigo], cuentas: [{ ...binance, saldoCentavos: 8_000 }, prima] });
    expect(avisos.get(amigo.id)?.texto).toBe("Tienes 910,00 USD, pero en Binance solo 80,00 USDT");
  });

  it("falta: no alcanza ni la suma de las cuentas en dólares, y los bolívares no cuentan", () => {
    const pobres = [{ ...binance, saldoCentavos: 10_000 }, { ...prima, saldoCentavos: 3_000 }, bolivares];
    const avisos = avisosDeLiquidez({ deudas: [amigo], cuentas: pobres });
    expect(avisos.get(amigo.id)).toEqual({ estado: "falta", texto: "Te faltan 120,00 para esta deuda" });
  });

  it("justo lo necesario en la cuenta prevista está lista", () => {
    const avisos = avisosDeLiquidez({ deudas: [amigo], cuentas: [{ ...binance, saldoCentavos: 25_000 }] });
    expect(avisos.get(amigo.id)?.estado).toBe("lista");
  });
});

describe("avisosDeLiquidez: el acumulado y el orden", () => {
  it("acumula por cuenta: dos deudas en cuentas distintas no se estorban", () => {
    const enPrima = { ...papas, cuentaPrevistaId: prima.id };
    expect(estados(avisosDeLiquidez({ deudas: [amigo, enPrima], cuentas }))).toEqual({
      [amigo.id]: "lista",
      [papas.id]: "lista",
    });
  });

  it("ordena por fecha sin importar cómo lleguen, y las que no tienen fecha van al final", () => {
    const sinFecha = { ...amigo, id: 12, fechaPrevista: null, pendienteCentavos: 30_000 };
    // Sin fecha va al final: Papás (diciembre) toma 520 de los 600 y la sin fecha ya no cabe en Binance.
    expect(estados(avisosDeLiquidez({ deudas: [sinFecha, papas], cuentas }))).toEqual({
      [papas.id]: "lista",
      [sinFecha.id]: "en_otra_cuenta",
    });
  });

  it("la suma de las cuentas se compara con lo acumulado de todas las deudas hasta esta", () => {
    const grande = { ...papas, cuentaPrevistaId: prima.id, pendienteCentavos: 120_000 };
    const avisos = avisosDeLiquidez({ deudas: [amigo, grande], cuentas });
    // 250 + 1.200 = 1.450 pasa de 1.430: a la segunda le faltan 20,00.
    expect(avisos.get(grande.id)).toEqual({ estado: "falta", texto: "Te faltan 20,00 para esta deuda" });
  });

  it("lo que falta para una deuda nunca pasa de su pendiente", () => {
    const vacias = [
      { ...binance, saldoCentavos: 0 },
      { ...prima, saldoCentavos: 0 },
    ];
    const avisos = avisosDeLiquidez({ deudas: [amigo, papas], cuentas: vacias });
    expect(avisos.get(amigo.id)?.texto).toBe("Te faltan 250,00 para esta deuda");
    expect(avisos.get(papas.id)?.texto).toBe("Te faltan 520,00 para esta deuda");
  });

  it("si las deudas anteriores se llevan todo lo de la cuenta, dice que solo queda 0,00", () => {
    const grande = { ...amigo, pendienteCentavos: 70_000 };
    expect(avisosDeLiquidez({ deudas: [grande, papas], cuentas }).get(papas.id)?.texto).toBe(
      "Tienes 1.430,00 USD, pero en Binance solo 0,00 USDT",
    );
  });
});

describe("avisosDeLiquidez: qué deudas mira", () => {
  it("solo las abiertas que debo con cuenta prevista activa", () => {
    const deudas = [
      { ...amigo, id: 20, cuentaPrevistaId: null },
      { ...amigo, id: 21, sentido: "me_deben" as const },
      { ...amigo, id: 22, pendienteCentavos: 0 },
      { ...amigo, id: 23, cuentaPrevistaId: 99 },
    ];
    expect(avisosDeLiquidez({ deudas, cuentas }).size).toBe(0);
  });

  it("una pagada no consume lo de la cuenta", () => {
    const pagada = { ...amigo, id: 24, pendienteCentavos: 0, fechaPrevista: "2026-10-01" };
    const cabe = { ...papas, pendienteCentavos: 60_000 };
    expect(estados(avisosDeLiquidez({ deudas: [pagada, cabe], cuentas }))).toEqual({ [papas.id]: "lista" });
  });

  it("un pendiente inválido lanza", () => {
    expect(() => avisosDeLiquidez({ deudas: [{ ...amigo, pendienteCentavos: -1 }], cuentas })).toThrow(RangeError);
  });
});
