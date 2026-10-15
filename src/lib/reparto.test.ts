/**
 * Criterios 1 a 5 de la spec 004: la propuesta de reparto de un ingreso entre los sobres, según las reglas.
 */
import { describe, expect, it } from "vitest";
import { type EntradaReparto, type ReglaParaRepartir, proponerReparto } from "./reparto";

const gastosDelMes = 2;
const familia = 3;
const emergencia = 4;
const planes = 5;
const ocasiones = 6;
const inversion = 7;

/** Las reglas sembradas (src/db/seed.ts), con el tope de Emergencia en 2.700 USD. */
const sembradas: ReglaParaRepartir[] = [
  { sobreId: gastosDelMes, orden: 1, tipo: "fijo", valor: 450_00, topeCentavos: null },
  { sobreId: familia, orden: 2, tipo: "fijo", valor: 100_00, topeCentavos: null },
  { sobreId: ocasiones, orden: 3, tipo: "fijo", valor: 25_00, topeCentavos: null },
  { sobreId: emergencia, orden: 4, tipo: "porcentaje", valor: 4_000, topeCentavos: 2_700_00 },
  { sobreId: planes, orden: 5, tipo: "porcentaje", valor: 3_000, topeCentavos: null },
  { sobreId: inversion, orden: 6, tipo: "porcentaje", valor: 3_000, topeCentavos: null },
];

function proponer(cambios: Partial<EntradaReparto>) {
  return proponerReparto({ monto: 0, reglas: sembradas, recibidoEnElMes: {}, saldos: {}, ...cambios });
}

/** Lo propuesto a cada sobre, por id; los de 0 también aparecen. */
function porSobre(cambios: Partial<EntradaReparto>) {
  const { asignaciones } = proponer(cambios);
  return Object.fromEntries(asignaciones.map((a) => [a.sobreId, a.centavos]));
}

function sumaExacta(cambios: Partial<EntradaReparto>) {
  const { asignaciones, sinAsignar } = proponer(cambios);
  expect(asignaciones.reduce((a, x) => a + x.centavos, 0) + sinAsignar).toBe(cambios.monto);
  for (const a of asignaciones) {
    expect(Number.isSafeInteger(a.centavos)).toBe(true);
    expect(a.centavos).toBeGreaterThanOrEqual(0);
  }
  expect(sinAsignar).toBeGreaterThanOrEqual(0);
}

describe("criterio 1 · suma exacta", () => {
  it("lo asignado más lo sin asignar es el monto, en centavos enteros y sin negativos", () => {
    for (const monto of [0, 1, 2, 3, 99, 575_00, 575_01, 1_200_00, 1_999_99, 2_000_00, 12_345_67])
      sumaExacta({ monto });
  });

  it("también con montos y reglas cualesquiera", () => {
    let semilla = 11;
    const azar = () => (semilla = (semilla * 1_103_515_245 + 12_345) % 2_147_483_648);
    for (let vuelta = 0; vuelta < 500; vuelta++) {
      const reglas: ReglaParaRepartir[] = Array.from({ length: 1 + (azar() % 8) }, (_, i) => {
        const fijo = azar() % 3 === 0;
        return {
          sobreId: 10 + i,
          orden: azar() % 4,
          tipo: fijo ? "fijo" : "porcentaje",
          valor: fijo ? 1 + (azar() % 100_000) : 1 + (azar() % 10_000),
          topeCentavos: azar() % 4 === 0 ? azar() % 50_000 : null,
        };
      });
      const recibidoEnElMes = Object.fromEntries(reglas.map((r) => [r.sobreId, azar() % 60_000]));
      const saldos = Object.fromEntries(reglas.map((r) => [r.sobreId, (azar() % 80_000) - 10_000]));
      const monto = azar() % 5_000_000;
      sumaExacta({ monto, reglas, recibidoEnElMes, saldos });
    }
  });

  it("devuelve una asignación por regla, en el orden en que llegan", () => {
    const { asignaciones } = proponer({ monto: 1_200_00 });
    expect(asignaciones.map((a) => a.sobreId)).toEqual(sembradas.map((r) => r.sobreId));
  });
});

describe("criterio 2 · fijos primero, una vez al mes", () => {
  it("los fijos se atienden antes que los porcentajes aunque su orden sea mayor", () => {
    const reglas: ReglaParaRepartir[] = [
      { sobreId: planes, orden: 1, tipo: "porcentaje", valor: 10_000, topeCentavos: null },
      { sobreId: gastosDelMes, orden: 9, tipo: "fijo", valor: 450_00, topeCentavos: null },
    ];
    expect(porSobre({ monto: 500_00, reglas })).toEqual({ [planes]: 50_00, [gastosDelMes]: 450_00 });
  });

  it("entre fijos manda el orden cuando el monto no alcanza", () => {
    const reglas: ReglaParaRepartir[] = [
      { sobreId: familia, orden: 2, tipo: "fijo", valor: 100_00, topeCentavos: null },
      { sobreId: gastosDelMes, orden: 1, tipo: "fijo", valor: 450_00, topeCentavos: null },
    ];
    expect(porSobre({ monto: 500_00, reglas })).toEqual({ [gastosDelMes]: 450_00, [familia]: 50_00 });
  });

  it("si ya recibió todo el fijo en el mes, propone 0", () => {
    const recibidoEnElMes = { [gastosDelMes]: 450_00 };
    expect(porSobre({ monto: 1_200_00, recibidoEnElMes })[gastosDelMes]).toBe(0);
  });

  it("si recibió 200 de 450, propone 250", () => {
    const recibidoEnElMes = { [gastosDelMes]: 200_00 };
    expect(porSobre({ monto: 1_200_00, recibidoEnElMes })[gastosDelMes]).toBe(250_00);
  });

  it("si recibió más que el fijo, propone 0 y no un negativo", () => {
    const recibidoEnElMes = { [gastosDelMes]: 600_00 };
    expect(porSobre({ monto: 1_200_00, recibidoEnElMes })[gastosDelMes]).toBe(0);
  });

  it("si el monto no alcanza para los fijos, se llenan en orden y no queda nada para los porcentajes", () => {
    const propuesto = porSobre({ monto: 500_00 });
    expect(propuesto).toEqual({
      [gastosDelMes]: 450_00,
      [familia]: 50_00,
      [ocasiones]: 0,
      [emergencia]: 0,
      [planes]: 0,
      [inversion]: 0,
    });
    expect(proponer({ monto: 500_00 }).sinAsignar).toBe(0);
  });
});

describe("criterio 3 · porcentajes sobre lo que queda", () => {
  const tercios: ReglaParaRepartir[] = [
    { sobreId: emergencia, orden: 1, tipo: "porcentaje", valor: 3_334, topeCentavos: null },
    { sobreId: planes, orden: 2, tipo: "porcentaje", valor: 3_333, topeCentavos: null },
    { sobreId: inversion, orden: 3, tipo: "porcentaje", valor: 3_333, topeCentavos: null },
  ];

  it("reparte en proporción a los puntos base", () => {
    expect(porSobre({ monto: 1_000_00, reglas: tercios })).toEqual({
      [emergencia]: 333_40,
      [planes]: 333_30,
      [inversion]: 333_30,
    });
  });

  it("el centavo que sobra va al mayor residuo", () => {
    // 1 centavo × 40 % = 0,4; × 30 % = 0,3 y 0,3: el centavo va a Emergencia.
    const soloPorcentajes = sembradas.filter((r) => r.tipo === "porcentaje");
    expect(porSobre({ monto: 1, reglas: soloPorcentajes })).toEqual({ [emergencia]: 1, [planes]: 0, [inversion]: 0 });
    // 7 centavos: 2,8 / 2,1 / 2,1 → 3 / 2 / 2.
    expect(porSobre({ monto: 7, reglas: soloPorcentajes })).toEqual({ [emergencia]: 3, [planes]: 2, [inversion]: 2 });
  });

  it("en los empates de residuo gana el orden menor", () => {
    const iguales: ReglaParaRepartir[] = [
      { sobreId: inversion, orden: 3, tipo: "porcentaje", valor: 5_000, topeCentavos: null },
      { sobreId: planes, orden: 2, tipo: "porcentaje", valor: 5_000, topeCentavos: null },
    ];
    expect(porSobre({ monto: 1, reglas: iguales })).toEqual({ [planes]: 1, [inversion]: 0 });
    expect(porSobre({ monto: 3, reglas: iguales })).toEqual({ [planes]: 2, [inversion]: 1 });
  });

  it("si los porcentajes no suman 100, se reparte igual en proporción y nada queda sin asignar", () => {
    const mitad: ReglaParaRepartir[] = [
      { sobreId: planes, orden: 1, tipo: "porcentaje", valor: 1_000, topeCentavos: null },
      { sobreId: inversion, orden: 2, tipo: "porcentaje", valor: 3_000, topeCentavos: null },
    ];
    expect(proponer({ monto: 100_00, reglas: mitad })).toEqual({
      asignaciones: [
        { sobreId: planes, centavos: 25_00 },
        { sobreId: inversion, centavos: 75_00 },
      ],
      sinAsignar: 0,
    });
  });
});

describe("criterio 4 · topes", () => {
  it("un sobre con tope recibe a lo sumo lo que le falta y lo demás va a los otros porcentajes en proporción", () => {
    // Emergencia en 2.650 de 2.700: le faltan 50. De 625 quedarían 250 para ella; 200 se reparten 30/30.
    const propuesto = porSobre({ monto: 1_200_00, saldos: { [emergencia]: 2_650_00 } });
    expect(propuesto[emergencia]).toBe(50_00);
    expect(propuesto[planes]).toBe(287_50);
    expect(propuesto[inversion]).toBe(287_50);
  });

  it("si ya llegó al tope, recibe 0", () => {
    const propuesto = porSobre({ monto: 1_200_00, saldos: { [emergencia]: 2_700_00 } });
    expect(propuesto[emergencia]).toBe(0);
    expect(propuesto[planes]).toBe(312_50);
    expect(propuesto[inversion]).toBe(312_50);
  });

  it("si pasó el tope, recibe 0 y no un negativo", () => {
    expect(porSobre({ monto: 1_200_00, saldos: { [emergencia]: 3_000_00 } })[emergencia]).toBe(0);
  });

  it("si un saldo es negativo, lo que falta es mayor que el tope", () => {
    const soloEmergencia: ReglaParaRepartir[] = [
      { sobreId: emergencia, orden: 1, tipo: "porcentaje", valor: 10_000, topeCentavos: 100_00 },
    ];
    expect(proponer({ monto: 500_00, reglas: soloEmergencia, saldos: { [emergencia]: -20_00 } })).toEqual({
      asignaciones: [{ sobreId: emergencia, centavos: 120_00 }],
      sinAsignar: 380_00,
    });
  });

  it("la redistribución sigue en cadena si el que recibe el sobrante también llega a su tope", () => {
    const reglas: ReglaParaRepartir[] = [
      { sobreId: emergencia, orden: 1, tipo: "porcentaje", valor: 5_000, topeCentavos: 100_00 },
      { sobreId: planes, orden: 2, tipo: "porcentaje", valor: 2_500, topeCentavos: 300_00 },
      { sobreId: inversion, orden: 3, tipo: "porcentaje", valor: 2_500, topeCentavos: null },
    ];
    // 1.000: Emergencia tomaría 500 y le faltan 100; 900 quedan 50/50: Planes tomaría 450 y le faltan 300.
    expect(porSobre({ monto: 1_000_00, reglas })).toEqual({
      [emergencia]: 100_00,
      [planes]: 300_00,
      [inversion]: 600_00,
    });
  });

  it("si todos los porcentajes llegaron a su tope, el resto queda sin asignar", () => {
    const reglas: ReglaParaRepartir[] = [
      { sobreId: emergencia, orden: 1, tipo: "porcentaje", valor: 6_000, topeCentavos: 100_00 },
      { sobreId: planes, orden: 2, tipo: "porcentaje", valor: 4_000, topeCentavos: 50_00 },
    ];
    expect(proponer({ monto: 500_00, reglas, saldos: { [planes]: 20_00 } })).toEqual({
      asignaciones: [
        { sobreId: emergencia, centavos: 100_00 },
        { sobreId: planes, centavos: 30_00 },
      ],
      sinAsignar: 370_00,
    });
  });

  it("un fijo con tope tampoco pasa de lo que le falta, y lo demás sigue a los porcentajes", () => {
    const reglas: ReglaParaRepartir[] = [
      { sobreId: ocasiones, orden: 1, tipo: "fijo", valor: 100_00, topeCentavos: 500_00 },
      { sobreId: inversion, orden: 2, tipo: "porcentaje", valor: 10_000, topeCentavos: null },
    ];
    expect(porSobre({ monto: 300_00, reglas, saldos: { [ocasiones]: 460_00 } })).toEqual({
      [ocasiones]: 40_00,
      [inversion]: 260_00,
    });
  });

  it("nunca propone más que el tope, con montos y saldos cualesquiera", () => {
    let semilla = 5;
    const azar = () => (semilla = (semilla * 1_103_515_245 + 12_345) % 2_147_483_648);
    for (let vuelta = 0; vuelta < 300; vuelta++) {
      const saldos = { [emergencia]: azar() % 2_800_00, [planes]: azar() % 600_00 };
      const reglas = sembradas.map((r) => (r.sobreId === planes ? { ...r, topeCentavos: 500_00 } : r));
      const propuesto = porSobre({ monto: azar() % 5_000_00, reglas, saldos });
      expect(propuesto[emergencia]).toBeLessThanOrEqual(Math.max(0, 2_700_00 - saldos[emergencia]));
      expect(propuesto[planes]).toBeLessThanOrEqual(Math.max(0, 500_00 - saldos[planes]));
    }
  });
});

describe("criterio 5 · el ejemplo del plan con las reglas sembradas", () => {
  it("primer cobro de octubre, 1.200: fijos 450 / 100 / 25 y de los 625 que quedan 250 / 187,50 / 187,50", () => {
    expect(proponer({ monto: 1_200_00, saldos: { [emergencia]: 500_00 } })).toEqual({
      asignaciones: [
        { sobreId: gastosDelMes, centavos: 450_00 },
        { sobreId: familia, centavos: 100_00 },
        { sobreId: ocasiones, centavos: 25_00 },
        { sobreId: emergencia, centavos: 250_00 },
        { sobreId: planes, centavos: 187_50 },
        { sobreId: inversion, centavos: 187_50 },
      ],
      sinAsignar: 0,
    });
  });

  it("segundo cobro de octubre, 800: sin fijos, 320 / 240 / 240", () => {
    const recibidoEnElMes = { [gastosDelMes]: 450_00, [familia]: 100_00, [ocasiones]: 25_00, [emergencia]: 250_00 };
    expect(porSobre({ monto: 800_00, recibidoEnElMes, saldos: { [emergencia]: 750_00 } })).toEqual({
      [gastosDelMes]: 0,
      [familia]: 0,
      [ocasiones]: 0,
      [emergencia]: 320_00,
      [planes]: 240_00,
      [inversion]: 240_00,
    });
  });
});

describe("sin reglas, solo fijos y casos borde", () => {
  it("sin reglas, todo queda sin asignar", () => {
    expect(proponer({ monto: 1_200_00, reglas: [] })).toEqual({ asignaciones: [], sinAsignar: 1_200_00 });
  });

  it("solo con fijos, lo que queda tras ellos queda sin asignar", () => {
    const soloFijos = sembradas.filter((r) => r.tipo === "fijo");
    expect(proponer({ monto: 1_200_00, reglas: soloFijos }).sinAsignar).toBe(625_00);
  });

  it("monto cero: todo en cero", () => {
    expect(proponer({ monto: 0 })).toEqual({
      asignaciones: sembradas.map((r) => ({ sobreId: r.sobreId, centavos: 0 })),
      sinAsignar: 0,
    });
  });

  it("montos enormes se reparten exactos, sin perder centavos", () => {
    const monto = Number.MAX_SAFE_INTEGER;
    const reglas = sembradas.map((r) => ({ ...r, topeCentavos: null }));
    sumaExacta({ monto, reglas });
    const propuesto = porSobre({ monto, reglas });
    // 9.007.199.254.740.991 − 57.500 = 9.007.199.254.683.491 → 40 % = 3.602.879.701.873.396,4 → +1 por mayor residuo.
    expect(propuesto[emergencia]).toBe(3_602_879_701_873_397);
    expect(propuesto[planes]).toBe(2_702_159_776_405_047);
    expect(propuesto[inversion]).toBe(2_702_159_776_405_047);
  });
});

describe("entradas inválidas", () => {
  const regla = sembradas[0];

  it("lanza con un monto que no es un entero seguro o es negativo", () => {
    expect(() => proponer({ monto: -1 })).toThrow();
    expect(() => proponer({ monto: 10.5 })).toThrow();
    expect(() => proponer({ monto: Number.MAX_SAFE_INTEGER + 1 })).toThrow();
    expect(() => proponer({ monto: Number.NaN })).toThrow();
  });

  it("lanza con una regla de valor no positivo o un porcentaje mayor que 100 %", () => {
    expect(() => proponer({ monto: 100, reglas: [{ ...regla, valor: 0 }] })).toThrow();
    expect(() => proponer({ monto: 100, reglas: [{ ...regla, valor: 1.5 }] })).toThrow();
    const pct = sembradas[3];
    expect(() => proponer({ monto: 100, reglas: [{ ...pct, valor: 10_001 }] })).toThrow();
  });

  it("lanza con dos reglas para el mismo sobre", () => {
    expect(() => proponer({ monto: 100, reglas: [regla, { ...regla, orden: 9 }] })).toThrow();
  });

  it("lanza con un tope, un saldo o un recibido que no son enteros", () => {
    expect(() => proponer({ monto: 100, reglas: [{ ...regla, topeCentavos: 1.5 }] })).toThrow();
    expect(() => proponer({ monto: 100, saldos: { [emergencia]: 0.5 } })).toThrow();
    expect(() => proponer({ monto: 100, recibidoEnElMes: { [gastosDelMes]: Number.NaN } })).toThrow();
  });
});
