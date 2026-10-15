import { describe, expect, it } from "vitest";
import { distribuirPorCategoria } from "./distribucion";

const de = (...centavos: number[]) => centavos.map((c, i) => ({ categoriaId: i + 1, centavos: c }));

describe("distribuirPorCategoria", () => {
  it("ordena de mayor a menor y da el total exacto en centavos", () => {
    const { total, porciones } = distribuirPorCategoria(de(10_00, 30_00, 20_00));
    expect(total).toBe(60_00);
    expect(porciones.map((p) => p.categoriaId)).toEqual([2, 3, 1]);
    expect(porciones.reduce((a, p) => a + p.centavos, 0)).toBe(total);
  });

  it("conserva los demás campos de cada categoría", () => {
    const { porciones } = distribuirPorCategoria([{ categoriaId: 7, centavos: 5, nombre: "Comida", color: "coral" }]);
    expect(porciones[0]).toMatchObject({ categoriaId: 7, nombre: "Comida", color: "coral", porcentaje: 100 });
  });

  it("los porcentajes son enteros y suman 100 por mayor residuo", () => {
    expect(distribuirPorCategoria(de(1, 1, 1)).porciones.map((p) => p.porcentaje)).toEqual([34, 33, 33]);
    expect(distribuirPorCategoria(de(2, 1)).porciones.map((p) => p.porcentaje)).toEqual([67, 33]);
    expect(distribuirPorCategoria(de(50, 50)).porciones.map((p) => p.porcentaje)).toEqual([50, 50]);
    // Los montos de la referencia: 41,47 %, 30,23 % y 28,30 %. Ella redondea cada uno y suma 99 (41, 30, 28);
    // aquí el punto que falta va al residuo mayor, 0,47.
    expect(distribuirPorCategoria(de(125_00, 91_12, 85_30)).porciones.map((p) => p.porcentaje)).toEqual([42, 30, 28]);
  });

  it("siempre suman 100, con quince categorías de montos cualesquiera", () => {
    let semilla = 7;
    const azar = () => (semilla = (semilla * 1_103_515_245 + 12_345) % 2_147_483_648);
    for (let vuelta = 0; vuelta < 500; vuelta++) {
      const montos = Array.from({ length: 1 + (azar() % 15) }, () => 1 + (azar() % 5_000_000));
      const { total, porciones } = distribuirPorCategoria(de(...montos));
      expect(porciones.reduce((a, p) => a + p.porcentaje, 0)).toBe(100);
      expect(porciones.reduce((a, p) => a + p.centavos, 0)).toBe(total);
      for (const p of porciones) expect(Number.isInteger(p.porcentaje)).toBe(true);
    }
  });

  it("una categoría con monto que redondea a 0 % se marca como menos de uno", () => {
    const { porciones } = distribuirPorCategoria(de(1, 10_000_00));
    expect(porciones[0]).toMatchObject({ centavos: 10_000_00, porcentaje: 100, menosDeUno: false });
    expect(porciones[1]).toMatchObject({ centavos: 1, porcentaje: 0, menosDeUno: true });
  });

  it("sin montos: total cero y ninguna porción", () => {
    expect(distribuirPorCategoria([])).toEqual({ total: 0, porciones: [] });
    expect(distribuirPorCategoria(de(0, 0))).toEqual({ total: 0, porciones: [] });
  });

  it("rechaza montos que no son centavos enteros", () => {
    expect(() => distribuirPorCategoria(de(10.5))).toThrow();
    expect(() => distribuirPorCategoria(de(-100))).toThrow();
    expect(() => distribuirPorCategoria(de(Number.MAX_SAFE_INTEGER, 1))).toThrow();
  });
});
