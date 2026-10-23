/** Spec 007, criterios 7 y 8: mover entre sobres nunca deja el origen en negativo, y desde Inversión pide confirmar. */
import { describe, expect, it } from "vitest";
import { type SobreParaMover, confirmacionDeInversion, prepararMover } from "./mover";
import { saldosTras } from "./saldos";

const hoy = "2026-10-17";
const sobres: SobreParaMover[] = [
  { id: 1, nombre: "Por asignar", tipo: "por_asignar", saldoCentavos: 3_000 },
  { id: 2, nombre: "Gastos del mes", tipo: "gastos", saldoCentavos: 63_300 },
  { id: 6, nombre: "Inversión", tipo: "inversion", saldoCentavos: 50_000 },
];
const entrada = (cambios: Partial<Parameters<typeof prepararMover>[0]> = {}) => ({
  monto: "100",
  origenId: 2,
  destinoId: 1,
  nota: "",
  confirmaInversion: false,
  ...cambios,
});

describe("prepararMover", () => {
  it("una reasignación de hoy, del origen al destino, por el monto, y el cuadre no cambia", () => {
    const r = prepararMover(entrada({ nota: " devolver " }), sobres, hoy);
    expect(r).toEqual({
      estado: "ok",
      fila: expect.objectContaining({
        fecha: hoy,
        tipo: "reasignacion",
        montoCentavos: 10_000,
        montoUsdCentavos: 10_000,
        moneda: "USD",
        sobreOrigenId: 2,
        sobreDestinoId: 1,
        cuentaOrigenId: null,
        cuentaDestinoId: null,
        nota: "devolver",
      }),
    });
    if (r.estado !== "ok") return;
    const despues = saldosTras([r.fila], {}, { 1: 3_000, 2: 63_300 });
    expect(despues.sobres).toEqual({ 1: 13_000, 2: 53_300 });
  });

  it("★ 7 · nunca más de lo que tiene el origen, ni cero, ni al mismo sobre", () => {
    expect(prepararMover(entrada({ monto: "633,01" }), sobres, hoy)).toEqual({
      estado: "error",
      errores: { monto: "No puede pasar de lo que tiene Gastos del mes: 633,00" },
    });
    expect(prepararMover(entrada({ monto: "633" }), sobres, hoy).estado).toBe("ok");
    expect(prepararMover(entrada({ monto: "0" }), sobres, hoy)).toMatchObject({
      estado: "error",
      errores: { monto: expect.any(String) },
    });
    expect(prepararMover(entrada({ destinoId: 2 }), sobres, hoy)).toMatchObject({
      estado: "error",
      errores: { destino: "Elige otro sobre" },
    });
    expect(prepararMover(entrada({ origenId: 99, destinoId: null }), sobres, hoy)).toMatchObject({
      estado: "error",
      errores: { origen: "Elige de dónde mover", destino: "Elige a dónde mover" },
    });
  });

  it("★ 8 · desde Inversión pide confirmar, y solo con la confirmación sale la fila", () => {
    expect(prepararMover(entrada({ origenId: 6 }), sobres, hoy)).toEqual({ estado: "confirmar" });
    expect(prepararMover(entrada({ origenId: 6, confirmaInversion: true }), sobres, hoy).estado).toBe("ok");
    // Un error de monto se dice antes que la confirmación: no tiene sentido confirmar algo que no se puede guardar.
    expect(prepararMover(entrada({ origenId: 6, monto: "900" }), sobres, hoy).estado).toBe("error");
  });
});

describe("★ 8 · la confirmación vale para ese origen y ese monto (revisión de la 007, segunda vuelta)", () => {
  it("cambiar el monto, o el origen, después de ver el aviso pide confirmar otra vez", () => {
    const vista = confirmacionDeInversion("6", "3");
    expect(confirmacionDeInversion("6", "3")).toBe(vista);
    expect(confirmacionDeInversion("6", " 3 ")).toBe(vista);
    expect(confirmacionDeInversion("6", "7")).not.toBe(vista);
    expect(confirmacionDeInversion("2", "3")).not.toBe(vista);
  });
});
