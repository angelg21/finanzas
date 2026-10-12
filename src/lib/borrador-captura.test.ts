import { describe, expect, it } from "vitest";
import { borradorDesdeParametros, direccionConBorrador, esVuelta, vueltaConCategoria } from "./borrador-captura";

const rutas = ["/nuevo/gasto"];

describe("direccionConBorrador: lo escrito en la captura viaja en la dirección (criterio 25)", () => {
  it("lleva solo los campos con algo, en la ruta de la captura", () => {
    const direccion = direccionConBorrador("/nuevo/gasto", {
      forma: "vendiendo",
      monto: "2100",
      tasa: "241,8",
      vendido: "20",
      cuenta: "3",
      venta: "1",
      sobre: "",
      fecha: "hoy",
      nota: "",
    });
    const url = new URL(direccion, "http://local");
    expect(url.pathname).toBe("/nuevo/gasto");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      forma: "vendiendo",
      monto: "2100",
      tasa: "241,8",
      vendido: "20",
      cuenta: "3",
      venta: "1",
      fecha: "hoy",
    });
  });
  it("sin nada escrito es la ruta sola", () => {
    expect(direccionConBorrador("/nuevo/gasto", { monto: "", nota: "" })).toBe("/nuevo/gasto");
  });
  it("ida y vuelta: lo que sale de la dirección es lo que entró, también con espacios y acentos", () => {
    const borrador = { monto: "19,99", tasa: "241.8", sobre: "3", fecha: "2026-10-05", nota: "pan & café" };
    const url = new URL(direccionConBorrador("/nuevo/gasto", borrador), "http://local");
    expect(borradorDesdeParametros(Object.fromEntries(url.searchParams))).toEqual(borrador);
  });
});

describe("borradorDesdeParametros", () => {
  it("ignora lo que no es del borrador, las listas y los valores demasiado largos, sin recortar montos", () => {
    expect(
      borradorDesdeParametros({
        monto: "1".repeat(31),
        tasa: ["241,8", "1"],
        nota: "n".repeat(201),
        vendido: "20",
        categoria: "82",
        otro: "x",
      }),
    ).toEqual({ vendido: "20" });
  });
  it("una nota de hasta 200 caracteres pasa entera", () => {
    expect(borradorDesdeParametros({ nota: "n".repeat(200) }).nota).toHaveLength(200);
  });
});

describe("vueltaConCategoria: tras crear o restaurar, a la captura con la categoría elegida", () => {
  it("conserva el borrador y añade la categoría", () => {
    expect(vueltaConCategoria("/nuevo/gasto?forma=vendiendo&monto=2100", 82, rutas)).toBe(
      "/nuevo/gasto?forma=vendiendo&monto=2100&categoria=82",
    );
  });
  it("sin borrador, solo la categoría; una categoría anterior se reemplaza", () => {
    expect(vueltaConCategoria("/nuevo/gasto", 82, rutas)).toBe("/nuevo/gasto?categoria=82");
    expect(vueltaConCategoria("/nuevo/gasto?categoria=1&monto=5", 82, rutas)).toBe("/nuevo/gasto?categoria=82&monto=5");
  });
  it("nunca vuelve a otro sitio ni a otra ruta", () => {
    for (const volver of [
      "",
      "https://malo.com/nuevo/gasto",
      "//malo.com/nuevo/gasto",
      "\\\\malo.com/nuevo/gasto",
      "javascript:alert(1)",
      "/categorias",
      "/nuevo/gasto/../../categorias",
      "nuevo/gasto",
    ]) {
      expect(esVuelta(volver, rutas)).toBe(false);
      expect(vueltaConCategoria(volver, 82, rutas)).toBeNull();
    }
  });
  it("la ruta de la captura, con o sin borrador, es una vuelta válida", () => {
    expect(esVuelta("/nuevo/gasto", rutas)).toBe(true);
    expect(esVuelta("/nuevo/gasto?monto=2100&forma=vendiendo", rutas)).toBe(true);
  });
});
