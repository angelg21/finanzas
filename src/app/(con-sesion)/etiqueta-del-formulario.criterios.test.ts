/**
 * Criterios de la spec 008 que decide etiquetaDelFormulario, escritos desde su texto, con la base simulada para contar
 * qué se le pide:
 *   ★ 2 · se elige una de las existentes; sin etiqueta es lo normal y no pide nada más;
 *   ★ 3 · lo escrito en el campo se pide para crearla al guardar;
 *   ★ 7 · la captura de gasto no se vuelve más lenta: sin etiqueta no hay ninguna consulta ni escritura nueva.
 * Y nunca escribe: la etiqueta nueva la crea la transacción que guarda el movimiento, para que un formulario que no se
 * guarda no deje etiquetas (revisión de la 006, hallazgo 1). Que se cree al guardar, que no quede si no se guarda y
 * que "SAX" y "sax" terminen en la misma fila lo comprueban scripts/comprobar-006.ts y comprobar-008.ts contra la base.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const base = vi.hoisted(() => ({
  buscarOCrearEtiqueta: vi.fn(async (texto: string) => ({ id: 41, nombre: texto.trim() })),
  etiquetaPorId: vi.fn(async (id: number) => (id === 7 ? { id: 7, nombre: "SAX" } : null)),
}));
vi.mock("@/db/etiquetas", () => base);

const { etiquetaDelFormulario } = await import("./etiqueta-del-formulario");

function formulario(campos: Record<string, string>) {
  const datos = new FormData();
  for (const [k, v] of Object.entries(campos)) datos.set(k, v);
  return datos;
}
const consultas = () => base.buscarOCrearEtiqueta.mock.calls.length + base.etiquetaPorId.mock.calls.length;

beforeEach(() => {
  base.buscarOCrearEtiqueta.mockClear();
  base.etiquetaPorId.mockClear();
});

describe("★ 7 · sin etiqueta, ni una consulta ni una escritura", () => {
  it("sin los campos, o con los dos vacíos, ninguna etiqueta y la base sin tocar", async () => {
    const casos: Record<string, string>[] = [
      {},
      { etiquetaId: "", etiquetaNueva: "" },
      { etiquetaId: "", etiquetaNueva: "   " },
    ];
    for (const campos of casos) {
      expect(await etiquetaDelFormulario(formulario(campos))).toEqual({ ok: true, etiqueta: null });
    }
    expect(consultas()).toBe(0);
  });

  it("un id que no es un entero positivo tampoco consulta: es como no elegir ninguna", async () => {
    for (const etiquetaId of ["abc", "-3", "0", "1.5", "99999999999"]) {
      expect(await etiquetaDelFormulario(formulario({ etiquetaId }))).toEqual({ ok: true, etiqueta: null });
    }
    expect(consultas()).toBe(0);
  });
});

describe("★ 2 · elegir una de las existentes", () => {
  it("la píldora elegida se pide si existe", async () => {
    expect(await etiquetaDelFormulario(formulario({ etiquetaId: "7" }))).toEqual({ ok: true, etiqueta: { id: 7 } });
    expect(base.etiquetaPorId).toHaveBeenCalledWith(7);
  });

  it("si se borró mientras tanto, no se guarda con una etiqueta que no existe y lo dice", async () => {
    expect(await etiquetaDelFormulario(formulario({ etiquetaId: "8" }))).toEqual({
      ok: false,
      error: "Esa etiqueta ya no existe",
    });
  });
});

describe("★ 3 · crearla ahí mismo, al guardar", () => {
  it("lo escrito se pide como nueva, con los espacios de más quitados, sin crearla todavía", async () => {
    expect(await etiquetaDelFormulario(formulario({ etiquetaNueva: "  Rielco   G " }))).toEqual({
      ok: true,
      etiqueta: { nueva: "Rielco G" },
    });
    expect(consultas()).toBe(0);
  });

  // Con JavaScript no llegan las dos (tocar una píldora borra lo escrito); sin él, sí, y la spec dice que manda lo escrito.
  it("sin JavaScript, si llegan las dos, lo escrito manda sobre la píldora elegida", async () => {
    expect(await etiquetaDelFormulario(formulario({ etiquetaId: "7", etiquetaNueva: "KumIA" }))).toEqual({
      ok: true,
      etiqueta: { nueva: "KumIA" },
    });
    expect(consultas()).toBe(0);
  });

  it("un nombre de más de 30 no se pide: el error del campo, sin tocar la base", async () => {
    const r = await etiquetaDelFormulario(formulario({ etiquetaNueva: "x".repeat(31) }));
    expect(r).toEqual({ ok: false, error: "Hasta 30 caracteres" });
    expect(consultas()).toBe(0);
  });
});

describe("nunca escribe: la etiqueta nueva la crea quien guarda", () => {
  it("en ningún caso llama a buscarOCrearEtiqueta", async () => {
    const casos: Record<string, string>[] = [
      { etiquetaNueva: "SAX" },
      { etiquetaId: "7" },
      { etiquetaId: "8" },
      { etiquetaId: "7", etiquetaNueva: "Nueva" },
      {},
    ];
    for (const campos of casos) await etiquetaDelFormulario(formulario(campos));
    expect(base.buscarOCrearEtiqueta).not.toHaveBeenCalled();
  });
});
