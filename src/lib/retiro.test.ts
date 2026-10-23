/**
 * Spec 007, criterio 11: deshacer un cobro o borrar un ingreso ya repartidos retira lo que falta en "Por asignar" de lo
 * que se repartió después, del más reciente al más viejo, y lo muestra antes de aplicarlo.
 */
import { describe, expect, it } from "vitest";
import {
  cambiosPorSobre,
  firmaDeRetiro,
  firmaDeVista,
  juntarPorSobre,
  noAlcanzaElRetiro,
  planDeRetiro,
} from "./retiro";

// Del más reciente al más viejo, como los lee la base.
const posteriores = [
  { id: 30, sobreId: 2, nombre: "Gastos del mes", montoCentavos: 41_000 },
  { id: 29, sobreId: 9, nombre: "Deudas", montoCentavos: 59_000 },
  { id: 12, sobreId: 2, nombre: "Gastos del mes", montoCentavos: 5_000 },
];

describe("planDeRetiro", () => {
  it("sin nada que retirar, ningún retiro", () => {
    expect(planDeRetiro(0, posteriores)).toEqual({ alcanza: true, retiros: [] });
  });

  it("retira del más reciente al más viejo: los que caben enteros se borran", () => {
    expect(planDeRetiro(100_000, posteriores)).toEqual({
      alcanza: true,
      retiros: [
        { id: 30, sobreId: 2, nombre: "Gastos del mes", centavos: 41_000, borra: true },
        { id: 29, sobreId: 9, nombre: "Deudas", centavos: 59_000, borra: true },
      ],
    });
  });

  it("el último que hace falta se achica, no se borra", () => {
    expect(planDeRetiro(50_000, posteriores)).toEqual({
      alcanza: true,
      retiros: [
        { id: 30, sobreId: 2, nombre: "Gastos del mes", centavos: 41_000, borra: true },
        { id: 29, sobreId: 9, nombre: "Deudas", centavos: 9_000, borra: false },
      ],
    });
  });

  it("si lo repartido después no alcanza, lo dice con lo que alcanza y no retira nada", () => {
    expect(planDeRetiro(120_000, posteriores)).toEqual({ alcanza: false, faltan: 120_000, alcanzaHasta: 105_000 });
    expect(planDeRetiro(1, [])).toEqual({ alcanza: false, faltan: 1, alcanzaHasta: 0 });
  });

  it("lo retirado suma exactamente lo que falta: ni un centavo más", () => {
    for (const faltan of [1, 40_999, 41_000, 41_001, 99_999, 105_000]) {
      const plan = planDeRetiro(faltan, posteriores);
      if (!plan.alcanza) throw new Error("debía alcanzar");
      expect(plan.retiros.reduce((a, r) => a + r.centavos, 0)).toBe(faltan);
    }
  });
});

describe("noAlcanzaElRetiro", () => {
  it("dice cuánto falta, cuánto cubre lo repartido y cuánto devolver con Mover, sin culpar a uno solo", () => {
    const plan = planDeRetiro(120_000, posteriores);
    if (plan.alcanza) throw new Error("no debía alcanzar");
    expect(noAlcanzaElRetiro("Por asignar", 2_000, plan)).toBe(
      "Por asignar tiene 20,00; le faltan 1.200,00, y lo repartido después solo cubre 1.050,00: lo demás ya salió de Por asignar de otra forma (con Mover, con un préstamo, o al bajar o borrar otro ingreso o deshacer otro cobro). Devuelve 150,00 a Por asignar con Mover y vuelve a intentarlo.",
    );
  });
});

describe("cambiosPorSobre: cómo queda cada sobre", () => {
  const porAsignar = { sobreId: 1, nombre: "Por asignar" };

  it("un cobro: Por asignar pierde el cobro y recupera lo retirado; cada sobre pierde lo suyo", () => {
    const plan = planDeRetiro(50_000, posteriores);
    if (!plan.alcanza) throw new Error("debía alcanzar");
    expect(cambiosPorSobre(porAsignar, 60_000, [], plan.retiros)).toEqual([
      { sobreId: 1, nombre: "Por asignar", centavos: -10_000 },
      { sobreId: 2, nombre: "Gastos del mes", centavos: -41_000 },
      { sobreId: 9, nombre: "Deudas", centavos: -9_000 },
    ]);
  });

  it("un ingreso: su reparto y lo retirado vuelven a Por asignar, y el mismo sobre se junta en una línea", () => {
    const plan = planDeRetiro(41_000, posteriores);
    if (!plan.alcanza) throw new Error("debía alcanzar");
    const reparto = [{ sobreId: 2, nombre: "Gastos del mes", centavos: 17_500 }];
    const cambios = cambiosPorSobre(porAsignar, 58_500, reparto, plan.retiros);
    expect(cambios).toEqual([
      { sobreId: 1, nombre: "Por asignar", centavos: 0 },
      { sobreId: 2, nombre: "Gastos del mes", centavos: -58_500 },
    ]);
    // Lo que sale de las cuentas es lo mismo que pierden los sobres: el invariante se mantiene.
    expect(cambios.reduce((a, c) => a + c.centavos, 0)).toBe(-58_500);
  });
});

describe("juntarPorSobre y firmaDeRetiro", () => {
  it("junta lo que sale de cada sobre, para mostrarlo", () => {
    const plan = planDeRetiro(105_000, posteriores);
    if (!plan.alcanza) throw new Error("debía alcanzar");
    expect(juntarPorSobre(plan.retiros)).toEqual([
      { sobreId: 2, nombre: "Gastos del mes", centavos: 46_000 },
      { sobreId: 9, nombre: "Deudas", centavos: 59_000 },
    ]);
  });

  it("la firma cambia si cambia cualquier retiro: así la confirmación vale para esa vista previa y no otra", () => {
    const a = planDeRetiro(50_000, posteriores);
    const b = planDeRetiro(50_001, posteriores);
    if (!a.alcanza || !b.alcanza) throw new Error("debía alcanzar");
    expect(firmaDeRetiro(a.retiros)).toBe(firmaDeRetiro(planDeRetiro(50_000, posteriores).alcanza ? a.retiros : []));
    expect(firmaDeRetiro(a.retiros)).not.toBe(firmaDeRetiro(b.retiros));
    expect(firmaDeRetiro([])).toBe("");
  });
});

describe("firmaDeVista: la confirmación vale para esa vista previa, saldos incluidos", () => {
  const plan = planDeRetiro(50_000, posteriores);
  if (!plan.alcanza) throw new Error("debía alcanzar");
  const saldos = [
    { nombre: "Binance", antes: 500_000, despues: 440_000, moneda: "USDT" },
    { nombre: "Por asignar", antes: 10_000, despues: 0, moneda: null },
    { nombre: "Gastos del mes", antes: 41_000, despues: 0, moneda: null },
  ];

  it("sin retiro no hace falta firma", () => {
    expect(firmaDeVista([], saldos)).toBe("");
  });

  it("con retiro cambia si cambia una fila o un saldo que se vio (guardian-datos, hallazgo 2)", () => {
    const firma = firmaDeVista(plan.retiros, saldos);
    expect(firma).toBe(
      firmaDeVista(
        plan.retiros,
        saldos.map((x) => ({ ...x })),
      ),
    );
    // Un gasto de 7 en medio: la cuenta y Gastos del mes ya no son los que se vieron.
    const conGasto = saldos.map((x) => (x.nombre === "Por asignar" ? x : { ...x, antes: x.antes - 700 }));
    expect(firmaDeVista(plan.retiros, conGasto)).not.toBe(firma);
    // La misma fila achicada antes por otra vista previa: mismo retiro, otro saldo.
    const otraVista = saldos.map((x) => (x.nombre === "Gastos del mes" ? { ...x, antes: 11_000 } : x));
    expect(firmaDeVista(plan.retiros, otraVista)).not.toBe(firma);
    // Un centavo más que retirar, con los mismos saldos: otra firma.
    const otro = planDeRetiro(50_001, posteriores);
    if (!otro.alcanza) throw new Error("debía alcanzar");
    expect(firmaDeVista(otro.retiros, saldos)).not.toBe(firma);
  });
});
