/** Spec 008, criterios 1, 3 y 5: el nombre de una etiqueta, su clave sin duplicados por tipeo, y el id del filtro. */
import { describe, expect, it } from "vitest";
import { coloresCategoria } from "./categorias";
import {
  colorDeEtiqueta,
  conEtiqueta,
  coincidenConEtiqueta,
  etiquetaIgual,
  leerIdEtiqueta,
  nombreDeEtiqueta,
} from "./etiquetas";

describe("★ 1 · nombreDeEtiqueta: el nombre limpio y su clave", () => {
  it("sin espacios de más, con su grafía; la clave sin mayúsculas, acentos ni espacios de más", () => {
    expect(nombreDeEtiqueta("  Rafael   G ")).toEqual({ ok: true, nombre: "Rafael G", clave: "rafael g" });
    expect(nombreDeEtiqueta("Kumía")).toEqual({ ok: true, nombre: "Kumía", clave: "kumia" });
  });

  it("SAX, sax y Sax tienen la misma clave", () => {
    const claves = ["SAX", "sax", " Sax "].map((n) => {
      const r = nombreDeEtiqueta(n);
      return r.ok ? r.clave : null;
    });
    expect(new Set(claves)).toEqual(new Set(["sax"]));
  });

  it("vacío, de más de 30 o con caracteres de control: el error del campo", () => {
    expect(nombreDeEtiqueta("   ")).toEqual({ ok: false, error: "Escribe el nombre de la etiqueta" });
    expect(nombreDeEtiqueta("a".repeat(31))).toEqual({ ok: false, error: "Hasta 30 caracteres" });
    expect(nombreDeEtiqueta("SAX\u0000")).toEqual({ ok: false, error: "Usa letras, cifras y signos comunes" });
    expect(nombreDeEtiqueta("a".repeat(30)).ok).toBe(true);
  });
});

describe("★ 3 · lo que se escribe en el campo", () => {
  const etiquetas = [
    { id: 1, nombre: "SAX" },
    { id: 2, nombre: "Rielco" },
    { id: 3, nombre: "Rafael G" },
  ];

  it("filtra las píldoras por lo que contiene, sin importar mayúsculas ni acentos", () => {
    expect(coincidenConEtiqueta(etiquetas, "r").map((e) => e.id)).toEqual([2, 3]);
    expect(coincidenConEtiqueta(etiquetas, "RIÉL").map((e) => e.id)).toEqual([2]);
    expect(coincidenConEtiqueta(etiquetas, "  ").map((e) => e.id)).toEqual([1, 2, 3]);
  });

  it("encuentra la que es igual para no crear otra", () => {
    expect(etiquetaIgual(etiquetas, " sax ")?.id).toBe(1);
    expect(etiquetaIgual(etiquetas, "sa")).toBeUndefined();
  });
});

describe("★ 4 · conEtiqueta: solo el gasto o el ingreso la llevan", () => {
  const filas = [
    { tipo: "gasto", etiquetaId: null },
    { tipo: "transferencia", etiquetaId: null },
    { tipo: "ingreso", etiquetaId: null },
    { tipo: "reasignacion", etiquetaId: null },
  ];

  it("la pone en el gasto y el ingreso, y deja sin ella la venta y el reparto", () => {
    expect(conEtiqueta(filas, 9).map((f) => f.etiquetaId)).toEqual([9, null, 9, null]);
  });

  it("sin etiqueta, las filas quedan como venían", () => {
    expect(conEtiqueta(filas, null)).toBe(filas);
  });
});

describe("★ 5 · leerIdEtiqueta: el id del filtro", () => {
  it("un entero positivo dentro de un integer", () => {
    expect(leerIdEtiqueta("12")).toBe(12);
    expect(leerIdEtiqueta("2147483647")).toBe(2_147_483_647);
  });

  it("cualquier otra cosa: null, no filtra", () => {
    for (const v of [undefined, "", "0", "-1", "1.5", "abc", "2147483648", "12abc", ["1", "2"]]) {
      expect(leerIdEtiqueta(v)).toBeNull();
    }
  });
});

describe("colorDeEtiqueta: el color de su porción en el anillo de Ingresos", () => {
  it("cada etiqueta tiene siempre el mismo color de la paleta, y las 11 primeras, distintos", () => {
    const colores = Array.from({ length: 11 }, (_, i) => colorDeEtiqueta(i + 1));
    expect(new Set(colores).size).toBe(11);
    expect(colores.every((c) => (coloresCategoria as readonly string[]).includes(c))).toBe(true);
    expect(colorDeEtiqueta(12)).toBe(colorDeEtiqueta(1));
    expect(colorDeEtiqueta(4)).toBe(colorDeEtiqueta(4));
  });

  it('"Sin etiqueta" es gris, y ninguna etiqueta lo es', () => {
    expect(colorDeEtiqueta(null)).toBe("pizarra");
    expect(Array.from({ length: 30 }, (_, i) => colorDeEtiqueta(i + 1))).not.toContain("pizarra");
  });
});
