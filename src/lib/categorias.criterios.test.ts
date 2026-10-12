/**
 * Criterios ★ 18 a 21 de la spec 001 (ampliación de categorías) que cumplen las reglas puras, escritos
 * desde el texto de cada criterio. Las pruebas de construcción viven en categorias.test.ts. Lo que solo
 * se ve en la base (la misma fila, archivar sin perder movimientos) lo comprueba scripts/comprobar-001.ts.
 */
import { describe, expect, it } from "vitest";
import { type EntradaCategoria, destinoAlEliminar, validarCategoria } from "./categorias";

const existentes = [
  { id: 1, nombre: "Comida", tipo: "gasto" as const, activa: true },
  { id: 2, nombre: "Educación", tipo: "gasto" as const, activa: true },
  { id: 3, nombre: "Otros gastos", tipo: "gasto" as const, activa: true },
  { id: 4, nombre: "Gimnasio", tipo: "gasto" as const, activa: false },
  { id: 5, nombre: "Sueldo remoto", tipo: "ingreso" as const, activa: true },
];

const mascotas: EntradaCategoria = { nombre: "Mascotas", tipo: "gasto", icono: "huella", color: "lavanda" };

function errores(entrada: EntradaCategoria) {
  const resultado = validarCategoria(entrada, existentes);
  if (resultado.ok) throw new Error(`No debía guardarse: ${JSON.stringify(resultado.valores)}`);
  return resultado.errores;
}

describe("★ criterio 18: crear", () => {
  it("Mascotas, de Gasto, con el icono huella y el color lavanda se guarda tal cual", () => {
    expect(validarCategoria(mascotas, existentes)).toEqual({
      ok: true,
      valores: { nombre: "Mascotas", tipo: "gasto", icono: "huella", color: "lavanda" },
    });
  });
});

describe("★ criterio 19: validación", () => {
  it.each([
    ["vacío", ""],
    ["de solo espacios", "   "],
    ["de 41 caracteres", "x".repeat(41)],
  ])("un nombre %s no se guarda y el error sale junto al nombre", (_, nombre) => {
    expect(errores({ ...mascotas, nombre }).nombre).toEqual(expect.any(String));
  });

  it("un nombre de 40 caracteres sí se guarda", () => {
    expect(validarCategoria({ ...mascotas, nombre: "x".repeat(40) }, existentes).ok).toBe(true);
  });

  it.each(["unicornio", "", "Huella"])("el icono %j, fuera del catálogo, no se guarda", (icono) => {
    expect(errores({ ...mascotas, icono }).icono).toEqual(expect.any(String));
  });

  it.each(["#ff0000", "fucsia", ""])("el color %j, fuera del catálogo, no se guarda", (color) => {
    expect(errores({ ...mascotas, color }).color).toEqual(expect.any(String));
  });

  it.each(["comida", "COMIDA", "  Comida  ", "educacion", "EDUCACIÓN", "Otros    gastos"])(
    "%j repite una del mismo tipo sin distinguir mayúsculas, acentos ni espacios de más",
    (nombre) => {
      expect(errores({ ...mascotas, nombre }).nombre).toBe("Ya existe una categoría con ese nombre");
    },
  );

  it("el mismo nombre en el otro tipo no es repetido", () => {
    expect(validarCategoria({ ...mascotas, nombre: "Sueldo remoto" }, existentes).ok).toBe(true);
    expect(validarCategoria({ ...mascotas, nombre: "Comida", tipo: "ingreso" }, existentes).ok).toBe(true);
  });

  it("si la repetida está archivada, no se guarda y se ofrece restaurarla", () => {
    const resultado = validarCategoria({ ...mascotas, nombre: "gimnasio" }, existentes);
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.errores.nombre).toEqual(expect.any(String));
    expect(resultado.archivada).toBe(4);
  });
});

describe("★ criterio 20: editar", () => {
  const comidaConMovimientos = { id: 1, tipo: "gasto" as const, movimientos: 21 };

  it("puede cambiar el nombre, el icono y el color de una categoría con movimientos", () => {
    const resultado = validarCategoria(
      { nombre: "Comida fuera", tipo: "gasto", icono: "bus", color: "azul", edicion: comidaConMovimientos },
      existentes,
    );
    expect(resultado).toEqual({
      ok: true,
      valores: { nombre: "Comida fuera", tipo: "gasto", icono: "bus", color: "azul" },
    });
  });

  it("conservar su propio nombre no cuenta como repetido", () => {
    expect(validarCategoria({ ...mascotas, nombre: "Comida", edicion: comidaConMovimientos }, existentes).ok).toBe(
      true,
    );
  });

  it.each([1, 21])("con %i movimientos el tipo no cambia: un gasto nunca queda con categoría de ingreso", (n) => {
    const edicion = { ...comidaConMovimientos, movimientos: n };
    expect(errores({ ...mascotas, nombre: "Comida", tipo: "ingreso", edicion }).tipo).toEqual(expect.any(String));
  });

  it("sin movimientos el tipo sí cambia", () => {
    const edicion = { ...comidaConMovimientos, movimientos: 0 };
    const resultado = validarCategoria({ ...mascotas, nombre: "Comida", tipo: "ingreso", edicion }, existentes);
    expect(resultado.ok && resultado.valores.tipo).toBe("ingreso");
  });
});

describe("★ criterio 21: eliminar", () => {
  it("una categoría sin movimientos se borra", () => {
    expect(destinoAlEliminar(0)).toBe("borrar");
  });

  it.each([1, 13])("una con %i movimientos se archiva, no se borra", (n) => {
    expect(destinoAlEliminar(n)).toBe("archivar");
  });
});
