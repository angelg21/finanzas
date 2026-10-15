/**
 * Criterio 11 de la spec 004: lo que se teclea en /sobres/reglas, leído y validado antes de guardar.
 */
import { describe, expect, it } from "vitest";
import {
  type EntradaRegla,
  formatearPorcentaje,
  pistaDeRegla,
  reglaEditable,
  validarReglas,
  validarTope,
} from "./reglas";

const gastosDelMes = 2;
const familia = 3;
const emergencia = 4;
const planes = 5;
const inversion = 7;

/** Las reglas sembradas, menos Ocasiones, cuyo aporte se cambia en su desglose. */
const sembradas: EntradaRegla[] = [
  { sobreId: gastosDelMes, tipo: "fijo", valor: "450" },
  { sobreId: familia, tipo: "fijo", valor: "100" },
  { sobreId: emergencia, tipo: "porcentaje", valor: "40" },
  { sobreId: planes, tipo: "porcentaje", valor: "30" },
  { sobreId: inversion, tipo: "porcentaje", valor: "30" },
];

function con(cambios: Record<number, Partial<EntradaRegla>>) {
  return sembradas.map((r) => ({ ...r, ...cambios[r.sobreId] }));
}

function errores(entradas: EntradaRegla[]) {
  const resultado = validarReglas(entradas);
  if (resultado.ok) throw new Error("Se esperaban errores");
  return resultado.errores;
}

describe("★ criterio 11 · validarReglas", () => {
  it("las reglas sembradas: fijos en centavos y porcentajes en puntos base", () => {
    expect(validarReglas(sembradas)).toEqual({
      ok: true,
      reglas: [
        { sobreId: gastosDelMes, tipo: "fijo", valor: 45_000 },
        { sobreId: familia, tipo: "fijo", valor: 10_000 },
        { sobreId: emergencia, tipo: "porcentaje", valor: 4_000 },
        { sobreId: planes, tipo: "porcentaje", valor: 3_000 },
        { sobreId: inversion, tipo: "porcentaje", valor: 3_000 },
      ],
      sinPorcentajes: false,
    });
  });

  it("porcentajes con hasta dos decimales: 33,34 + 33,33 + 33,33", () => {
    const resultado = validarReglas(
      con({ [emergencia]: { valor: "33,34" }, [planes]: { valor: "33,33" }, [inversion]: { valor: "33.33" } }),
    );
    expect(resultado.ok && resultado.reglas.filter((r) => r.tipo === "porcentaje").map((r) => r.valor)).toEqual([
      3_334, 3_333, 3_333,
    ]);
  });

  it('"sin regla" no da regla, y su valor no se lee', () => {
    const resultado = validarReglas(con({ [familia]: { tipo: "ninguna", valor: "abc" } }));
    expect(resultado.ok && resultado.reglas.map((r) => r.sobreId)).toEqual([
      gastosDelMes,
      emergencia,
      planes,
      inversion,
    ]);
  });

  it("no guarda si los porcentajes no suman exactamente 100 %", () => {
    expect(errores(con({ [planes]: { valor: "29,99" } })).total).toMatch(/99,99/);
    expect(errores(con({ [planes]: { valor: "31" } })).total).toMatch(/101/);
    expect(errores(con({ [inversion]: { tipo: "ninguna" } })).total).toBeDefined();
  });

  it("sin ningún porcentaje se puede guardar, y avisa que lo que quede se quedará en Por asignar", () => {
    const soloFijos = con({
      [emergencia]: { tipo: "ninguna" },
      [planes]: { tipo: "ninguna" },
      [inversion]: { tipo: "ninguna" },
    });
    expect(validarReglas(soloFijos)).toMatchObject({ ok: true, sinPorcentajes: true });
    expect(validarReglas([])).toEqual({ ok: true, reglas: [], sinPorcentajes: true });
  });

  it("fijo: de 0,01 a 21.474.836,47 USD (cabeEnRegla)", () => {
    expect(validarReglas(con({ [familia]: { valor: "0,01" } }))).toMatchObject({ ok: true });
    expect(validarReglas(con({ [familia]: { valor: "21474836,47" } }))).toMatchObject({ ok: true });
    for (const valor of ["0", "21474836,48", "-5", "", "abc", "10,555"]) {
      expect(errores(con({ [familia]: { valor } })).sobres?.[familia], valor).toBeDefined();
    }
  });

  it("porcentaje: de 0,01 % a 100 %, con hasta dos decimales", () => {
    const solo = (valor: string): EntradaRegla[] => [{ sobreId: planes, tipo: "porcentaje", valor }];
    expect(validarReglas(solo("100"))).toMatchObject({ ok: true, reglas: [{ valor: 10_000 }] });
    for (const valor of ["0", "0,001", "100,01", "-10", "", "abc"]) {
      expect(errores(solo(valor)).sobres?.[planes], valor).toBeDefined();
    }
  });

  it("un campo con error no se suma: el error es del campo, no del total", () => {
    const resultado = errores(con({ [planes]: { valor: "abc" } }));
    expect(resultado.sobres?.[planes]).toBeDefined();
    expect(resultado.total).toBeUndefined();
  });

  it("un sobre repetido o un tipo desconocido es un error en su campo", () => {
    expect(errores([...sembradas, { sobreId: planes, tipo: "fijo", valor: "1" }]).sobres?.[planes]).toBeDefined();
    const raro = { sobreId: familia, tipo: "otro", valor: "1" } as unknown as EntradaRegla;
    expect(errores([raro]).sobres?.[familia]).toBeDefined();
  });
});

describe("validarTope", () => {
  it("el tope de Emergencia en centavos, mayor que cero y con hasta dos decimales", () => {
    expect(validarTope("2700")).toEqual({ ok: true, centavos: 270_000 });
    expect(validarTope("2.700,50")).toEqual({ ok: true, centavos: 270_050 });
    for (const texto of ["", "0", "-1", "abc", "10,555"]) expect(validarTope(texto).ok, texto).toBe(false);
  });
});

describe("formatearPorcentaje", () => {
  it("puntos base a texto con coma, sin decimales si no los tiene", () => {
    expect(formatearPorcentaje(4_000)).toBe("40 %");
    expect(formatearPorcentaje(3_333)).toBe("33,33 %");
    expect(formatearPorcentaje(1_250)).toBe("12,50 %");
    expect(formatearPorcentaje(10_000)).toBe("100 %");
    expect(formatearPorcentaje(1)).toBe("0,01 %");
  });
});

describe("pistaDeRegla: lo que dice cada fila del reparto (spec 004, pantallas)", () => {
  const fijo = { sobreId: gastosDelMes, orden: 1, tipo: "fijo" as const, valor: 450_00, topeCentavos: null };
  const cuarenta = { sobreId: emergencia, orden: 4, tipo: "porcentaje" as const, valor: 4_000, topeCentavos: 2_700_00 };

  it("un fijo dice cuánto le falta este mes, o que ya está cubierto", () => {
    expect(pistaDeRegla(fijo, 200_00, 0)).toBe("fijo · faltan 250 este mes");
    expect(pistaDeRegla(fijo, 262_50, 0)).toBe("fijo · faltan 187,50 este mes");
    expect(pistaDeRegla(fijo, 450_00, 0)).toBe("fijo · cubierto este mes");
    expect(pistaDeRegla({ ...fijo, valor: 2_000_00 }, 0, 0)).toBe("fijo · faltan 2.000 este mes");
  });

  it("un porcentaje dice su valor, y con tope cuánto le falta o que está lleno", () => {
    expect(pistaDeRegla({ ...cuarenta, topeCentavos: null }, 0, 0)).toBe("40 %");
    expect(pistaDeRegla(cuarenta, 0, 2_050_00)).toBe("40 % · tope 2.700 · faltan 650");
    expect(pistaDeRegla(cuarenta, 0, 2_700_00)).toBe("40 % · tope 2.700 · lleno");
    expect(pistaDeRegla(cuarenta, 0, 3_000_00)).toBe("40 % · tope 2.700 · lleno");
  });
});

describe("reglaEditable: qué sobres se editan en /sobres/reglas", () => {
  it("todos menos Por asignar y los fondos, cuya regla sale de su desglose", () => {
    for (const tipo of ["gastos", "familia", "emergencia", "meta", "inversion"])
      expect(reglaEditable(tipo), tipo).toBe(true);
    expect(reglaEditable("por_asignar")).toBe(false);
    expect(reglaEditable("fondo")).toBe(false);
  });
});
