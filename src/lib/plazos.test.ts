/**
 * El subtítulo de una deuda en /deudas (spec 005, pantallas): "para el 15 dic", "vence en 3 días", "vencida hace 2
 * días" o "sin fecha".
 */
import { describe, expect, it } from "vitest";
import { plazoDeDeuda } from "./plazos";

const hoy = "2026-10-15";

describe("plazoDeDeuda", () => {
  it("sin fecha", () => {
    expect(plazoDeDeuda(null, hoy)).toBe("sin fecha");
  });

  it("hoy, mañana y dentro de la semana, en días", () => {
    expect(plazoDeDeuda("2026-10-15", hoy)).toBe("vence hoy");
    expect(plazoDeDeuda("2026-10-16", hoy)).toBe("vence mañana");
    expect(plazoDeDeuda("2026-10-18", hoy)).toBe("vence en 3 días");
    expect(plazoDeDeuda("2026-10-22", hoy)).toBe("vence en 7 días");
  });

  it("más lejos, la fecha", () => {
    expect(plazoDeDeuda("2026-10-23", hoy)).toBe("para el 23 oct");
    expect(plazoDeDeuda("2026-12-15", hoy)).toBe("para el 15 dic");
  });

  it("de otro año, con el año", () => {
    expect(plazoDeDeuda("2027-01-10", hoy)).toBe("para el 10 ene 2027");
  });

  it("vencida, en días", () => {
    expect(plazoDeDeuda("2026-10-14", hoy)).toBe("vencida ayer");
    expect(plazoDeDeuda("2026-10-13", hoy)).toBe("vencida hace 2 días");
    expect(plazoDeDeuda("2026-08-01", hoy)).toBe("vencida hace 75 días");
  });
});
