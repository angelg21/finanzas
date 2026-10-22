/**
 * Criterios de la spec 008 que decide etiquetaDelFormulario, escritos desde su texto, con la base simulada para contar
 * qué se le pide:
 *   ★ 2 · se elige una de las existentes; sin etiqueta es lo normal y no pide nada más;
 *   ★ 3 · lo escrito en el campo se busca o se crea al guardar y queda puesto;
 *   ★ 7 · la captura de gasto no se vuelve más lenta: sin etiqueta no hay ninguna consulta ni escritura nueva.
 * Que "SAX" y "sax" terminen en la misma fila, también a la vez, lo comprueba scripts/comprobar-008.ts contra la base.
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
      expect(await etiquetaDelFormulario(formulario(campos))).toEqual({ ok: true, etiquetaId: null });
    }
    expect(consultas()).toBe(0);
  });

  it("un id que no es un entero positivo tampoco consulta: es como no elegir ninguna", async () => {
    for (const etiquetaId of ["abc", "-3", "0", "1.5", "99999999999"]) {
      expect(await etiquetaDelFormulario(formulario({ etiquetaId }))).toEqual({ ok: true, etiquetaId: null });
    }
    expect(consultas()).toBe(0);
  });
});

describe("★ 2 · elegir una de las existentes", () => {
  it("la píldora elegida queda puesta si existe", async () => {
    expect(await etiquetaDelFormulario(formulario({ etiquetaId: "7" }))).toEqual({ ok: true, etiquetaId: 7 });
    expect(base.etiquetaPorId).toHaveBeenCalledWith(7);
    expect(base.buscarOCrearEtiqueta).not.toHaveBeenCalled();
  });

  it("si se borró mientras tanto, no se guarda con una etiqueta que no existe y lo dice", async () => {
    expect(await etiquetaDelFormulario(formulario({ etiquetaId: "8" }))).toEqual({
      ok: false,
      error: "Esa etiqueta ya no existe",
    });
  });
});

describe("★ 3 · crearla ahí mismo", () => {
  it("lo escrito se busca o se crea al guardar, y queda puesto", async () => {
    expect(await etiquetaDelFormulario(formulario({ etiquetaNueva: " Rielco " }))).toEqual({
      ok: true,
      etiquetaId: 41,
    });
    expect(base.buscarOCrearEtiqueta).toHaveBeenCalledTimes(1);
  });

  it("lo escrito manda sobre la píldora elegida", async () => {
    expect(await etiquetaDelFormulario(formulario({ etiquetaId: "7", etiquetaNueva: "KumIA" }))).toEqual({
      ok: true,
      etiquetaId: 41,
    });
    expect(base.etiquetaPorId).not.toHaveBeenCalled();
  });

  it("un nombre de más de 30 no se crea: el error del campo, sin tocar la base", async () => {
    const r = await etiquetaDelFormulario(formulario({ etiquetaNueva: "x".repeat(31) }));
    expect(r.ok).toBe(false);
    expect(consultas()).toBe(0);
  });
});
