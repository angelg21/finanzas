import { describe, expect, it } from "vitest";
import { diaAnterior, fechaValida, hoyEnCaracas } from "./fechas";

describe("hoyEnCaracas", () => {
  it("usa la hora de Caracas, no la del servidor", () => {
    // 01:00 UTC del 12 son las 21:00 del 11 en Caracas (UTC−4).
    expect(hoyEnCaracas(new Date("2026-10-12T01:00:00Z"))).toBe("2026-10-11");
    expect(hoyEnCaracas(new Date("2026-10-12T03:59:59Z"))).toBe("2026-10-11");
    expect(hoyEnCaracas(new Date("2026-10-12T04:00:00Z"))).toBe("2026-10-12");
  });
});

describe("diaAnterior", () => {
  it("resta un día cruzando meses y años", () => {
    expect(diaAnterior("2026-10-12")).toBe("2026-10-11");
    expect(diaAnterior("2026-03-01")).toBe("2026-02-28");
    expect(diaAnterior("2024-03-01")).toBe("2024-02-29");
    expect(diaAnterior("2026-01-01")).toBe("2025-12-31");
  });
});

describe("fechaValida (criterio 11)", () => {
  const hoy = "2026-10-11";
  it("acepta hoy y días pasados", () => {
    expect(fechaValida("2026-10-11", hoy)).toBe(true);
    expect(fechaValida("2026-10-10", hoy)).toBe(true);
    expect(fechaValida("2024-02-29", hoy)).toBe(true);
  });
  it("rechaza fechas futuras", () => {
    expect(fechaValida("2026-10-12", hoy)).toBe(false);
    expect(fechaValida("2027-01-01", hoy)).toBe(false);
  });
  it("rechaza lo que no es una fecha real en formato AAAA-MM-DD", () => {
    expect(fechaValida("", hoy)).toBe(false);
    expect(fechaValida("2026-02-30", hoy)).toBe(false);
    expect(fechaValida("2026-13-01", hoy)).toBe(false);
    expect(fechaValida("11/10/2026", hoy)).toBe(false);
    expect(fechaValida("2026-10-1", hoy)).toBe(false);
  });
});
