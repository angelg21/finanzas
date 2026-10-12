import { describe, expect, it } from "vitest";
import {
  type EntradaCategoria,
  buscarIconos,
  categoriasBase,
  coloresCategoria,
  destinoAlEliminar,
  iconosCategoria,
  repetidaDe,
  validarCategoria,
} from "./categorias";

const existentes = [
  { id: 1, nombre: "Comida", tipo: "gasto" as const, activa: true },
  { id: 2, nombre: "Educación", tipo: "gasto" as const, activa: true },
  { id: 3, nombre: "Gimnasio", tipo: "gasto" as const, activa: false },
  { id: 4, nombre: "Sueldo remoto", tipo: "ingreso" as const, activa: true },
];

function entrada(cambios: Partial<EntradaCategoria>): EntradaCategoria {
  return { nombre: "Mascotas", tipo: "gasto", icono: "huella", color: "lavanda", ...cambios };
}

describe("catálogo", () => {
  it("unos 100 iconos con nombre único, en minúsculas y sin acentos, y palabras para buscarlos", () => {
    expect(iconosCategoria.length).toBeGreaterThanOrEqual(90);
    const nombres = iconosCategoria.map((i) => i.nombre);
    expect(new Set(nombres).size).toBe(nombres.length);
    for (const icono of iconosCategoria) {
      expect(icono.nombre).toMatch(/^[a-z0-9-]+$/);
      expect(icono.palabras.length).toBeGreaterThan(0);
    }
  });
  it("incluye los valores por defecto de la base y los del ejemplo de la spec", () => {
    const nombres = iconosCategoria.map((i) => i.nombre);
    expect(nombres).toContain("etiqueta");
    expect(nombres).toContain("huella");
    expect(coloresCategoria).toContain("pizarra");
    expect(coloresCategoria).toContain("lavanda");
  });
  it("doce colores con nombre único", () => {
    expect(coloresCategoria).toHaveLength(12);
    expect(new Set(coloresCategoria).size).toBe(12);
  });
});

describe("validarCategoria: crear (criterios 18 y 19)", () => {
  it("acepta una categoría nueva y deja el nombre limpio", () => {
    expect(validarCategoria(entrada({ nombre: "  Mascotas   de   casa " }), existentes)).toEqual({
      ok: true,
      valores: { nombre: "Mascotas de casa", tipo: "gasto", icono: "huella", color: "lavanda" },
    });
  });
  it("rechaza el nombre vacío o de más de 40 caracteres", () => {
    expect(validarCategoria(entrada({ nombre: "   " }), existentes)).toMatchObject({
      ok: false,
      errores: { nombre: expect.any(String) },
    });
    expect(validarCategoria(entrada({ nombre: "x".repeat(41) }), existentes)).toMatchObject({ ok: false });
    expect(validarCategoria(entrada({ nombre: "x".repeat(40) }), existentes).ok).toBe(true);
  });
  it("rechaza un icono o un color fuera del catálogo", () => {
    const r = validarCategoria(entrada({ icono: "cohete-inventado", color: "fucsia" }), existentes);
    expect(r).toMatchObject({ ok: false, errores: { icono: expect.any(String), color: expect.any(String) } });
  });
  it("rechaza un tipo que no es gasto ni ingreso", () => {
    expect(validarCategoria(entrada({ tipo: "otro" as never }), existentes)).toMatchObject({
      ok: false,
      errores: { tipo: expect.any(String) },
    });
  });
  it("un nombre repetido en el mismo tipo, sin distinguir mayúsculas, acentos ni espacios, es error", () => {
    for (const nombre of ["comida", "  COMIDA ", "educacion", "Educación"]) {
      expect(validarCategoria(entrada({ nombre }), existentes)).toMatchObject({
        ok: false,
        errores: { nombre: "Ya existe una categoría con ese nombre" },
      });
    }
  });
  it("el mismo nombre en el otro tipo sí se permite", () => {
    expect(validarCategoria(entrada({ nombre: "Comida", tipo: "ingreso" }), existentes).ok).toBe(true);
  });
  it("si la repetida está archivada, ofrece restaurarla", () => {
    expect(validarCategoria(entrada({ nombre: "gimnasio" }), existentes)).toMatchObject({ ok: false, archivada: 3 });
  });
});

describe("validarCategoria: editar (criterio 20)", () => {
  it("puede conservar su propio nombre y cambiar icono y color", () => {
    const r = validarCategoria(
      entrada({
        nombre: "Comida",
        icono: "cubiertos",
        color: "coral",
        edicion: { id: 1, tipo: "gasto", movimientos: 13 },
      }),
      existentes,
    );
    expect(r.ok).toBe(true);
  });
  it("no puede tomar el nombre de otra", () => {
    const r = validarCategoria(
      entrada({ nombre: "educación", edicion: { id: 1, tipo: "gasto", movimientos: 13 } }),
      existentes,
    );
    expect(r).toMatchObject({ ok: false, errores: { nombre: expect.any(String) } });
  });
  it("con movimientos no puede cambiar de tipo; sin ellos, sí", () => {
    const conMovimientos = validarCategoria(
      entrada({ nombre: "Comida", tipo: "ingreso", edicion: { id: 1, tipo: "gasto", movimientos: 13 } }),
      existentes,
    );
    expect(conMovimientos).toMatchObject({ ok: false, errores: { tipo: expect.any(String) } });
    const sinMovimientos = validarCategoria(
      entrada({ nombre: "Comida", tipo: "ingreso", edicion: { id: 1, tipo: "gasto", movimientos: 0 } }),
      existentes,
    );
    expect(sinMovimientos.ok).toBe(true);
  });
});

describe("destinoAlEliminar (criterio 21)", () => {
  it("sin movimientos se borra; con alguno, se archiva", () => {
    expect(destinoAlEliminar(0)).toBe("borrar");
    expect(destinoAlEliminar(1)).toBe("archivar");
    expect(destinoAlEliminar(13)).toBe("archivar");
  });
});

describe("buscarIconos (criterio 23)", () => {
  const nombres = (texto: string) => buscarIconos(texto).map((i) => i.nombre);
  it("sin texto devuelve todo el catálogo", () => {
    expect(buscarIconos("")).toHaveLength(iconosCategoria.length);
    expect(buscarIconos("   ")).toHaveLength(iconosCategoria.length);
  });
  it("busca por palabras en español sin distinguir acentos ni mayúsculas", () => {
    expect(nombres("carro")).toContain("auto");
    expect(nombres("CAFÉ")).toContain("cafe");
    expect(nombres("cafe")).toContain("cafe");
    expect(nombres("mascota")).toContain("huella");
  });
  it("también encuentra por el nombre del icono", () => {
    expect(nombres("huella")).toContain("huella");
  });
  it("lo que no existe no devuelve nada", () => {
    expect(buscarIconos("zzzz")).toEqual([]);
  });
});

describe("categoriasBase (criterio 26)", () => {
  it("las 15 de la semilla: 12 de gasto y 3 de ingreso, sin nombres repetidos por tipo", () => {
    expect(categoriasBase).toHaveLength(15);
    expect(categoriasBase.filter((c) => c.tipo === "gasto")).toHaveLength(12);
    expect(categoriasBase.filter((c) => c.tipo === "ingreso")).toHaveLength(3);
    const claves = categoriasBase.map((c) => `${c.tipo}:${c.nombre}`);
    expect(new Set(claves).size).toBe(claves.length);
  });
  it("cada una con un icono y un color del catálogo, distintos de los valores por defecto", () => {
    const iconos = iconosCategoria.map((i) => i.nombre);
    for (const c of categoriasBase) {
      expect(iconos, c.nombre).toContain(c.icono);
      expect(coloresCategoria, c.nombre).toContain(c.color);
      expect(c.icono === "etiqueta" && c.color === "pizarra", c.nombre).toBe(false);
    }
  });
});

describe("repetidaDe: restaurar una archivada (criterio 22)", () => {
  const conChoque = [...existentes, { id: 9, nombre: "gimnasio", tipo: "gasto" as const, activa: true }];
  it("encuentra la activa con un nombre equivalente, sin contarse a sí misma", () => {
    expect(repetidaDe("Gimnasio", "gasto", conChoque, 3)).toMatchObject({ id: 9, activa: true });
  });
  it("sin otra con ese nombre en el mismo tipo, no hay choque", () => {
    expect(repetidaDe("Gimnasio", "gasto", existentes, 3)).toBeUndefined();
    expect(repetidaDe("Gimnasio", "ingreso", conChoque)).toBeUndefined();
  });
});
