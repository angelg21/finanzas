import { describe, expect, it } from "vitest";
import { esIdCaptura, referenciaDeCaptura, resolverReintento } from "./captura";

const id = "3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b";

describe("esIdCaptura: un UUID, nada más (spec 002, criterio 19)", () => {
  it("acepta un UUID en minúsculas o mayúsculas", () => {
    expect(esIdCaptura(id)).toBe(true);
    expect(esIdCaptura(id.toUpperCase())).toBe(true);
  });

  it("rechaza lo vacío, lo corto y lo que trae algo más", () => {
    for (const texto of [
      "",
      "abc",
      `${id}x`,
      ` ${id}`,
      `${id}-gasto`,
      "3f2b8c1e9a4d4e6f8b7a1c2d3e4f5a6b",
      "demo-ing-001",
    ]) {
      expect(esIdCaptura(texto), texto).toBe(false);
    }
  });
});

describe("referenciaDeCaptura: una por fila, la misma en cada reintento", () => {
  it("distingue las dos filas de un gasto vendiendo USDT", () => {
    expect(referenciaDeCaptura(id, "gasto")).toBe(`captura-${id}-gasto`);
    expect(referenciaDeCaptura(id, "transferencia")).toBe(`captura-${id}-transferencia`);
  });

  it("es igual para el mismo id y nunca empieza por demo-, que pnpm db:demo:limpiar borra", () => {
    expect(referenciaDeCaptura(id, "gasto")).toBe(referenciaDeCaptura(id, "gasto"));
    expect(referenciaDeCaptura(id, "gasto").startsWith("demo-")).toBe(false);
  });

  it("se pasa a minúsculas: el mismo id en mayúsculas es la misma captura", () => {
    expect(referenciaDeCaptura(id.toUpperCase(), "gasto")).toBe(referenciaDeCaptura(id, "gasto"));
  });
});

describe('resolverReintento: un choque solo es "ya estaba" si es la misma captura y reciente', () => {
  const ahora = new Date("2026-10-13T20:00:00Z");
  const hace = (minutos: number) => new Date(ahora.getTime() - minutos * 60_000);
  const transferencia = {
    tipo: "transferencia",
    fecha: "2026-10-13",
    montoCentavos: 2000,
    moneda: "USDT",
    montoUsdCentavos: 2000,
    montoDestinoCentavos: 483600,
    monedaDestino: "VES",
    tasa: "241.8000",
    cuentaOrigenId: 1,
    cuentaDestinoId: 5,
    sobreOrigenId: null,
    categoriaId: null,
    nota: null,
  };
  const gasto = {
    tipo: "gasto",
    fecha: "2026-10-13",
    montoCentavos: 210000,
    moneda: "VES",
    montoUsdCentavos: 868,
    montoDestinoCentavos: null,
    monedaDestino: null,
    tasa: "241.8000",
    cuentaOrigenId: 5,
    cuentaDestinoId: null,
    sobreOrigenId: 2,
    categoriaId: 7,
    nota: "Mercado",
  };
  const guardada = <T extends object>(fila: T, minutos = 1) => ({
    ...fila,
    sobreDestinoId: null,
    creadoEn: hace(minutos),
  });

  it("la misma venta, en cualquier orden y hace un minuto: ya estaba", () => {
    expect(resolverReintento([guardada(gasto), guardada(transferencia)], [transferencia, gasto], ahora)).toBe(
      "ya-estaba",
    );
  });

  it("una nota vacía y una nula son la misma", () => {
    expect(resolverReintento([guardada({ ...gasto, nota: null })], [{ ...gasto, nota: "" }], ahora)).toBe("ya-estaba");
  });

  it("si cambió el monto, la categoría o el sobre, es otra", () => {
    for (const cambio of [{ montoCentavos: 150 }, { categoriaId: 8 }, { sobreOrigenId: 3 }, { fecha: "2026-10-12" }]) {
      expect(resolverReintento([guardada(gasto)], [{ ...gasto, ...cambio }], ahora), JSON.stringify(cambio)).toBe(
        "otra",
      );
    }
  });

  it("si cambió la forma de pago, es otra: de dólares a vendiendo y al revés", () => {
    const enDolares = {
      ...gasto,
      moneda: "USDT",
      montoCentavos: 1500,
      montoUsdCentavos: 1500,
      tasa: null,
      cuentaOrigenId: 1,
    };
    expect(resolverReintento([guardada(enDolares)], [transferencia, gasto], ahora)).toBe("otra");
    expect(resolverReintento([guardada(transferencia), guardada(gasto)], [enDolares], ahora)).toBe("otra");
  });

  it("si lo guardado es de hace más de 15 minutos, es otra: una página vieja con un id ya usado", () => {
    expect(resolverReintento([guardada(gasto, 16)], [gasto], ahora)).toBe("otra");
    expect(resolverReintento([guardada(gasto, 14)], [gasto], ahora)).toBe("ya-estaba");
  });

  it('sin nada guardado no hay "ya estaba"', () => {
    expect(resolverReintento([], [gasto], ahora)).toBe("otra");
  });
});
