/**
 * Spec 007, criterio 11: deshacer un cobro o borrar un ingreso ya repartidos quita su lote de "Por asignar" con lo que
 * se repartió con ese dinero, primero en entrar, primero en salir, y lo muestra antes de aplicarlo. Deshacer dos, en
 * cualquier orden, deja lo mismo (sexta revisión, hallazgo 1).
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
const salida = (
  id: number,
  centavos: number,
  clase: "reparto" | "mover" | "otra",
  sobreId: number | null = 2,
  nombre: string | null = "Gastos del mes",
): MovimientoDePorAsignar => ({ id, centavos: -centavos, clase, sobreId, nombre, ingresoId: null });
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
  const plan = planDeRetiro(m, loteId, saldo(m));
  if (!plan.alcanza) throw new Error("no alcanza");
  return m.flatMap((x) => {
    if (x.id === loteId || x.ingresoId === loteId) return [];
    const r = plan.retiros.find((y) => y.id === x.id);
    if (!r) return [x];
    return r.borra ? [] : [{ ...x, centavos: x.centavos + r.centavos }];
  });
}

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
});

describe("planDeRetiro", () => {
  it("un cobro sin repartir: nada que retirar", () => {
    const m = [entrada(1, 10_000)];
    expect(planDeRetiro(m, 1, saldo(m))).toEqual({ alcanza: true, retiros: [] });
  });

  it("un cobro repartido: se retira el reparto que se hizo con su dinero, aunque Por asignar tenga otro", () => {
    // Cobro de 100 y Repartir de 100; luego un sueldo de 100 sin repartir. El sueldo no paga el cobro.
    const m = [entrada(1, 10_000), salida(2, 10_000, "reparto"), entrada(3, 10_000)];
    expect(planDeRetiro(m, 1, saldo(m))).toEqual({
      alcanza: true,
      retiros: [{ id: 2, sobreId: 2, nombre: "Gastos del mes", centavos: 10_000, borra: true }],
    });
  });

  it("un reparto que gastó de dos lotes se achica solo en lo de este", () => {
    const m = [entrada(1, 3_000), entrada(2, 20_000), salida(3, 20_000, "reparto")];
    expect(planDeRetiro(m, 2, saldo(m))).toEqual({
      alcanza: true,
      retiros: [{ id: 3, sobreId: 2, nombre: "Gastos del mes", centavos: 17_000, borra: false }],
    });
  });

  it("★ dos cobros repartidos, deshechos en el orden de registro o al revés, dejan lo mismo (sexta revisión)", () => {
    const m = [
      entrada(1, 100_000),
      salida(2, 59_000, "reparto", 9, "Deudas"),
      salida(3, 41_000, "reparto"),
      entrada(4, 100_000),
      salida(5, 4_000, "reparto"),
      salida(6, 96_000, "reparto", 7, "Emergencia"),
    ];
    const enOrden = aplicar(aplicar(m, 1), 4);
    const alReves = aplicar(aplicar(m, 4), 1);
    expect(enOrden).toEqual([]);
    expect(alReves).toEqual([]);
    // El primero solo se lleva lo suyo: el reparto del segundo sigue entero.
    const trasElPrimero = aplicar(m, 1);
    expect(trasElPrimero.map((x) => x.id)).toEqual([4, 5, 6]);
  });

  it("el reparto propio de otro ingreso no se retira: es de su dinero", () => {
    const m = [
      entrada(1, 10_000),
      salida(2, 10_000, "reparto", 3, "Familia"),
      entrada(3, 45_000),
      propio(4, 45_000, 3),
    ];
    const plan = planDeRetiro(m, 1, saldo(m));
    expect(plan).toEqual({
      alcanza: true,
      retiros: [{ id: 2, sobreId: 3, nombre: "Familia", centavos: 10_000, borra: true }],
    });
    expect(aplicar(aplicar(m, 1), 3)).toEqual([]);
  });

  it("lo que salió con Mover lo cubre lo libre de Por asignar; si no hay, no se puede y dice adónde fue", () => {
    const m = [entrada(1, 10_000), salida(2, 10_000, "mover", 3, "Familia")];
    const plan = planDeRetiro(m, 1, saldo(m));
    expect(plan).toEqual({
      alcanza: false,
      faltan: 10_000,
      salidas: [{ clase: "mover", nombre: "Familia", centavos: 10_000 }],
    });
    if (plan.alcanza) throw new Error("no debía alcanzar");
    expect(noAlcanzaElRetiro("Por asignar", plan)).toBe(
      "De este dinero salieron 100,00 con Mover a Familia, y Por asignar no tiene con qué cubrirlo: faltan 100,00. Devuelve 100,00 a Por asignar con Mover desde Familia y vuelve a intentarlo.",
    );
    // Devolverlo con Mover deja dinero libre, y entonces sí: Mover no contó en ninguno de los dos sentidos.
    const devuelto = [...m, entrada(3, 10_000)];
    expect(planDeRetiro(devuelto, 1, saldo(devuelto))).toEqual({ alcanza: true, retiros: [] });
  });

  it("lo que salió con un préstamo se dice como otra forma", () => {
    const m = [entrada(1, 10_000), salida(2, 3_000, "otra", null, null), salida(3, 7_000, "reparto")];
    const plan = planDeRetiro(m, 1, saldo(m));
    if (plan.alcanza) throw new Error("no debía alcanzar");
    expect(noAlcanzaElRetiro("Por asignar", plan)).toBe(
      "De este dinero salieron 30,00 de otra forma (un préstamo, o al bajar otro ingreso), y Por asignar no tiene con qué cubrirlo: faltan 30,00. Devuelve 30,00 a Por asignar con Mover y vuelve a intentarlo.",
    );
  });

  it("lo que salió sin lote lo tapa la entrada siguiente, que ya no queda libre", () => {
    // Por asignar en −50; un cobro de 20 tapa 20 del hueco y un reparto de 20 sale sin lote.
    const m = [salida(1, 5_000, "otra", null, null), entrada(2, 2_000), salida(3, 2_000, "reparto")];
    const c = cuentaDeLotes(m);
    expect(c.restante(2)).toBe(0);
    expect(c.gastos.map((g) => [g.lote, g.salida.id, g.centavos])).toEqual([[2, 1, 2_000]]);
    // Deshacer ese cobro abriría otra vez el hueco: no hay nada libre que lo cubra.
    expect(planDeRetiro(m, 2, saldo(m))).toEqual({
      alcanza: false,
      faltan: 2_000,
      salidas: [{ clase: "otra", nombre: null, centavos: 2_000 }],
    });
  });

  it("un Mover que sale, se deshace su lote y vuelve: la vuelta tapa el hueco y no queda dinero fantasma", () => {
    // Cobro de 20, Mover 5 a Familia y Mover 5 de vuelta: se deshace el cobro con lo libre que dejó la vuelta.
    const m = [entrada(1, 2_000), salida(2, 500, "mover", 3, "Familia"), entrada(3, 500)];
    const sinElCobro = aplicar(m, 1);
    expect(saldo(sinElCobro)).toBe(0);
    // Luego otro cobro y su Repartir: es todo de él; la vuelta ya tapó lo que salió con Mover.
    const despues = [...sinElCobro, entrada(4, 1_000), salida(5, 1_000, "reparto", 3, "Familia")];
    expect(cuentaDeLotes(despues).restante(3)).toBe(0);
    expect(planDeRetiro(despues, 4, saldo(despues))).toEqual({
      alcanza: true,
      retiros: [{ id: 5, sobreId: 3, nombre: "Familia", centavos: 1_000, borra: true }],
    });
  });

  it("lo retirado nunca pasa de lo que el lote gastó", () => {
    for (const reparto of [1, 4_099, 10_000, 15_000]) {
      const m = [entrada(1, 10_000), entrada(2, 5_000), salida(3, reparto, "reparto")];
      const plan = planDeRetiro(m, 1, saldo(m));
      if (!plan.alcanza) throw new Error("debía alcanzar");
      expect(plan.retiros.reduce((a, r) => a + r.centavos, 0)).toBe(Math.min(reparto, 10_000));
    }
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
