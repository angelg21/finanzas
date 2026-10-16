/**
 * Criterio ★ 7 de la spec 005 (todo o nada, y sin duplicados) en lo que cumplen las funciones puras, escrito desde su
 * texto: las referencias de cada formulario y cuándo un reintento es "ya estaba". Las pruebas de construcción viven en
 * captura.test.ts. Que el préstamo guarde los dos o ninguno, y que un reintento no duplique en la base, lo comprueba
 * scripts/comprobar-005.ts.
 */
import { describe, expect, it } from "vitest";
import { referenciaDeCaptura, referenciaDeReasignacion, resolverReintento, resolverReintentoDeDeuda } from "./captura";

const id = "6f1c2a4e-8b3d-4c5e-9f60-1a2b3c4d5e6f";
const ahora = new Date("2026-10-15T15:00:00Z");
const haceUnosSegundos = new Date("2026-10-15T14:59:50Z");
const haceDosHoras = new Date("2026-10-15T13:00:00Z");

describe("★ 7 · las referencias de cada formulario", () => {
  it("la deuda, el pago, el préstamo y el cobro llevan captura-<uuid>-<tipo>", () => {
    expect(referenciaDeCaptura(id, "deuda")).toBe(`captura-${id}-deuda`);
    expect(referenciaDeCaptura(id, "pago")).toBe(`captura-${id}-pago`);
    expect(referenciaDeCaptura(id, "prestamo")).toBe(`captura-${id}-prestamo`);
    expect(referenciaDeCaptura(id, "cobro")).toBe(`captura-${id}-cobro`);
  });

  it("apartar lleva captura-<uuid>-reasignacion-<sobreId>", () => {
    expect(referenciaDeReasignacion(id, 10)).toBe(`captura-${id}-reasignacion-10`);
  });

  it("el mismo id da siempre la misma referencia, así un reintento choca con la primera", () => {
    expect(referenciaDeCaptura(id.toUpperCase(), "pago")).toBe(referenciaDeCaptura(id, "pago"));
  });
});

describe('★ 7 · un reintento es "ya estaba" solo si lo guardado es igual y reciente', () => {
  const pago = {
    tipo: "pago_deuda",
    fecha: "2026-10-15",
    montoCentavos: 20_000,
    moneda: "USDT",
    montoUsdCentavos: 20_000,
    montoDestinoCentavos: null,
    monedaDestino: null,
    tasa: null,
    cuentaOrigenId: 1,
    cuentaDestinoId: null,
    sobreOrigenId: 10,
    sobreDestinoId: null,
    categoriaId: null,
    deudaId: 7,
    nota: null,
  };

  it("el mismo pago, de hace unos segundos, ya estaba", () => {
    expect(resolverReintento([{ ...pago, creadoEn: haceUnosSegundos }], [pago], ahora)).toBe("ya-estaba");
  });

  it("con otro monto, otra deuda u otra cuenta, no es el mismo", () => {
    const guardado = [{ ...pago, creadoEn: haceUnosSegundos }];
    expect(resolverReintento(guardado, [{ ...pago, montoCentavos: 19_999, montoUsdCentavos: 19_999 }], ahora)).toBe(
      "otra",
    );
    expect(resolverReintento(guardado, [{ ...pago, deudaId: 8 }], ahora)).toBe("otra");
    expect(resolverReintento(guardado, [{ ...pago, cuentaOrigenId: 2 }], ahora)).toBe("otra");
  });

  it("el mismo pago guardado hace horas es una página vieja, no un reintento", () => {
    expect(resolverReintento([{ ...pago, creadoEn: haceDosHoras }], [pago], ahora)).toBe("otra");
  });

  it("la deuda registrada: igual y reciente ya estaba; cambiada o vieja, no", () => {
    const deuda = {
      sentido: "debo",
      persona: "Papás",
      montoInicialCentavos: 52_000,
      fechaPrevista: "2026-12-15",
      cuentaPrevistaId: 1,
      nota: null,
    };
    expect(resolverReintentoDeDeuda({ ...deuda, creadoEn: haceUnosSegundos }, deuda, ahora)).toBe("ya-estaba");
    expect(
      resolverReintentoDeDeuda({ ...deuda, creadoEn: haceUnosSegundos }, { ...deuda, persona: "Mamá" }, ahora),
    ).toBe("otra");
    expect(
      resolverReintentoDeDeuda({ ...deuda, creadoEn: haceUnosSegundos }, { ...deuda, montoInicialCentavos: 1 }, ahora),
    ).toBe("otra");
    expect(resolverReintentoDeDeuda({ ...deuda, creadoEn: haceDosHoras }, deuda, ahora)).toBe("otra");
  });
});
