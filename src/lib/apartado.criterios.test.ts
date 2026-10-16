/**
 * Criterio ★ 13 de la spec 005 (apartar lo que ya se tiene) en lo que cumplen las funciones puras, escrito desde su
 * texto. Las pruebas de construcción viven en apartado.test.ts. El candado del reparto y el saldo vuelto a comprobar
 * dentro de él los comprueban scripts/comprobar-005.ts y scripts/comprobar-005-criterios.ts.
 */
import { describe, expect, it } from "vitest";
import { type SobreParaApartar, prepararApartado, sobresParaApartar } from "./apartado";
import { saldosTras } from "./saldos";

const hoy = "2026-10-15";
const sobre = (id: number, nombre: string, tipo: string, saldoCentavos: number): SobreParaApartar => ({
  id,
  nombre,
  tipo,
  saldoCentavos,
});
const porAsignar = sobre(1, "Por asignar", "por_asignar", 20_000);
const gastos = sobre(2, "Gastos del mes", "gastos", 0);
const familia = sobre(3, "Familia", "familia", 5_000);
const emergencia = sobre(7, "Emergencia", "emergencia", -200);
const inversion = sobre(9, "Inversión", "inversion", 90_000);
const deudas = sobre(10, "Deudas", "deudas", 13_500);
const activos = [porAsignar, gastos, familia, emergencia, inversion, deudas];

const apartar = (monto: string, sobreOrigenId: number | null) =>
  prepararApartado({ monto, sobreOrigenId }, activos, deudas.id, hoy);

describe("★ 13 · apartar lo que ya se tiene", () => {
  it("ofrece los sobres activos con saldo mayor que cero, Por asignar incluido, salvo Deudas e Inversión", () => {
    expect(sobresParaApartar(activos).map((s) => s.nombre)).toEqual(["Por asignar", "Familia"]);
  });

  it("guarda una reasignación del sobre de origen a Deudas", () => {
    const r = apartar("150", porAsignar.id);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.fila).toMatchObject({
      tipo: "reasignacion",
      montoUsdCentavos: 15_000,
      sobreOrigenId: porAsignar.id,
      sobreDestinoId: deudas.id,
      cuentaOrigenId: null,
      cuentaDestinoId: null,
    });
    const tras = saldosTras([r.fila], {}, { [porAsignar.id]: 20_000, [deudas.id]: 13_500 });
    expect(tras.sobres).toEqual({ [porAsignar.id]: 5_000, [deudas.id]: 28_500 });
  });

  it("el monto va de 0,01 al saldo del origen; más, con el error en el monto", () => {
    expect(apartar("0,01", familia.id).ok).toBe(true);
    expect(apartar("50", familia.id).ok).toBe(true);
    expect(apartar("0", familia.id).ok).toBe(false);
    const deMas = apartar("50,01", familia.id);
    expect(deMas.ok).toBe(false);
    if (!deMas.ok) expect(Object.keys(deMas.errores)).toEqual(["monto"]);
  });

  it("nunca desde Deudas, Inversión, un sobre sin saldo o uno que no está entre los activos", () => {
    for (const id of [deudas.id, inversion.id, gastos.id, emergencia.id, 99, null]) {
      const r = apartar("1", id);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errores.sobre).toBeDefined();
    }
  });
});
