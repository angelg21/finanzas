/**
 * Spec 015: dividir Inversión en largo plazo y negocios. La regla se parte 2/3 y 1/3 sin perder ni un punto, y el plan
 * dice qué cambia según cómo esté la base. Lo que solo se ve en la base (la transacción y los saldos) lo comprueba
 * scripts/comprobar-015.ts.
 */
import { describe, expect, it } from "vitest";
import { dividirRegla, nombreLargoPlazo, planDeDivision } from "./dividir-inversion";

describe("dividirRegla (criterio 5)", () => {
  it("★ 30 % pasa a 20 % y 10 %", () => {
    expect(dividirRegla(3_000)).toEqual({ largoPlazo: 2_000, negocios: 1_000 });
  });

  it("★ suma siempre lo mismo, con el tercio redondeado al entero más cercano", () => {
    for (let valor = 1; valor <= 10_000; valor++) {
      const { largoPlazo, negocios } = dividirRegla(valor);
      expect(largoPlazo + negocios).toBe(valor);
      expect(Number.isInteger(negocios) && Math.abs(negocios * 3 - valor) <= 1).toBe(true);
    }
    expect(dividirRegla(2_500)).toEqual({ largoPlazo: 1_667, negocios: 833 });
    expect(dividirRegla(3_500)).toEqual({ largoPlazo: 2_333, negocios: 1_167 });
  });

  it("un fijo en centavos se parte igual: 150 $ → 100 $ y 50 $", () => {
    expect(dividirRegla(15_000)).toEqual({ largoPlazo: 10_000, negocios: 5_000 });
  });

  it("valores que no son enteros positivos no se dividen", () => {
    expect(() => dividirRegla(0)).toThrow(RangeError);
    expect(() => dividirRegla(-3)).toThrow(RangeError);
    expect(() => dividirRegla(1.5)).toThrow(RangeError);
  });
});

describe("planDeDivision (criterios 2 a 4)", () => {
  const base = [
    { id: 1, nombre: "Por asignar", tipo: "por_asignar", orden: 0 },
    { id: 7, nombre: "Inversión", tipo: "inversion", orden: 6 },
  ];
  const regla = { sobreId: 7, tipo: "porcentaje" as const, valor: 3_000, orden: 6, activa: true };

  it("★ 2: renombra, crea Negocios detrás de Inversión y divide la regla", () => {
    expect(planDeDivision(base, [regla])).toEqual({
      estado: "dividir",
      inversionId: 7,
      renombrarA: nombreLargoPlazo,
      negocios: { nombre: "Negocios", tipo: "negocios", orden: 6, nota: expect.any(String) },
      regla: { tipo: "porcentaje", antes: 3_000, largoPlazo: 2_000, negocios: 1_000, orden: 6 },
    });
  });

  it("★ 3: con un sobre de negocios ya hecho, no hay nada que hacer", () => {
    const hecho = [...base, { id: 9, nombre: "Negocios", tipo: "negocios", orden: 6 }];
    expect(planDeDivision(hecho, [regla])).toEqual({ estado: "ya-dividido" });
  });

  it("4: un nombre que el desarrollador eligió no se cambia", () => {
    const renombrado = [base[0], { ...base[1], nombre: "Bróker" }];
    const plan = planDeDivision(renombrado, [regla]);
    expect(plan.estado === "dividir" && plan.renombrarA).toBeNull();
  });

  it("4: sin regla activa, Negocios queda sin regla", () => {
    const plan = planDeDivision(base, [{ ...regla, activa: false }]);
    expect(plan.estado === "dividir" && plan.regla).toBeNull();
  });

  it("un tercio que redondea a 0 no crea regla para Negocios (la base exige valor positivo)", () => {
    const plan = planDeDivision(base, [{ ...regla, valor: 1 }]);
    expect(plan.estado === "dividir" && plan.regla).toEqual({
      tipo: "porcentaje",
      antes: 1,
      largoPlazo: 1,
      negocios: null,
      orden: 6,
    });
  });

  it("sin sobre de inversión, o con otro sobre que ya se llama Negocios, no se divide", () => {
    expect(planDeDivision([base[0]], [])).toEqual({ estado: "sin-inversion" });
    const ocupado = [...base, { id: 3, nombre: "negocios", tipo: "meta", orden: 4 }];
    expect(planDeDivision(ocupado, [regla])).toEqual({ estado: "nombre-ocupado", nombre: "Negocios" });
  });
});
