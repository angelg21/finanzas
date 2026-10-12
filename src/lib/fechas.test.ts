import { describe, expect, it } from "vitest";
import {
  celdasDelMes,
  diaAnterior,
  etiquetaFecha,
  fechaLarga,
  fechaValida,
  hoyEnCaracas,
  mesDe,
  moverMes,
  nombreMes,
} from "./fechas";

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

describe("celdasDelMes: la cuadrícula del calendario, de lunes a domingo", () => {
  it("octubre de 2026 empieza en jueves: tres huecos antes del 1", () => {
    const celdas = celdasDelMes(2026, 10);
    expect(celdas.slice(0, 4)).toEqual([null, null, null, "2026-10-01"]);
    expect(celdas[33]).toBe("2026-10-31");
    expect(celdas.length % 7).toBe(0);
    expect(celdas.filter(Boolean)).toHaveLength(31);
  });
  it("febrero de 2026 empieza en domingo y tiene 28 días", () => {
    const celdas = celdasDelMes(2026, 2);
    expect(celdas.indexOf("2026-02-01")).toBe(6);
    expect(celdas.filter(Boolean)).toHaveLength(28);
  });
  it("un mes que empieza en lunes no lleva huecos", () => {
    expect(celdasDelMes(2026, 6)[0]).toBe("2026-06-01");
  });
});

describe("moverMes", () => {
  it("cruza el año en los dos sentidos", () => {
    expect(moverMes({ anio: 2026, mes: 1 }, -1)).toEqual({ anio: 2025, mes: 12 });
    expect(moverMes({ anio: 2025, mes: 12 }, 1)).toEqual({ anio: 2026, mes: 1 });
    expect(moverMes({ anio: 2026, mes: 10 }, -3)).toEqual({ anio: 2026, mes: 7 });
  });
});

describe("nombres de fechas en español", () => {
  it("nombreMes", () => {
    expect(nombreMes(10)).toBe("Octubre");
  });
  it("etiquetaFecha corta para la píldora", () => {
    expect(etiquetaFecha("2026-10-09")).toBe("Vie 9 oct");
    expect(etiquetaFecha("2026-10-11")).toBe("Dom 11 oct");
  });
  it("fechaLarga para el lector de pantalla", () => {
    expect(fechaLarga("2026-10-09")).toBe("viernes 9 de octubre de 2026");
  });
});

describe("mesDe", () => {
  it("el mes de una fecha, para abrir el calendario donde está la elegida", () => {
    expect(mesDe("2026-10-09")).toEqual({ anio: 2026, mes: 10 });
    expect(mesDe("2025-01-31")).toEqual({ anio: 2025, mes: 1 });
  });
});
