import { describe, expect, it } from "vitest";
import {
  esIdCaptura,
  prefijoDeCaptura,
  referenciaDeCaptura,
  referenciaDeReasignacion,
  resolverReintento,
  resolverReintentoDeDeuda,
} from "./captura";

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

describe("referencias de un ingreso y su reparto (spec 004, criterio 7)", () => {
  it("el ingreso y una reasignación por sobre, distintas entre sí y en minúsculas", () => {
    expect(referenciaDeCaptura(id, "ingreso")).toBe(`captura-${id}-ingreso`);
    expect(referenciaDeReasignacion(id, 7)).toBe(`captura-${id}-reasignacion-7`);
    expect(referenciaDeReasignacion(id.toUpperCase(), 7)).toBe(referenciaDeReasignacion(id, 7));
    expect(referenciaDeReasignacion(id, 7)).not.toBe(referenciaDeReasignacion(id, 17));
    expect(referenciaDeReasignacion(id, 7).startsWith("demo-")).toBe(false);
  });

  it("un sobre que no es un entero positivo no da referencia", () => {
    for (const sobreId of [0, -1, 1.5, Number.NaN]) expect(() => referenciaDeReasignacion(id, sobreId)).toThrow();
  });

  const ahora = new Date("2026-10-14T20:00:00Z");
  const ingreso = {
    tipo: "ingreso",
    fecha: "2026-10-14",
    montoCentavos: 120_000,
    moneda: "USDT",
    montoUsdCentavos: 120_000,
    montoDestinoCentavos: null,
    monedaDestino: null,
    tasa: null,
    cuentaOrigenId: null,
    cuentaDestinoId: 1,
    sobreOrigenId: null,
    sobreDestinoId: 1,
    categoriaId: 20,
    nota: null,
  };
  const reasignacion = (sobreDestinoId: number, montoCentavos: number) => ({
    ...ingreso,
    tipo: "reasignacion",
    moneda: "USD",
    montoCentavos,
    montoUsdCentavos: montoCentavos,
    cuentaDestinoId: null,
    sobreOrigenId: 1,
    sobreDestinoId,
    categoriaId: null,
  });
  const preparadas = [ingreso, reasignacion(2, 45_000), reasignacion(4, 75_000)];
  const guardadas = preparadas.map((f) => ({ ...f, creadoEn: new Date(ahora.getTime() - 60_000) }));

  it("el mismo ingreso con el mismo reparto, en cualquier orden: ya estaba", () => {
    expect(resolverReintento([...guardadas].reverse(), preparadas, ahora)).toBe("ya-estaba");
  });

  it("si cambió el monto de un sobre, el sobre de destino o falta una reasignación, es otra", () => {
    expect(resolverReintento(guardadas, [ingreso, reasignacion(2, 45_000), reasignacion(4, 74_999)], ahora)).toBe(
      "otra",
    );
    expect(resolverReintento(guardadas, [ingreso, reasignacion(2, 45_000), reasignacion(5, 75_000)], ahora)).toBe(
      "otra",
    );
    expect(resolverReintento(guardadas, [ingreso, reasignacion(2, 45_000)], ahora)).toBe("otra");
  });
});

describe("prefijoDeCaptura: para releer todas las filas de una captura tras un choque (spec 004, criterio 7)", () => {
  it("es el comienzo de cada referencia de la captura, de gasto o de ingreso", () => {
    const prefijo = prefijoDeCaptura(id);
    expect(prefijo).toBe(`captura-${id}-`);
    for (const referencia of [
      referenciaDeCaptura(id, "gasto"),
      referenciaDeCaptura(id, "transferencia"),
      referenciaDeCaptura(id, "ingreso"),
      referenciaDeReasignacion(id, 7),
    ]) {
      expect(referencia.startsWith(prefijo), referencia).toBe(true);
    }
  });

  it("en minúsculas, y no abarca otra captura cuyo id empiece igual", () => {
    expect(prefijoDeCaptura(id.toUpperCase())).toBe(prefijoDeCaptura(id));
    expect(referenciaDeCaptura(`${id.slice(0, -1)}c`, "gasto").startsWith(prefijoDeCaptura(id))).toBe(false);
  });

  it("solo con un id de captura válido: nada de comodines de LIKE ni textos sueltos", () => {
    for (const texto of ["", "%", "_", `${id}%`, "demo-ing-001"])
      expect(() => prefijoDeCaptura(texto), texto).toThrow();
  });
});

describe("referencias de una deuda y su pago (spec 005, criterio 7)", () => {
  it("la fila de deudas y el movimiento del pago, distintas y con el prefijo de la captura", () => {
    expect(referenciaDeCaptura(id, "deuda")).toBe(`captura-${id}-deuda`);
    expect(referenciaDeCaptura(id, "pago")).toBe(`captura-${id}-pago`);
    expect(referenciaDeCaptura(id.toUpperCase(), "pago")).toBe(referenciaDeCaptura(id, "pago"));
    for (const referencia of [referenciaDeCaptura(id, "deuda"), referenciaDeCaptura(id, "pago")]) {
      expect(referencia.startsWith(prefijoDeCaptura(id)), referencia).toBe(true);
    }
  });

  const ahora = new Date("2026-10-15T20:00:00Z");
  const pago = {
    tipo: "pago_deuda",
    fecha: "2026-10-15",
    montoCentavos: 25_000,
    moneda: "USDT",
    montoUsdCentavos: 25_000,
    montoDestinoCentavos: null,
    monedaDestino: null,
    tasa: null,
    cuentaOrigenId: 1,
    cuentaDestinoId: null,
    sobreOrigenId: 8,
    sobreDestinoId: null,
    categoriaId: null,
    deudaId: 3,
    nota: null,
  };

  it("un pago a otra deuda con el mismo id y lo demás igual es otra captura", () => {
    const guardado = { ...pago, creadoEn: new Date(ahora.getTime() - 60_000) };
    expect(resolverReintento([guardado], [pago], ahora)).toBe("ya-estaba");
    expect(resolverReintento([guardado], [{ ...pago, deudaId: 4 }], ahora)).toBe("otra");
  });

  const deuda = {
    sentido: "debo",
    persona: "Papás",
    montoInicialCentavos: 52_000,
    fechaPrevista: "2026-12-15",
    cuentaPrevistaId: 1,
    nota: null,
  };

  it("la misma deuda, reciente: ya estaba; una nota vacía y una nula son la misma", () => {
    const guardada = { ...deuda, creadoEn: new Date(ahora.getTime() - 60_000) };
    expect(resolverReintentoDeDeuda(guardada, deuda, ahora)).toBe("ya-estaba");
    expect(resolverReintentoDeDeuda(guardada, { ...deuda, nota: "" }, ahora)).toBe("ya-estaba");
  });

  it("si cambió cualquier campo de la deuda, o es de hace más de 15 minutos, es otra", () => {
    const guardada = { ...deuda, creadoEn: new Date(ahora.getTime() - 60_000) };
    for (const cambio of [
      { sentido: "me_deben" },
      { persona: "Papá" },
      { montoInicialCentavos: 52_001 },
      { fechaPrevista: null },
      { cuentaPrevistaId: null },
      { nota: "Diciembre" },
    ]) {
      expect(resolverReintentoDeDeuda(guardada, { ...deuda, ...cambio }, ahora), JSON.stringify(cambio)).toBe("otra");
    }
    const vieja = { ...deuda, creadoEn: new Date(ahora.getTime() - 16 * 60_000) };
    expect(resolverReintentoDeDeuda(vieja, deuda, ahora)).toBe("otra");
  });
});
