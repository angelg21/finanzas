/**
 * El script del tema (criterio 17 de la spec 002) corre antes de pintar, sin React: aquí se ejecuta con un documento
 * simulado. El vigilante se llama en cada escritura, como el MutationObserver real, con un tope para que un bucle
 * se cuente en vez de colgar la prueba.
 */
import { describe, expect, it } from "vitest";
import { scriptTemaInicial } from "./tema";

const TOPE = 500;

function correr(guardado: string | null) {
  const escrituras: string[] = [];
  let vigilante: (() => void) | null = null;
  const metas = [0, 1, 2].map(() => {
    let contenido = "#000000";
    return {
      getAttribute: () => contenido,
      setAttribute: (_nombre: string, valor: string) => {
        contenido = valor;
        escrituras.push(valor);
        if (escrituras.length < TOPE) vigilante?.();
      },
      ponerDesdeNext: (valor: string) => {
        contenido = valor;
      },
    };
  });
  const documentElement = { dataset: {} as Record<string, string | undefined> };
  const entorno = {
    document: { documentElement, head: {}, querySelectorAll: () => metas, addEventListener: () => {} },
    location: { search: "" },
    localStorage: { getItem: () => guardado, setItem: () => {} },
    matchMedia: () => ({ matches: false }),
    URLSearchParams,
    MutationObserver: class {
      constructor(alCambiar: () => void) {
        vigilante = alCambiar;
      }
      observe() {}
    },
  };
  new Function(...Object.keys(entorno), scriptTemaInicial)(...Object.values(entorno));
  return { escrituras, metas, documentElement, avisar: () => vigilante?.() };
}

describe("scriptTemaInicial: la barra de estado sigue al tema elegido", () => {
  it("pinta los theme-color con el tema guardado, y repintar sin cambios no escribe nada", () => {
    const { escrituras, metas, avisar } = correr("oscuro");
    expect(metas.map((m) => m.getAttribute())).toEqual(["#15241f", "#15241f", "#15241f"]);
    const antes = escrituras.length;
    avisar();
    expect(escrituras.length).toBe(antes);
  });

  it("cuando Next vuelve a poner los del sistema al navegar, los repinta una vez", () => {
    const { escrituras, metas, avisar } = correr("oscuro");
    const antes = escrituras.length;
    metas.forEach((m) => m.ponerDesdeNext("#f5f6f2"));
    avisar();
    expect(metas.map((m) => m.getAttribute())).toEqual(["#15241f", "#15241f", "#15241f"]);
    expect(escrituras.length).toBe(antes + 3);
  });

  it("con la página de error de Next, un <html> sin tema, no escribe nada: antes escribía «undefined» sin fin", () => {
    const { escrituras, metas, documentElement, avisar } = correr("oscuro");
    const antes = escrituras.length;
    delete documentElement.dataset.tema;
    metas.forEach((m) => m.ponerDesdeNext("#f5f6f2"));
    avisar();
    expect(escrituras.length).toBe(antes);
    expect(escrituras).not.toContain("undefined");
  });
});
