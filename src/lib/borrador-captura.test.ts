import { describe, expect, it } from "vitest";
import { borradorATexto, borradorDesdeTexto, esVuelta, vueltaConCategoria } from "./borrador-captura";

const rutas = ["/nuevo/gasto"];
const ahora = Date.UTC(2026, 9, 12, 15, 0);
const minuto = 60_000;

describe("borrador de la captura en la pestaña: se guarda al tocar «Nueva» (criterio 25)", () => {
  it("ida y vuelta: lo que se lee es lo que se guardó, solo los campos con algo, también con acentos", () => {
    const borrador = {
      forma: "vendiendo",
      monto: "2100",
      tasa: "241,8",
      vendido: "20",
      cuenta: "3",
      venta: "1",
      sobre: "3",
      fecha: "ayer",
      nota: "pan & café",
    };
    expect(borradorDesdeTexto(borradorATexto({ ...borrador, categoria: "", otro: "" } as never, ahora), ahora)).toEqual(
      borrador,
    );
    expect(borradorDesdeTexto(borradorATexto({ monto: "5", nota: "" }, ahora), ahora)).toEqual({ monto: "5" });
  });
  it("caduca a los 30 minutos, y un reloj que retrocede no lo revive", () => {
    const texto = borradorATexto({ monto: "2100" }, ahora);
    expect(borradorDesdeTexto(texto, ahora + 29 * minuto)).toEqual({ monto: "2100" });
    expect(borradorDesdeTexto(texto, ahora + 31 * minuto)).toBeNull();
    expect(borradorDesdeTexto(texto, ahora - minuto)).toBeNull();
  });
  it("sin nada guardado, o con algo que no es un borrador, no hay borrador", () => {
    for (const texto of [null, "", "abc", "[]", "null", "{}", '{"monto":"5"}', `{"guardado":${ahora}}`]) {
      expect(borradorDesdeTexto(texto, ahora)).toBeNull();
    }
    expect(borradorDesdeTexto(borradorATexto({}, ahora), ahora)).toBeNull();
  });
  it("ignora lo que no es del borrador, lo que no es texto y los valores demasiado largos, sin recortar montos", () => {
    const texto = JSON.stringify({
      guardado: ahora,
      monto: "1".repeat(31),
      tasa: 241.8,
      nota: "n".repeat(201),
      vendido: "20",
      categoria: "82",
    });
    expect(borradorDesdeTexto(texto, ahora)).toEqual({ vendido: "20" });
    expect(borradorDesdeTexto(JSON.stringify({ guardado: ahora, nota: "n".repeat(200) }), ahora)?.nota).toHaveLength(
      200,
    );
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
