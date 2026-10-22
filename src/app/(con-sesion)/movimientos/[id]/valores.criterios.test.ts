/**
 * Criterios de la spec 006 que se deciden en valores.ts, escritos desde su texto:
 *   ★ 8 · transferencias, reasignaciones, pagos, préstamos y cobros no se editan aquí: su fila no abre la edición
 *         (la spec 007 hizo después que un pago o un cobro abra su pantalla para deshacerlo, no para editarlo);
 *   ★ 10 · borrar algo que ya no existe lleva a Movimientos con "Ya estaba borrado";
 *   11 · al guardar o borrar se vuelve a la lista de donde se vino, por defecto /movimientos, con su aviso.
 * Que la dirección de un tipo que no es gasto ni ingreso responda 404 lo comprueba scripts/comprobar-006.ts contra la
 * base, con movimientoParaEditar, que es lo que la página consulta antes de llamar a notFound.
 */
import { describe, expect, it } from "vitest";
import { avisoDeVuelta, conAviso, destinoDeVuelta, enlaceDeEdicion } from "./valores";

describe("★ 8 · solo gastos e ingresos abren la edición", () => {
  it("la fila de un gasto o un ingreso enlaza a /movimientos/[id] con a dónde volver", () => {
    expect(enlaceDeEdicion({ id: 7, tipo: "gasto" }, "/movimientos?tipo=gastos")).toBe(
      "/movimientos/7?volver=%2Fmovimientos%3Ftipo%3Dgastos",
    );
    expect(enlaceDeEdicion({ id: 8, tipo: "ingreso" }, "/")).toBe("/movimientos/8?volver=%2F");
  });

  it("la fila de una transferencia, una reasignación o un préstamo no abre nada", () => {
    for (const tipo of ["transferencia", "reasignacion", "prestamo", "otro"]) {
      expect(enlaceDeEdicion({ id: 9, tipo }, "/movimientos")).toBeUndefined();
    }
  });
});

describe("★ 10 y 11 · el aviso al volver, y a dónde se vuelve", () => {
  it("borrar algo que ya no existe dice 'Ya estaba borrado'", () => {
    expect(avisoDeVuelta({ borrado: "ya" })).toBe("Ya estaba borrado");
  });

  it("guardar o borrar dice qué se hizo; sin aviso, nada", () => {
    expect(avisoDeVuelta({ editado: "gasto" })).toBe("Gasto actualizado");
    expect(avisoDeVuelta({ editado: "ingreso" })).toBe("Ingreso actualizado");
    expect(avisoDeVuelta({ borrado: "1" })).toBe("Borrado");
    expect(avisoDeVuelta({})).toBeNull();
    expect(avisoDeVuelta({ editado: "otro", borrado: "2" })).toBeNull();
  });

  it("se vuelve al inicio o a Movimientos con sus filtros; por defecto, a /movimientos", () => {
    expect(destinoDeVuelta("/")).toBe("/");
    expect(destinoDeVuelta("/movimientos?tipo=ingresos&periodo=mes")).toBe("/movimientos?tipo=ingresos&periodo=mes");
    expect(destinoDeVuelta("")).toBe("/movimientos");
    expect(conAviso(destinoDeVuelta(""), "borrado=1")).toBe("/movimientos?borrado=1");
    expect(conAviso("/movimientos?tipo=gastos", "editado=gasto")).toBe("/movimientos?tipo=gastos&editado=gasto");
  });

  it("nunca vuelve a otro sitio: ni a otra web ni a una ruta cualquiera", () => {
    for (const malo of ["https://otro.example", "//otro.example", "/sobres", "/movimientos/../sobres", "/\\otro"]) {
      expect(destinoDeVuelta(malo)).toBe("/movimientos");
    }
  });
});
