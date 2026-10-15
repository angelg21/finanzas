/**
 * Criterio ★ 11 de la spec 004 (editar las reglas) en lo que cumplen las funciones puras, escrito desde su texto. Las
 * pruebas de construcción viven en reglas.test.ts. Que guardar sea una transacción, que no toque movimientos y el
 * check de la base (★ 12) los comprueba scripts/comprobar-004.ts.
 */
import { describe, expect, it } from "vitest";
import { type EntradaRegla, reglaEditable, validarReglas, validarTope } from "./reglas";

const gastosDelMes = 2;
const familia = 3;
const emergencia = 7;
const planes = 8;
const inversion = 9;

const regla = (sobreId: number, tipo: EntradaRegla["tipo"], valor: string): EntradaRegla => ({ sobreId, tipo, valor });

const porcentajes = (e: string, p: string, i: string) => [
  regla(emergencia, "porcentaje", e),
  regla(planes, "porcentaje", p),
  regla(inversion, "porcentaje", i),
];

describe("★ 11 · editar las reglas", () => {
  it("cada sobre lleva fijo, porcentaje o ninguna regla", () => {
    const r = validarReglas([
      regla(gastosDelMes, "fijo", "450"),
      regla(familia, "ninguna", ""),
      ...porcentajes("40", "30", "30"),
    ]);
    expect(r).toEqual({
      ok: true,
      sinPorcentajes: false,
      reglas: [
        { sobreId: gastosDelMes, tipo: "fijo", valor: 45_000 },
        { sobreId: emergencia, tipo: "porcentaje", valor: 4_000 },
        { sobreId: planes, tipo: "porcentaje", valor: 3_000 },
        { sobreId: inversion, tipo: "porcentaje", valor: 3_000 },
      ],
    });
  });

  it.each([
    ["0,01", 1],
    ["21.474.836,47", 2_147_483_647],
  ])("un fijo de %s vale", (valor, centavos) => {
    const r = validarReglas([regla(gastosDelMes, "fijo", valor)]);
    expect(r).toMatchObject({ ok: true, reglas: [{ valor: centavos }] });
  });

  it.each(["0", "21.474.836,48", "-5", "10,555", ""])("un fijo de %j se rechaza en su campo", (valor) => {
    const r = validarReglas([regla(gastosDelMes, "fijo", valor), ...porcentajes("40", "30", "30")]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores.sobres?.[gastosDelMes]).toBeDefined();
  });

  it("un porcentaje con dos decimales se guarda en puntos base", () => {
    const r = validarReglas(porcentajes("33,33", "33,33", "33,34"));
    expect(r).toMatchObject({ ok: true, reglas: [{ valor: 3_333 }, { valor: 3_333 }, { valor: 3_334 }] });
  });

  it("del 0,01 % al 100 %", () => {
    expect(validarReglas([regla(planes, "porcentaje", "100")])).toMatchObject({ ok: true });
    const minimo = validarReglas([regla(planes, "porcentaje", "0,01"), regla(inversion, "porcentaje", "99,99")]);
    expect(minimo).toMatchObject({ ok: true, reglas: [{ valor: 1 }, { valor: 9_999 }] });
  });

  it.each(["0", "100,01", "-1", "33,333", "abc"])("un porcentaje de %j se rechaza en su campo", (valor) => {
    const r = validarReglas([regla(planes, "porcentaje", valor), regla(inversion, "porcentaje", "100")]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores.sobres?.[planes]).toBeDefined();
  });

  it.each([
    ["suman menos", ["40", "30", "29,99"]],
    ["suman más", ["40", "30", "30,01"]],
    ["el 95 % de la prueba en el navegador", ["40", "30", "25"]],
  ])("no se guarda si los porcentajes no suman 100 %%: %s", (_, [e, p, i]) => {
    const r = validarReglas(porcentajes(e!, p!, i!));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores.total).toBeDefined();
  });

  it("sin ningún porcentaje se guarda, avisando de que lo que quede irá a Por asignar", () => {
    const r = validarReglas([regla(gastosDelMes, "fijo", "450"), regla(planes, "ninguna", "")]);
    expect(r).toMatchObject({ ok: true, sinPorcentajes: true });
  });

  it("el tope de Emergencia se edita aquí", () => {
    expect(validarTope("2.700,00")).toEqual({ ok: true, centavos: 270_000 });
    expect(validarTope("0").ok).toBe(false);
    expect(validarTope("").ok).toBe(false);
  });

  it("Por asignar no lleva regla, y la de un fondo se cambia en su desglose", () => {
    expect(reglaEditable("por_asignar")).toBe(false);
    expect(reglaEditable("fondo")).toBe(false);
    expect(reglaEditable("gastos")).toBe(true);
    expect(reglaEditable("emergencia")).toBe(true);
  });
});
