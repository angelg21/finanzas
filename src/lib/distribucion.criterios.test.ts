/**
 * Criterios ★ 1 y 2 de la spec 003 (movimientos por categoría), escritos desde su texto: lo que el anillo hace con los
 * totales de cada categoría. Las pruebas de construcción viven en distribucion.test.ts. Que esos totales salgan de la
 * base con la suma exacta de su tipo y su periodo, y que la página muestre "<1 %", lo comprueba
 * scripts/comprobar-003.ts.
 */
import { describe, expect, it } from "vitest";
import { distribuirPorCategoria } from "./distribucion";

type Total = { categoriaId: number; nombre: string; centavos: number };

const total = (categoriaId: number, nombre: string, centavos: number): Total => ({ categoriaId, nombre, centavos });
const suma = (numeros: number[]) => numeros.reduce((a, n) => a + n, 0);

/** Un generador fijo (Park y Miller): las mismas vueltas en cada corrida, con productos que caben en 2^53. */
function azar(semilla: number) {
  let s = semilla;
  return (tope: number) => {
    s = (s * 48_271) % 2_147_483_647;
    return s % tope;
  };
}

describe("★ 1 · totales exactos", () => {
  it("el centro es la suma exacta en centavos de las categorías: 125,00 + 91,12 + 85,30 = 301,42", () => {
    const { total: centro } = distribuirPorCategoria([
      total(3, "Comida", 125_00),
      total(4, "Transporte", 91_12),
      total(5, "Servicios", 85_30),
    ]);
    expect(centro).toBe(301_42);
  });

  it("cada porción muestra la suma de su categoría, sin redondear", () => {
    const { porciones } = distribuirPorCategoria([
      total(3, "Comida", 128_33),
      total(4, "Transporte", 91_12),
      total(5, "Servicios", 85_30),
      total(6, "Salud", 1),
    ]);
    const de = (id: number) => porciones.find((p) => p.categoriaId === id)?.centavos;
    expect([de(3), de(4), de(5), de(6)]).toEqual([128_33, 91_12, 85_30, 1]);
  });

  it("la suma de las porciones es igual al total, con montos que en coma flotante no suman exacto", () => {
    // 0,10 + 0,20 = 0,30000000000000004 en coma flotante; en centavos es 30.
    const { total: centro, porciones } = distribuirPorCategoria([total(1, "A", 10), total(2, "B", 20)]);
    expect(centro).toBe(30);
    expect(suma(porciones.map((p) => p.centavos))).toBe(centro);
  });

  it("la suma de las porciones es igual al total, en 1.000 repartos de 1 a 15 categorías", () => {
    const tirar = azar(2026);
    for (let vuelta = 0; vuelta < 1_000; vuelta++) {
      const montos = Array.from({ length: 1 + tirar(15) }, () => 1 + tirar(9_999_999));
      const { total: centro, porciones } = distribuirPorCategoria(montos.map((c, i) => total(i + 1, `C${i}`, c)));
      expect(centro).toBe(suma(montos));
      expect(suma(porciones.map((p) => p.centavos))).toBe(centro);
      expect(porciones).toHaveLength(montos.length);
    }
  });

  it("montos grandes, de millones de dólares, siguen exactos al centavo", () => {
    const { total: centro, porciones } = distribuirPorCategoria([
      total(1, "A", 123_456_789_01),
      total(2, "B", 98_765_432_19),
      total(3, "C", 1),
    ]);
    expect(centro).toBe(222_222_221_21);
    expect(suma(porciones.map((p) => p.centavos))).toBe(centro);
  });
});

describe("★ 2 · porcentajes que suman 100", () => {
  it("son enteros y suman exactamente 100, en 1.000 repartos de 1 a 15 categorías", () => {
    const tirar = azar(14);
    for (let vuelta = 0; vuelta < 1_000; vuelta++) {
      const montos = Array.from({ length: 1 + tirar(15) }, () => 1 + tirar(vuelta % 2 ? 500 : 5_000_000));
      const { porciones } = distribuirPorCategoria(montos.map((c, i) => total(i + 1, `C${i}`, c)));
      for (const p of porciones) expect(Number.isInteger(p.porcentaje)).toBe(true);
      expect(suma(porciones.map((p) => p.porcentaje))).toBe(100);
    }
  });

  it("mayor residuo, con el ejemplo de la referencia: 41,47 · 30,23 · 28,30 dan 42 · 30 · 28", () => {
    // Los enteros suman 99; el punto que falta va al residuo mayor (0,47), no a cada uno por redondeo.
    const { porciones } = distribuirPorCategoria([
      total(3, "Comida", 125_00),
      total(4, "Transporte", 91_12),
      total(5, "Servicios", 85_30),
    ]);
    expect(porciones.map((p) => [p.nombre, p.porcentaje])).toEqual([
      ["Comida", 42],
      ["Transporte", 30],
      ["Servicios", 28],
    ]);
  });

  it("mayor residuo y no redondeo: 33,5 · 33,5 · 33 suman 100, no 101", () => {
    // Redondear cada uno daría 34 + 34 + 33 = 101. Por mayor residuo, un solo punto extra para uno de los dos 33,5.
    const { porciones } = distribuirPorCategoria([total(1, "A", 3_35), total(2, "B", 3_35), total(3, "C", 3_30)]);
    const de = (id: number) => porciones.find((p) => p.categoriaId === id)?.porcentaje;
    expect(de(3)).toBe(33);
    expect([de(1), de(2)].sort()).toEqual([33, 34]);
    expect(suma(porciones.map((p) => p.porcentaje))).toBe(100);
  });

  it("los puntos que faltan van a los residuos mayores, uno por categoría", () => {
    // Sobre 145,00: 6,90 · 13,79 · 20,69 · 27,59 · 31,03. Los enteros suman 97; los tres puntos van a 0,90, 0,79 y 0,69.
    const { porciones } = distribuirPorCategoria([
      total(1, "A", 10_00),
      total(2, "B", 20_00),
      total(3, "C", 30_00),
      total(4, "D", 40_00),
      total(5, "E", 45_00),
    ]);
    expect(porciones.map((p) => [p.categoriaId, p.porcentaje])).toEqual([
      [5, 31],
      [4, 27],
      [3, 21],
      [2, 14],
      [1, 7],
    ]);
  });

  it('una categoría con monto mayor que cero cuyo entero da 0 se marca para "<1 %"', () => {
    const { porciones } = distribuirPorCategoria([total(1, "Comida", 990_00), total(2, "Salud", 50)]);
    expect(porciones.find((p) => p.categoriaId === 2)).toMatchObject({ porcentaje: 0, menosDeUno: true });
    expect(porciones.find((p) => p.categoriaId === 1)).toMatchObject({ porcentaje: 100, menosDeUno: false });
  });

  it('"<1 %" es por el entero que queda: 0,6 % recibe el punto del mayor residuo y se lee 1 %', () => {
    const { porciones } = distribuirPorCategoria([total(1, "Comida", 9_94), total(2, "Salud", 6)]);
    expect(porciones.map((p) => [p.porcentaje, p.menosDeUno])).toEqual([
      [99, false],
      [1, false],
    ]);
  });

  it('catorce categorías de un centavo junto a una grande: todas "<1 %" y la suma sigue en 100', () => {
    const pequenas = Array.from({ length: 14 }, (_, i) => total(i + 2, `C${i}`, 1));
    const { porciones } = distribuirPorCategoria([total(1, "Grande", 10_000_00), ...pequenas]);
    expect(porciones.filter((p) => p.menosDeUno)).toHaveLength(14);
    expect(porciones[0]).toMatchObject({ categoriaId: 1, porcentaje: 100, menosDeUno: false });
    expect(suma(porciones.map((p) => p.porcentaje))).toBe(100);
  });

  it("con total cero no hay porcentajes", () => {
    expect(distribuirPorCategoria([])).toEqual({ total: 0, porciones: [] });
    expect(distribuirPorCategoria([total(1, "Comida", 0), total(2, "Salud", 0)])).toEqual({ total: 0, porciones: [] });
  });
});
