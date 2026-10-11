import { describe, expect, it } from "vitest";
import { aporteMensualCentavos, totalAnualCentavos } from "./fondos";

describe("totalAnualCentavos", () => {
  it("suma monto por veces al año", () => {
    expect(
      totalAnualCentavos([
        { montoCentavos: 4_000, vecesPorAnio: 1 },
        { montoCentavos: 2_500, vecesPorAnio: 4 },
      ]),
    ).toBe(14_000);
  });
  it("sin partidas es cero", () => {
    expect(totalAnualCentavos([])).toBe(0);
  });
});

describe("aporteMensualCentavos", () => {
  it("divide entre doce y redondea hacia arriba al dólar", () => {
    expect(aporteMensualCentavos(26_000)).toBe(2_200); // 260 / 12 = 21,67 → 22
  });
  it("un total exacto no se infla", () => {
    expect(aporteMensualCentavos(1_200)).toBe(100);
  });
  it("cero da cero", () => {
    expect(aporteMensualCentavos(0)).toBe(0);
  });
});
