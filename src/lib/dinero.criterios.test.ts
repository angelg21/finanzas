/**
 * Criterio ★ 7 de la spec 001: la conversión entre dólares y bolívares es exacta en centavos.
 * Escrito desde el texto del criterio; las pruebas de construcción viven en dinero.test.ts.
 */
import { describe, expect, it } from "vitest";
import { aTasa, bolivaresDesdeUsd, usdDesdeBolivares } from "./dinero";

const a241 = aTasa("241,8");

describe("★ criterio 7: la aritmética de conversión es exacta en centavos", () => {
  it("Bs = redondeo(centavos USD × tasa)", () => {
    expect(bolivaresDesdeUsd(2_000, a241)).toBe(483_600);
    expect(bolivaresDesdeUsd(1_000, aTasa("240"))).toBe(240_000);
    expect(bolivaresDesdeUsd(1, a241)).toBe(242); // 241,8
    expect(bolivaresDesdeUsd(3, aTasa("36,3333"))).toBe(109); // 108,9999
  });

  it("USD = redondeo(centavos Bs ÷ tasa)", () => {
    expect(usdDesdeBolivares(210_000, a241)).toBe(868); // 868,49
    expect(usdDesdeBolivares(50_000, a241)).toBe(207); // 206,78
    expect(usdDesdeBolivares(250_000, aTasa("240"))).toBe(1_042); // 1041,67
    expect(usdDesdeBolivares(100, a241)).toBe(0); // 0,41: el mínimo de 1 centavo lo pone el gasto, no la conversión
  });

  it("0 Bs son 0 USD, y 0 USD son 0 Bs", () => {
    for (const tasa of ["1", "36,5", "241,8"]) {
      expect(usdDesdeBolivares(0, aTasa(tasa))).toBe(0);
      expect(bolivaresDesdeUsd(0, aTasa(tasa))).toBe(0);
    }
  });

  it("nunca hay flotantes: el resultado es entero y queda a medio centavo o menos del valor exacto", () => {
    // La tasa llega en diezmilésimas, así que el valor exacto es una fracción de enteros:
    //   Bs  = usd × tasaDm / 10000      →  |bs × 10000 − usd × tasaDm| ≤ 5000
    //   USD = bs × 10000 / tasaDm       →  2 × |usd × tasaDm − bs × 10000| ≤ tasaDm
    for (const texto of ["1", "36,5", "36,3333", "241,8", "241,8123", "4567,0001", "0,0001"]) {
      const tasaDm = aTasa(texto);
      for (let centavos = 0; centavos <= 3_000; centavos += 7) {
        const bs = bolivaresDesdeUsd(centavos, tasaDm);
        expect(Number.isSafeInteger(bs)).toBe(true);
        expect(Math.abs(bs * 10_000 - centavos * tasaDm)).toBeLessThanOrEqual(5_000);

        const usd = usdDesdeBolivares(centavos, tasaDm);
        expect(Number.isSafeInteger(usd)).toBe(true);
        expect(2 * Math.abs(usd * tasaDm - centavos * 10_000)).toBeLessThanOrEqual(tasaDm);
      }
    }
  });
});
