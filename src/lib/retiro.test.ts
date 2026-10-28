/**
 * Spec 007, criterio 11: deshacer un cobro o borrar un ingreso quita su lote de "Por asignar" con todo lo que se hizo
 * con ese dinero (lo repartido y lo movido), primero en entrar, primero en salir, y lo muestra antes de aplicarlo. Lo
 * prestado no se retira: entonces no se deshace. Deshacer dos, en cualquier orden, deja lo mismo (sexta revisión,
 * hallazgo 1; guardian-datos, 2026-10-23).
 */
import { describe, expect, it } from "vitest";
import {
  type MovimientoDePorAsignar,
  cambiosPorSobre,
  cuentaDeLotes,
  firmaDeRetiro,
  firmaDeVista,
  juntarPorSobre,
  noAlcanzaElRetiro,
  planDeRetiro,
} from "./retiro";

const entrada = (id: number, centavos: number): MovimientoDePorAsignar => ({
  id,
  centavos,
  clase: "entrada",
  sobreId: null,
  nombre: null,
  ingresoId: null,
});
/** Un Mover desde un sobre hacia Por asignar. */
const vuelta = (id: number, centavos: number, sobreId = 3, nombre = "Familia"): MovimientoDePorAsignar => ({
  id,
  centavos,
  clase: "vuelta",
  sobreId,
  nombre,
  ingresoId: null,
});
const salida = (
  id: number,
  centavos: number,
  clase: "reparto" | "mover" | "prestamo" | "otra",
  sobreId: number | null = 2,
  nombre: string | null = "Gastos del mes",
): MovimientoDePorAsignar => ({
  id,
  centavos: -centavos,
  clase,
  sobreId,
  nombre,
  ingresoId: null,
});
const propio = (id: number, centavos: number, ingresoId: number, sobreId = 3, nombre = "Familia") => ({
  id,
  centavos: -centavos,
  clase: "propio" as const,
  sobreId,
  nombre,
  ingresoId,
});
const saldo = (m: MovimientoDePorAsignar[]) => m.reduce((a, x) => a + x.centavos, 0);
/** Aplica un plan como lo haría la base: quita el lote, su reparto propio, y borra o achica lo retirado. */
function aplicar(m: MovimientoDePorAsignar[], loteId: number): MovimientoDePorAsignar[] {
  const plan = planDeRetiro(m, loteId);
  if (!plan.alcanza) throw new Error(noAlcanzaElRetiro(plan));
  return m.flatMap((x) => {
    if (x.id === loteId || x.ingresoId === loteId) return [];
    const r = plan.retiros.find((y) => y.id === x.id);
    if (!r) return [x];
    return r.borra ? [] : [{ ...x, centavos: x.centavos + r.centavos }];
  });
}
const retiro = (id: number, centavos: number, borra = true, sobreId = 2, nombre = "Gastos del mes") => ({
  id,
  sobreId,
  nombre,
  centavos,
  borra,
});

describe("cuentaDeLotes: primero en entrar, primero en salir", () => {
  it("cada salida gasta de los lotes más viejos; el reparto propio, de su ingreso", () => {
    const c = cuentaDeLotes([entrada(1, 3_000), entrada(2, 10_000), propio(3, 6_000, 2), salida(4, 5_000, "reparto")]);
    // El 4 gasta los 30 del lote 1 y 20 del lote 2; el 3, 60 del lote 2.
    expect(c.restante(1)).toBe(0);
    expect(c.restante(2)).toBe(2_000);
    expect(c.gastos.map((g) => [g.lote, g.salida.id, g.centavos])).toEqual([
      [2, 3, 6_000],
      [1, 4, 3_000],
      [2, 4, 2_000],
    ]);
  });

  it("un Mover de vuelta desde un sobre paga lo que fue antes con Mover a ese sobre; a otro sobre, no", () => {
    const m = [
      entrada(1, 10_000),
      salida(2, 3_000, "mover", 3, "Familia"),
      salida(3, 2_000, "mover", 4, "Planes"),
      vuelta(4, 4_000, 3, "Familia"),
    ];
    const c = cuentaDeLotes(m);
    // La vuelta de Familia paga los 30 que fueron a Familia; le quedan 10 libres. Lo de Planes sale del lote 1.
    expect(c.gastos.map((g) => [g.lote, g.salida.id, g.centavos])).toEqual([
      [4, 2, 3_000],
      [1, 3, 2_000],
    ]);
    expect(c.restante(1) + c.restante(4)).toBe(saldo(m));
  });
});

describe("planDeRetiro", () => {
  it("un cobro sin usar: nada que retirar", () => {
    expect(planDeRetiro([entrada(1, 10_000)], 1)).toEqual({
      alcanza: true,
      retiros: [],
    });
  });

  it("un cobro repartido: se retira el reparto que se hizo con su dinero, aunque Por asignar tenga otro", () => {
    const m = [entrada(1, 10_000), salida(2, 10_000, "reparto"), entrada(3, 10_000)];
    expect(planDeRetiro(m, 1)).toEqual({
      alcanza: true,
      retiros: [retiro(2, 10_000)],
    });
  });

  it("un reparto que gastó de dos lotes se achica solo en lo de este", () => {
    const m = [entrada(1, 3_000), entrada(2, 20_000), salida(3, 20_000, "reparto")];
    expect(planDeRetiro(m, 2)).toEqual({
      alcanza: true,
      retiros: [retiro(3, 17_000, false)],
    });
  });

  it("lo movido con su dinero también se retira: vuelve del sobre adonde fue", () => {
    const m = [entrada(1, 10_000), salida(2, 2_000, "mover", 3, "Familia"), salida(3, 8_000, "reparto")];
    expect(planDeRetiro(m, 1)).toEqual({
      alcanza: true,
      retiros: [retiro(2, 2_000, true, 3, "Familia"), retiro(3, 8_000)],
    });
  });

  it("si lo movido ya volvió con Mover, no hay nada que retirar de ahí: ir y volver no deja nada", () => {
    const m = [entrada(1, 2_000), salida(2, 500, "mover", 3, "Familia"), vuelta(3, 500, 3, "Familia")];
    expect(planDeRetiro(m, 1)).toEqual({ alcanza: true, retiros: [] });
    expect(saldo(aplicar(m, 1))).toBe(0);
  });

  it("el reparto propio de otro ingreso no se retira: es de su dinero", () => {
    const m = [
      entrada(1, 10_000),
      salida(2, 10_000, "reparto", 3, "Familia"),
      entrada(3, 45_000),
      propio(4, 45_000, 3),
    ];
    expect(planDeRetiro(m, 1)).toEqual({
      alcanza: true,
      retiros: [retiro(2, 10_000, true, 3, "Familia")],
    });
    expect(aplicar(aplicar(m, 1), 3)).toEqual([]);
  });

  it("lo prestado no se retira: no se deshace, y dice por qué", () => {
    const m = [entrada(1, 10_000), salida(2, 3_000, "prestamo", null, null), salida(3, 7_000, "reparto")];
    const plan = planDeRetiro(m, 1);
    expect(plan).toEqual({
      alcanza: false,
      salidas: [{ clase: "prestamo", centavos: 3_000 }],
    });
    if (plan.alcanza) throw new Error("no debía alcanzar");
    expect(noAlcanzaElRetiro(plan)).toBe(
      "De este dinero, 30,00 se prestaron. Eso no se puede retirar, así que no se deshace.",
    );
  });

  it("lo que usa el reparto de un ingreso que se bajó tampoco", () => {
    // Un ingreso de 10 con 40 repartidos (bajado después): los 30 de más salen del cobro anterior.
    const m = [entrada(1, 3_000), entrada(2, 1_000), propio(3, 4_000, 2)];
    const plan = planDeRetiro(m, 1);
    if (plan.alcanza) throw new Error("no debía alcanzar");
    expect(noAlcanzaElRetiro(plan)).toBe(
      "De este dinero, 30,00 los usa el reparto de un ingreso que bajaste. Eso no se puede retirar, así que no se deshace.",
    );
  });

  it("lo retirado nunca pasa de lo que el lote gastó", () => {
    for (const reparto of [1, 4_099, 10_000, 15_000]) {
      const m = [entrada(1, 10_000), entrada(2, 5_000), salida(3, reparto, "reparto")];
      const plan = planDeRetiro(m, 1);
      if (!plan.alcanza) throw new Error("debía alcanzar");
      expect(plan.retiros.reduce((a, r) => a + r.centavos, 0)).toBe(Math.min(reparto, 10_000));
    }
  });
});

describe("★ dos deshacer, en el orden de registro o al revés, dejan lo mismo", () => {
  const ambos = (m: MovimientoDePorAsignar[], x: number, y: number) => {
    expect(aplicar(aplicar(m, x), y)).toEqual(aplicar(aplicar(m, y), x));
    return aplicar(aplicar(m, x), y);
  };

  it("dos cobros repartidos (sexta revisión): los repartos de los dos se retiran enteros", () => {
    const m = [
      entrada(1, 100_000),
      salida(2, 59_000, "reparto", 9, "Deudas"),
      salida(3, 41_000, "reparto"),
      entrada(4, 100_000),
      salida(5, 4_000, "reparto"),
      salida(6, 96_000, "reparto", 7, "Emergencia"),
    ];
    expect(ambos(m, 1, 4)).toEqual([]);
    // El primero solo se lleva lo suyo: el reparto del segundo sigue entero.
    expect(aplicar(m, 1).map((x) => x.id)).toEqual([4, 5, 6]);
  });

  it("con un Mover desde Por asignar en medio (guardian-datos, N1)", () => {
    const m = [
      entrada(1, 4_000),
      entrada(2, 8_000),
      salida(3, 2_000, "mover", 3, "Familia"),
      salida(4, 10_000, "reparto"),
      entrada(5, 4_000),
    ];
    // El Mover y el Repartir se hicieron con A y B: se retiran enteros; queda el ingreso.
    expect(ambos(m, 1, 2).map((x) => x.id)).toEqual([5]);
  });

  it("con un préstamo de un lote que no se deshace en medio (N2)", () => {
    const m = [
      entrada(1, 4_000),
      salida(2, 3_000, "prestamo", null, null),
      entrada(3, 8_000),
      salida(4, 9_000, "reparto"),
      entrada(5, 4_000),
    ];
    // El préstamo es del lote 1: ese no se deshace, en ningún orden. El 3 y el 5 sí, y en cualquier orden.
    expect(planDeRetiro(m, 1).alcanza).toBe(false);
    expect(planDeRetiro(aplicar(m, 3), 1).alcanza).toBe(false);
    ambos(m, 3, 5);
  });

  it("con lo movido devuelto antes de deshacer, en los dos órdenes (guardian-datos, el consejo)", () => {
    // Cobro A 100, Mover 100 a Familia, cobro B 100, Repartir 100 a Gastos, y los 100 vuelven de Familia.
    const m = [
      entrada(1, 10_000),
      salida(2, 10_000, "mover", 3, "Familia"),
      entrada(3, 10_000),
      salida(4, 10_000, "reparto"),
      vuelta(5, 10_000, 3, "Familia"),
    ];
    expect(ambos(m, 1, 3).map((x) => x.id)).toEqual([2, 5]);
  });
});
describe("cambiosPorSobre: cómo queda cada sobre", () => {
  const porAsignar = { sobreId: 1, nombre: "Por asignar" };
  const retiros = [
    { id: 30, sobreId: 2, nombre: "Gastos del mes", centavos: 41_000, borra: true },
    { id: 29, sobreId: 9, nombre: "Deudas", centavos: 9_000, borra: false },
  ];

  it("un cobro: Por asignar pierde el cobro y recupera lo retirado; cada sobre pierde lo suyo", () => {
    expect(cambiosPorSobre(porAsignar, 60_000, [], retiros)).toEqual([
      { sobreId: 1, nombre: "Por asignar", centavos: -10_000 },
      { sobreId: 2, nombre: "Gastos del mes", centavos: -41_000 },
      { sobreId: 9, nombre: "Deudas", centavos: -9_000 },
    ]);
  });

  it("un ingreso: su reparto y lo retirado vuelven a Por asignar, y el mismo sobre se junta en una línea", () => {
    const reparto = [{ sobreId: 2, nombre: "Gastos del mes", centavos: 17_500 }];
    const cambios = cambiosPorSobre(porAsignar, 58_500, reparto, [retiros[0]]);
    expect(cambios).toEqual([
      { sobreId: 1, nombre: "Por asignar", centavos: 0 },
      { sobreId: 2, nombre: "Gastos del mes", centavos: -58_500 },
    ]);
    // Lo que sale de las cuentas es lo mismo que pierden los sobres: el invariante se mantiene.
    expect(cambios.reduce((a, c) => a + c.centavos, 0)).toBe(-58_500);
  });

  it("juntarPorSobre suma lo de cada sobre, en el orden en que aparece", () => {
    expect(juntarPorSobre([...retiros, { ...retiros[0], id: 12, centavos: 5_000 }])).toEqual([
      { sobreId: 2, nombre: "Gastos del mes", centavos: 46_000 },
      { sobreId: 9, nombre: "Deudas", centavos: 9_000 },
    ]);
  });
});

describe("firmaDeVista: la confirmación vale para esa vista previa, saldos incluidos", () => {
  const retiros = [{ id: 30, sobreId: 2, nombre: "Gastos del mes", centavos: 41_000, borra: true }];
  const saldos = [
    { nombre: "Binance", antes: 500_000, despues: 440_000, moneda: "USDT" },
    { nombre: "Por asignar", antes: 10_000, despues: 0, moneda: null },
    { nombre: "Gastos del mes", antes: 41_000, despues: 0, moneda: null },
  ];

  it("cambia si cambia una fila, un monto o un saldo que se vio", () => {
    const firma = firmaDeVista(retiros, saldos);
    expect(firma).toBe(
      firmaDeVista(
        retiros.map((r) => ({ ...r })),
        saldos.map((x) => ({ ...x })),
      ),
    );
    expect(firmaDeVista([{ ...retiros[0], centavos: 41_001 }], saldos)).not.toBe(firma);
    expect(firmaDeVista([{ ...retiros[0], id: 31 }], saldos)).not.toBe(firma);
    // Un gasto de 7 en medio: la cuenta y Gastos del mes ya no son los que se vieron (guardian-datos, hallazgo 2).
    const conGasto = saldos.map((x) => (x.nombre === "Por asignar" ? x : { ...x, antes: x.antes - 700 }));
    expect(firmaDeVista(retiros, conGasto)).not.toBe(firma);
  });

  it("también sin retiro: lo que muestra «Así queda» (sexta revisión, hallazgo 3)", () => {
    const sinRetiro = firmaDeVista([], saldos);
    expect(sinRetiro).not.toBe("");
    const conMover = saldos.map((x) => (x.nombre === "Por asignar" ? { ...x, antes: 9_000 } : x));
    expect(firmaDeVista([], conMover)).not.toBe(sinRetiro);
    expect(firmaDeRetiro([])).toBe("");
  });
});
