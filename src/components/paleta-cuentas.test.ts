import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  El amarillo de la cuenta de cripto vive en un token de globals.css (regla dura: nada de colores sueltos). Es el
  único tono de las cuentas que no viene de la paleta de categorías: lleva el icono en pino oscuro, no en blanco,
  así que necesita buen contraste con ese pino en los dos temas. Los demás tonos ya los prueba paleta-categorias.
*/

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

function bloque(selector: string): string {
  const inicio = css.indexOf(`${selector} {`);
  return inicio < 0 ? "" : css.slice(inicio, css.indexOf("\n}", inicio));
}

function token(texto: string, nombre: string): string | undefined {
  return new RegExp(`--${nombre}:\\s*(#[0-9a-fA-F]{6})`).exec(texto)?.[1];
}

function luminancia(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a: string, b: string): number {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
}

const claro = bloque(":root");
const oscuro = bloque(':root[data-tema="oscuro"]');

describe("paleta de cuentas", () => {
  it("el amarillo de cripto tiene token y está en Tailwind", () => {
    expect(token(claro, "cuenta-cripto")).toBeDefined();
    expect(css).toContain("--color-cuenta-cripto: var(--cuenta-cripto);");
  });

  it("el icono en pino oscuro da 4.5:1 o más sobre el amarillo, en los dos temas", () => {
    for (const tema of [claro, oscuro]) {
      const amarillo = token(tema, "cuenta-cripto") ?? token(claro, "cuenta-cripto") ?? "#000000";
      const pino = token(tema, "palida-texto") ?? token(claro, "palida-texto") ?? "#ffffff";
      expect(contraste(amarillo, pino)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
