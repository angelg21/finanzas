import { describe, expect, it } from "vitest";
import { aCentavos, formatearCentavos, formatearEnteros, partesCentavos } from "./dinero";

describe("aCentavos", () => {
  it("acepta formato venezolano con punto de miles y coma decimal", () => {
    expect(aCentavos("1.234,56")).toBe(123_456);
  });
  it("acepta formato con punto decimal", () => {
    expect(aCentavos("1234.56")).toBe(123_456);
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
