import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  El anillo de Sobres usa tres tramas del mismo pino sobre blanco: rayado (Familia), puntos (fondos) y rejilla
  (Deudas, spec 005). Las tres se distinguen por la forma, no por el color, así que basta con que el pino se lea sobre
  el blanco en los dos temas, y que cada trama exista en el anillo y en el icono del sobre.
*/

const raiz = new URL("../", import.meta.url);
const css = readFileSync(new URL("app/globals.css", raiz), "utf8");
const dona = readFileSync(new URL("components/grafica-dona.tsx", raiz), "utf8");
const icono = readFileSync(new URL("components/icono-sobre.tsx", raiz), "utf8");

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

describe("paleta de sobres: las tramas del anillo", () => {
  it("el pino de las tramas da 3:1 o más sobre el blanco, en los dos temas", () => {
    for (const tema of [bloque(":root"), bloque(':root[data-tema="oscuro"]')]) {
      const pino = token(tema, "dona-5") ?? token(bloque(":root"), "dona-5") ?? "#ffffff";
      const blanco = token(tema, "dona-3") ?? token(bloque(":root"), "dona-3") ?? "#ffffff";
      expect(contraste(pino, blanco)).toBeGreaterThanOrEqual(3);
    }
  });

  it("la rejilla de Deudas está en el anillo, en su leyenda y en el icono del sobre", () => {
    expect(dona).toMatch(/idRejilla/);
    expect(dona).toMatch(/rejillaCss/);
    expect(icono).toMatch(/patron: "rejilla"/);
  });
});
