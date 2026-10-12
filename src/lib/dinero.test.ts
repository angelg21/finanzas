import { describe, expect, it } from "vitest";
import {
  aCentavos,
  aTasa,
  bolivaresDesdeUsd,
  formatearCentavos,
  formatearEnteros,
  formatearTasa,
  partesCentavos,
  tasaDecimal,
  usdDesdeBolivares,
} from "./dinero";

describe("aCentavos", () => {
  it("acepta formato venezolano con punto de miles y coma decimal", () => {
    expect(aCentavos("1.234,56")).toBe(123_456);
  });
  it("acepta formato con punto decimal", () => {
    expect(aCentavos("1234.56")).toBe(123_456);
    expect(aCentavos("1234,56")).toBe(123_456);
  });
  it("sin coma, un punto solo es decimal: no hay separador de miles", () => {
    expect(aCentavos("2100")).toBe(210_000);
    expect(aCentavos("2.100")).toBe(210);
  });
  it("acepta enteros y espacios", () => {
    expect(aCentavos(" 40 ")).toBe(4_000);
  });
  it("redondea a centavos sin errores de coma flotante", () => {
    expect(aCentavos("0,1")).toBe(10);
    expect(aCentavos("19.99")).toBe(1_999);
  });
  it("rechaza lo que no es número", () => {
    expect(() => aCentavos("abc")).toThrow();
    expect(() => aCentavos("")).toThrow();
  });
});

describe("formatearCentavos y partesCentavos", () => {
  it("formatea con separadores locales y unidad", () => {
    expect(formatearCentavos(123_456)).toBe("1.234,56 USD");
    expect(formatearCentavos(50_000, "VES")).toBe("500,00 Bs");
  });
  it("muestra el signo menos en negativos y lo separa en partes", () => {
    expect(formatearCentavos(-123_456)).toBe("−1.234,56 USD");
    expect(partesCentavos(-5)).toMatchObject({ entero: "0", decimales: "05", negativo: true });
  });
  it("formatearEnteros redondea al dólar", () => {
    expect(formatearEnteros(123_456)).toBe("1.235");
  });
});

describe("aTasa", () => {
  it("devuelve la tasa en diezmilésimas, con coma o punto decimal", () => {
    expect(aTasa("241,8")).toBe(2_418_000);
    expect(aTasa("241.8")).toBe(2_418_000);
    expect(aTasa(" 240 ")).toBe(2_400_000);
    expect(aTasa("36,5432")).toBe(365_432);
  });
  it("redondea a cuatro decimales, que es lo que guarda la base", () => {
    expect(aTasa("241,81236")).toBe(2_418_124);
  });
  it("rechaza vacío, texto, cero y negativo", () => {
    expect(() => aTasa("")).toThrow();
    expect(() => aTasa("abc")).toThrow();
    expect(() => aTasa("0")).toThrow();
    expect(() => aTasa("0,00")).toThrow();
    expect(() => aTasa("0,00001")).toThrow();
    expect(() => aTasa("-5")).toThrow();
  });
  it("rechaza tasas que no caben en numeric(14,4)", () => {
    expect(() => aTasa("10000000000")).toThrow();
  });
});

describe("bolivaresDesdeUsd", () => {
  it("convierte los dólares vendidos a bolívares (criterios 2 y 4)", () => {
    expect(bolivaresDesdeUsd(2_000, 2_418_000)).toBe(483_600);
    expect(bolivaresDesdeUsd(1_000, 2_400_000)).toBe(240_000);
  });
  it("redondea al centavo, las mitades hacia arriba", () => {
    expect(bolivaresDesdeUsd(1, 2_418_000)).toBe(242);
    expect(bolivaresDesdeUsd(1, 5_000)).toBe(1);
  });
  it("0 USD son 0 Bs", () => {
    expect(bolivaresDesdeUsd(0, 2_418_000)).toBe(0);
  });
  it("no acepta montos con decimales ni tasas no positivas", () => {
    expect(() => bolivaresDesdeUsd(10.5, 2_418_000)).toThrow();
    expect(() => bolivaresDesdeUsd(1_000, 0)).toThrow();
    expect(() => bolivaresDesdeUsd(1_000, 241.8)).toThrow();
  });
});

describe("usdDesdeBolivares", () => {
  it("valora en dólares el gasto en bolívares (criterios 2, 3 y 4)", () => {
    expect(usdDesdeBolivares(210_000, 2_418_000)).toBe(868);
    expect(usdDesdeBolivares(50_000, 2_418_000)).toBe(207);
    expect(usdDesdeBolivares(250_000, 2_400_000)).toBe(1_042);
  });
  it("redondea al centavo, las mitades hacia arriba", () => {
    expect(usdDesdeBolivares(5, 100_000)).toBe(1);
    expect(usdDesdeBolivares(4, 100_000)).toBe(0);
  });
  it("0 Bs son 0 USD, y menos de medio centavo también", () => {
    expect(usdDesdeBolivares(0, 2_418_000)).toBe(0);
    expect(usdDesdeBolivares(100, 2_418_000)).toBe(0);
  });
  it("no acepta montos con decimales ni tasas no positivas", () => {
    expect(() => usdDesdeBolivares(0.5, 2_418_000)).toThrow();
    expect(() => usdDesdeBolivares(1_000, -1)).toThrow();
  });
});

describe("tasaDecimal", () => {
  it("escribe la tasa con cuatro decimales y punto, como la guarda la base", () => {
    expect(tasaDecimal(2_418_000)).toBe("241.8000");
    expect(tasaDecimal(365_432)).toBe("36.5432");
    expect(tasaDecimal(12_345_000)).toBe("1234.5000");
    expect(tasaDecimal(1)).toBe("0.0001");
  });
});

describe("formatearTasa", () => {
  it("muestra al menos dos decimales y hasta cuatro, con la unidad", () => {
    expect(formatearTasa(2_418_000)).toBe("241,80 Bs/USD");
    expect(formatearTasa(2_400_000)).toBe("240,00 Bs/USD");
    expect(formatearTasa(365_432)).toBe("36,5432 Bs/USD");
    expect(formatearTasa(2_418_130)).toBe("241,813 Bs/USD");
  });
  it("separa los miles", () => {
    expect(formatearTasa(12_345_000)).toBe("1.234,50 Bs/USD");
  });
});
