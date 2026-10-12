import { describe, expect, it } from "vitest";
import { coloresCategoria, iconoPorDefecto, iconosCategoria } from "@/lib/categorias";
import { fondoDe, iconoDe, tieneIcono } from "./iconos-categoria";

describe("registro de iconos y colores de categoría", () => {
  it("cada icono del catálogo tiene su icono de lucide", () => {
    const sinIcono = iconosCategoria.filter((i) => !tieneIcono(i.nombre)).map((i) => i.nombre);
    expect(sinIcono).toEqual([]);
  });
  it("no hay dos nombres con el mismo dibujo", () => {
    const dibujos = iconosCategoria.map((i) => iconoDe(i.nombre));
    expect(new Set(dibujos).size).toBe(dibujos.length);
  });
  it("un nombre desconocido usa el icono por defecto en vez de romper la pantalla", () => {
    expect(tieneIcono("cohete-inventado")).toBe(false);
    expect(iconoDe("cohete-inventado")).toBe(iconoDe(iconoPorDefecto));
    expect(iconoDe("toString")).toBe(iconoDe(iconoPorDefecto));
  });
  it("cada color tiene su clase de fondo y uno desconocido usa pizarra", () => {
    for (const color of coloresCategoria) expect(fondoDe(color)).toBe(`bg-cat-${color}`);
    expect(fondoDe("#ff0000")).toBe("bg-cat-pizarra");
  });
});
