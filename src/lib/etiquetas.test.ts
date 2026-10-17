/** Spec 007, criterios 4 y 6: las etiquetas con # de una nota, y la del filtro, validada antes de llegar a una consulta. */
import { describe, expect, it } from "vitest";
import { etiquetasDe, leerEtiqueta, patronDeEtiqueta } from "./etiquetas";

describe("etiquetasDe", () => {
  it("cada palabra con #, en minúsculas y sin repetir, en el orden en que aparecen", () => {
    expect(etiquetasDe("Pago de octubre #SAX #Rielco #sax")).toEqual(["sax", "rielco"]);
    expect(etiquetasDe("#año-2026 y #proyecto_local.")).toEqual(["año-2026", "proyecto_local"]);
  });

  it("sin nota o sin #, ninguna; un # suelto o pegado a una palabra no cuenta", () => {
    for (const nota of [null, "", "sin etiquetas", "# suelto", "correo#raro"]) expect(etiquetasDe(nota)).toEqual([]);
  });
});

describe("★ 6 · leerEtiqueta: solo letras, cifras, _ y -, hasta 30", () => {
  it("válida, en minúsculas y sin el # si lo trae", () => {
    expect(leerEtiqueta("SAX")).toBe("sax");
    expect(leerEtiqueta("#Rielco")).toBe("rielco");
  });

  it("inválida o repetida en la dirección: null, no filtra", () => {
    for (const v of [undefined, "", " ", "a b", "x'; drop", "%", "a".repeat(31), ["sax", "rielco"]]) {
      expect(leerEtiqueta(v)).toBeNull();
    }
  });

  it("el patrón de la consulta solo lleva la etiqueta validada, con sus bordes", () => {
    expect(patronDeEtiqueta("sax")).toBe("(^|[^[:alnum:]_])#sax($|[^[:alnum:]_-])");
  });
});
