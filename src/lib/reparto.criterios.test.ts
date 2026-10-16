/**
 * Criterios ★ 1 a 5 de la spec 004 (ingresos y reparto), escritos desde el texto de cada criterio, y el ★ 12 de la
 * spec 005 (Deudas en el reparto). Las pruebas de construcción viven en reparto.test.ts; estas fijan lo que las specs
 * prometen de la propuesta de reparto.
 */
import { describe, expect, it } from "vitest";
import { cuotaDeDeudas, reglaDeDeudas } from "./cuota-deudas";
import { recibidoDelMes } from "./ingresos";
import { type EntradaReparto, type Propuesta, type ReglaParaRepartir, proponerReparto } from "./reparto";

const gastosDelMes = 2;
const familia = 3;
const ocasiones = 6;
const emergencia = 7;
const planes = 8;
const inversion = 9;

const fijo = (sobreId: number, orden: number, valor: number): ReglaParaRepartir => ({
  sobreId,
  orden,
  tipo: "fijo",
  valor,
  topeCentavos: null,
});
const porcentaje = (sobreId: number, orden: number, valor: number, topeCentavos: number | null = null) => ({
  sobreId,
  orden,
  tipo: "porcentaje" as const,
  valor,
  topeCentavos,
});

/** Las reglas sembradas: tres fijos y 40 / 30 / 30 sobre lo que queda, con el tope de Emergencia. */
const sembradas: ReglaParaRepartir[] = [
  fijo(gastosDelMes, 1, 45_000),
  fijo(familia, 2, 10_000),
  fijo(ocasiones, 3, 2_500),
  porcentaje(emergencia, 4, 4_000, 270_000),
  porcentaje(planes, 5, 3_000),
  porcentaje(inversion, 6, 3_000),
];

function proponer(cambios: Partial<EntradaReparto>): Propuesta {
  return proponerReparto({ monto: 0, reglas: sembradas, recibidoEnElMes: {}, saldos: {}, ...cambios });
}

/** Lo propuesto a cada sobre, por id; 0 si no aparece. */
function porSobre(p: Propuesta): Record<number, number> {
  const r: Record<number, number> = {};
  for (const a of p.asignaciones) r[a.sobreId] = (r[a.sobreId] ?? 0) + a.centavos;
  return r;
}

const total = (p: Propuesta) => p.asignaciones.reduce((a, x) => a + x.centavos, 0) + p.sinAsignar;

describe("★ 1 · suma exacta", () => {
  const casos: [string, EntradaReparto][] = [
    ["las sembradas, un monto redondo", { monto: 120_000, reglas: sembradas, recibidoEnElMes: {}, saldos: {} }],
    ["las sembradas, un monto impar", { monto: 100_001, reglas: sembradas, recibidoEnElMes: {}, saldos: {} }],
    ["un centavo", { monto: 1, reglas: sembradas, recibidoEnElMes: {}, saldos: {} }],
    [
      "tercios que no dan exacto",
      {
        monto: 100,
        reglas: [porcentaje(1, 1, 3_333), porcentaje(2, 2, 3_333), porcentaje(3, 3, 3_334)],
        recibidoEnElMes: {},
        saldos: {},
      },
    ],
    ["sin reglas", { monto: 50_000, reglas: [], recibidoEnElMes: {}, saldos: {} }],
    ["solo fijos que no lo agotan", { monto: 80_000, reglas: [fijo(1, 1, 30_000)], recibidoEnElMes: {}, saldos: {} }],
    [
      "un tope que ya se alcanzó",
      {
        monto: 33_333,
        reglas: [porcentaje(emergencia, 1, 10_000, 270_000)],
        recibidoEnElMes: {},
        saldos: { [emergencia]: 300_000 },
      },
    ],
    ["un monto enorme", { monto: Number.MAX_SAFE_INTEGER, reglas: sembradas, recibidoEnElMes: {}, saldos: {} }],
  ];

  it.each(casos)("%s: lo asignado más lo sin asignar es el monto, en centavos enteros y nunca negativos", (_, e) => {
    const p = proponerReparto(e);
    expect(total(p)).toBe(e.monto);
    expect(Number.isInteger(p.sinAsignar) && p.sinAsignar >= 0).toBe(true);
    for (const a of p.asignaciones) {
      expect(Number.isInteger(a.centavos)).toBe(true);
      expect(a.centavos).toBeGreaterThanOrEqual(0);
    }
  });

  it("lo que no tiene destino queda sin asignar", () => {
    expect(proponerReparto({ monto: 50_000, reglas: [], recibidoEnElMes: {}, saldos: {} }).sinAsignar).toBe(50_000);
    const soloFijo = proponerReparto({ monto: 80_000, reglas: [fijo(1, 1, 30_000)], recibidoEnElMes: {}, saldos: {} });
    expect(soloFijo.sinAsignar).toBe(50_000);
  });
});

describe("★ 2 · fijos primero, una vez al mes", () => {
  it("las fijas se atienden antes que los porcentajes aunque su orden sea mayor", () => {
    const reglas = [porcentaje(planes, 1, 10_000), fijo(gastosDelMes, 9, 45_000)];
    const p = porSobre(proponerReparto({ monto: 50_000, reglas, recibidoEnElMes: {}, saldos: {} }));
    expect(p[gastosDelMes]).toBe(45_000);
    expect(p[planes]).toBe(5_000);
  });

  it("si ya recibió los 450 en el mes, un segundo cobro le propone 0", () => {
    const p = porSobre(proponer({ monto: 80_000, recibidoEnElMes: { [gastosDelMes]: 45_000 } }));
    expect(p[gastosDelMes] ?? 0).toBe(0);
  });

  it("si recibió 200, le propone 250", () => {
    const p = porSobre(proponer({ monto: 120_000, recibidoEnElMes: { [gastosDelMes]: 20_000 } }));
    expect(p[gastosDelMes]).toBe(25_000);
  });

  it("si el monto no alcanza para los fijos, se llenan por orden y nada va a los porcentajes", () => {
    const p = proponer({ monto: 50_000 });
    const s = porSobre(p);
    expect(s[gastosDelMes]).toBe(45_000);
    expect(s[familia]).toBe(5_000);
    expect(s[ocasiones] ?? 0).toBe(0);
    expect((s[emergencia] ?? 0) + (s[planes] ?? 0) + (s[inversion] ?? 0)).toBe(0);
    expect(p.sinAsignar).toBe(0);
  });

  it("entre fijas manda el orden, no el id del sobre", () => {
    const reglas = [fijo(1, 2, 10_000), fijo(2, 1, 10_000)];
    const s = porSobre(proponerReparto({ monto: 15_000, reglas, recibidoEnElMes: {}, saldos: {} }));
    expect(s[2]).toBe(10_000);
    expect(s[1]).toBe(5_000);
  });

  it("lo recibido se toma del mes de la fecha del ingreso", () => {
    const recibido = { "2026-09": { [gastosDelMes]: 45_000 }, "2026-10": { [gastosDelMes]: 20_000 } };
    expect(recibidoDelMes(recibido, "2026-10-31")).toEqual({ [gastosDelMes]: 20_000 });
    expect(recibidoDelMes(recibido, "2026-09-01")).toEqual({ [gastosDelMes]: 45_000 });
    expect(recibidoDelMes(recibido, "2026-11-01")).toEqual({});
  });
});

describe("★ 3 · porcentajes sobre lo que queda", () => {
  it("lo que queda tras los fijos se reparte en proporción a los puntos base", () => {
    const reglas = [fijo(1, 1, 20_000), porcentaje(2, 2, 7_500), porcentaje(3, 3, 2_500)];
    const s = porSobre(proponerReparto({ monto: 60_000, reglas, recibidoEnElMes: {}, saldos: {} }));
    expect(s).toEqual({ 1: 20_000, 2: 30_000, 3: 10_000 });
  });

  it("el redondeo se cuadra por mayor residuo", () => {
    const reglas = [porcentaje(1, 1, 3_333), porcentaje(2, 2, 3_333), porcentaje(3, 3, 3_334)];
    const p = proponerReparto({ monto: 100, reglas, recibidoEnElMes: {}, saldos: {} });
    expect(porSobre(p)).toEqual({ 1: 33, 2: 33, 3: 34 });
    expect(p.sinAsignar).toBe(0);
  });

  it("en un empate de residuos gana el de menor orden", () => {
    const reglas = [porcentaje(1, 2, 5_000), porcentaje(2, 1, 5_000)];
    const p = proponerReparto({ monto: 1, reglas, recibidoEnElMes: {}, saldos: {} });
    expect(porSobre(p)).toEqual({ 1: 0, 2: 1 });
    expect(p.sinAsignar).toBe(0);
  });
});

describe("★ 4 · topes", () => {
  it("un sobre con tope no recibe más de lo que le falta, y lo que sobra va a los demás porcentajes", () => {
    const p = proponer({ monto: 157_500, saldos: { [emergencia]: 250_000 } });
    const s = porSobre(p);
    // Quedan 1.000 tras los fijos: a Emergencia le faltan 200 en vez de 400; los 200 que sobran se parten a medias.
    expect(s[emergencia]).toBe(20_000);
    expect(s[planes]).toBe(40_000);
    expect(s[inversion]).toBe(40_000);
    expect(p.sinAsignar).toBe(0);
  });

  it("si ya llegó al tope, recibe 0", () => {
    const s = porSobre(proponer({ monto: 120_000, saldos: { [emergencia]: 270_000 } }));
    expect(s[emergencia] ?? 0).toBe(0);
    expect(s[planes]).toBe(31_250);
    expect(s[inversion]).toBe(31_250);
  });

  it("si todos los porcentajes llegaron a su tope, el resto queda sin asignar", () => {
    const reglas = [
      fijo(gastosDelMes, 1, 45_000),
      porcentaje(emergencia, 2, 6_000, 270_000),
      porcentaje(planes, 3, 4_000, 100_000),
    ];
    const saldos = { [emergencia]: 260_000, [planes]: 100_000 };
    const p = proponerReparto({ monto: 120_000, reglas, recibidoEnElMes: {}, saldos });
    const s = porSobre(p);
    expect(s[gastosDelMes]).toBe(45_000);
    expect(s[emergencia]).toBe(10_000);
    expect(s[planes] ?? 0).toBe(0);
    expect(p.sinAsignar).toBe(65_000);
  });

  it("un sobre fijo con tope tampoco recibe más de lo que le falta", () => {
    const reglas = [{ ...fijo(planes, 1, 50_000), topeCentavos: 100_000 }, porcentaje(inversion, 2, 10_000)];
    const p = proponerReparto({ monto: 80_000, reglas, recibidoEnElMes: {}, saldos: { [planes]: 90_000 } });
    expect(porSobre(p)[planes]).toBeLessThanOrEqual(10_000);
    expect(total(p)).toBe(80_000);
  });
});

describe("★ 5 · ejemplo del plan con las reglas sembradas", () => {
  it("un primer cobro de octubre de 1.200 propone 450 / 100 / 25 y 250 / 187,50 / 187,50", () => {
    const p = proponer({ monto: 120_000, saldos: { [emergencia]: 0 } });
    expect(porSobre(p)).toEqual({
      [gastosDelMes]: 45_000,
      [familia]: 10_000,
      [ocasiones]: 2_500,
      [emergencia]: 25_000,
      [planes]: 18_750,
      [inversion]: 18_750,
    });
    expect(p.sinAsignar).toBe(0);
  });

  it("un segundo cobro de octubre de 800 propone 320 / 240 / 240, sin fijos", () => {
    const recibidoEnElMes = { [gastosDelMes]: 45_000, [familia]: 10_000, [ocasiones]: 2_500 };
    const p = proponer({ monto: 80_000, recibidoEnElMes, saldos: { [emergencia]: 25_000 } });
    const s = porSobre(p);
    expect((s[gastosDelMes] ?? 0) + (s[familia] ?? 0) + (s[ocasiones] ?? 0)).toBe(0);
    expect(s[emergencia]).toBe(32_000);
    expect(s[planes]).toBe(24_000);
    expect(s[inversion]).toBe(24_000);
    expect(p.sinAsignar).toBe(0);
  });
});

describe("spec 005, ★ 12 · Deudas en el reparto, antes que todas las fijas", () => {
  const deudas = 12;
  const cuota = cuotaDeDeudas({
    deudas: [
      { sentido: "debo", pendienteCentavos: 25_000, fechaPrevista: "2026-10-22" },
      { sentido: "debo", pendienteCentavos: 52_000, fechaPrevista: "2026-12-15" },
    ],
    apartado: 0,
    hoy: "2026-10-15",
  });
  const regla = reglaDeDeudas(deudas, cuota, sembradas);
  if (!regla) throw new Error("Se esperaba la regla de Deudas");
  const conDeudas = [regla, ...sembradas];

  it("con Deudas en 385,00, un primer cobro de octubre de 1.200,00 propone 385 / 450 / 100 / 25 y 96 / 72 / 72", () => {
    expect(cuota).toBe(38_500);
    const p = proponerReparto({ monto: 120_000, reglas: conDeudas, recibidoEnElMes: {}, saldos: {} });
    expect(porSobre(p)).toEqual({
      [deudas]: 38_500,
      [gastosDelMes]: 45_000,
      [familia]: 10_000,
      [ocasiones]: 2_500,
      [emergencia]: 9_600,
      [planes]: 7_200,
      [inversion]: 7_200,
    });
    expect(p.sinAsignar).toBe(0);
  });

  it("va primero: si el monto no alcanza, Deudas toma su cuota entera y Gastos del mes recibe menos", () => {
    const s = porSobre(proponerReparto({ monto: 50_000, reglas: conDeudas, recibidoEnElMes: {}, saldos: {} }));
    expect(s[deudas]).toBe(38_500);
    expect(s[gastosDelMes]).toBe(11_500);
    expect(s[familia] ?? 0).toBe(0);
  });

  it("pide la cuota menos lo recibido desde Por asignar en el mes, como los demás fijos", () => {
    const recibidoEnElMes = { [deudas]: 10_000 };
    const s = porSobre(proponerReparto({ monto: 120_000, reglas: conDeudas, recibidoEnElMes, saldos: {} }));
    expect(s[deudas]).toBe(28_500);
  });

  it("con la cuota ya recibida en el mes, un segundo cobro no le propone nada", () => {
    const recibidoEnElMes = { [deudas]: 38_500, [gastosDelMes]: 45_000, [familia]: 10_000, [ocasiones]: 2_500 };
    const s = porSobre(proponerReparto({ monto: 80_000, reglas: conDeudas, recibidoEnElMes, saldos: {} }));
    expect(s[deudas] ?? 0).toBe(0);
  });
});
