import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { coloresCategoria } from "@/lib/categorias";

/*
  La paleta de categorías vive en tokens --cat-* de globals.css (regla dura: nada de colores sueltos).
  El icono va en blanco sobre el color, así que cada tono necesita 3:1 de contraste con el blanco,
  en claro y en oscuro (spec 001, criterio 24).
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

const contrasteConBlanco = (hex: string) => 1.05 / (luminancia(hex) + 0.05);

const claro = bloque(":root");
const oscuro = bloque(':root[data-tema="oscuro"]');

describe("paleta de categorías", () => {
  it.each(coloresCategoria)("%s tiene token en claro y en Tailwind", (color) => {
    expect(token(claro, `cat-${color}`)).toBeDefined();
    expect(css).toContain(`--color-cat-${color}: var(--cat-${color});`);
  });

  it.each(coloresCategoria)("%s da 3:1 o más con el icono blanco en los dos temas", (color) => {
    const enClaro = token(claro, `cat-${color}`) ?? "#ffffff";
    const enOscuro = token(oscuro, `cat-${color}`) ?? enClaro;
    expect(contrasteConBlanco(enClaro)).toBeGreaterThanOrEqual(3);
    expect(contrasteConBlanco(enOscuro)).toBeGreaterThanOrEqual(3);
  });
});
