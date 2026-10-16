/**
 * Criterio 13 de la spec 005: apartar lo que ya se tiene. Una reasignación de un sobre a Deudas, nunca desde Deudas
 * ni desde Inversión, y nunca más que el saldo del origen. El candado y la nueva comprobación del saldo los mira
 * scripts/comprobar-005.ts.
 */
import { describe, expect, it } from "vitest";
import { saldosTras } from "./saldos";
import { type SobreParaApartar, prepararApartado, puedeApartarDesde, sobresParaApartar } from "./apartado";

const hoy = "2026-10-15";
const deudas = 12;
const porAsignar: SobreParaApartar = { id: 1, nombre: "Por asignar", tipo: "por_asignar", saldoCentavos: 30_000 };
const planes: SobreParaApartar = { id: 5, nombre: "Planes", tipo: "meta", saldoCentavos: 12_000 };
const inversion: SobreParaApartar = { id: 9, nombre: "Inversión", tipo: "inversion", saldoCentavos: 500_000 };
const sobreDeudas: SobreParaApartar = { id: deudas, nombre: "Deudas", tipo: "deudas", saldoCentavos: 13_500 };
const vacio: SobreParaApartar = { id: 3, nombre: "Familia", tipo: "familia", saldoCentavos: 0 };
const negativo: SobreParaApartar = { id: 2, nombre: "Gastos del mes", tipo: "gastos", saldoCentavos: -500 };
const todos = [porAsignar, planes, inversion, sobreDeudas, vacio, negativo];

describe("sobresParaApartar: de dónde se puede apartar", () => {
  it("los que tienen saldo, salvo Deudas e Inversión; Por asignar sí", () => {
    expect(sobresParaApartar(todos).map((s) => s.id)).toEqual([porAsignar.id, planes.id]);
  });

  it("puedeApartarDesde, por tipo", () => {
    expect(puedeApartarDesde("por_asignar")).toBe(true);
    expect(puedeApartarDesde("fondo")).toBe(true);
    expect(puedeApartarDesde("deudas")).toBe(false);
    expect(puedeApartarDesde("inversion")).toBe(false);
  });
});

describe("prepararApartado (criterio 13)", () => {
  it("una reasignación en USD del sobre de origen a Deudas, con fecha de hoy", () => {
    expect(prepararApartado({ monto: "120", sobreOrigenId: porAsignar.id }, todos, deudas, hoy)).toEqual({
      ok: true,
      fila: {
        fecha: hoy,
        tipo: "reasignacion",
        montoCentavos: 12_000,
        moneda: "USD",
        montoUsdCentavos: 12_000,
        montoDestinoCentavos: null,
        monedaDestino: null,
        tasa: null,
        cuentaOrigenId: null,
        cuentaDestinoId: null,
        sobreOrigenId: porAsignar.id,
        sobreDestinoId: deudas,
        categoriaId: null,
        deudaId: null,
        nota: null,
        origen: "manual",
      },
    });
  });

  it("de 0,01 al saldo del origen", () => {
    expect(prepararApartado({ monto: "120", sobreOrigenId: planes.id }, todos, deudas, hoy).ok).toBe(true);
    expect(prepararApartado({ monto: "0,01", sobreOrigenId: planes.id }, todos, deudas, hoy).ok).toBe(true);
    expect(prepararApartado({ monto: "120,01", sobreOrigenId: planes.id }, todos, deudas, hoy)).toEqual({
      ok: false,
      errores: { monto: "No puede pasar de lo que tiene Planes: 120,00" },
    });
    expect(prepararApartado({ monto: "0", sobreOrigenId: planes.id }, todos, deudas, hoy)).toEqual({
      ok: false,
      errores: { monto: "Escribe un monto mayor que cero" },
    });
    expect(prepararApartado({ monto: " ", sobreOrigenId: planes.id }, todos, deudas, hoy)).toEqual({
      ok: false,
      errores: { monto: "Escribe el monto" },
    });
  });

  it("el mensaje usa el nombre del sobre, aunque lo hayan renombrado", () => {
    const renombrado = [{ ...planes, nombre: "Viajes" }];
    expect(prepararApartado({ monto: "500", sobreOrigenId: planes.id }, renombrado, deudas, hoy)).toEqual({
      ok: false,
      errores: { monto: "No puede pasar de lo que tiene Viajes: 120,00" },
    });
  });

  it("nunca desde Deudas, Inversión, un sobre sin saldo o uno que no está en la lista", () => {
    for (const sobreOrigenId of [deudas, inversion.id, vacio.id, negativo.id, 99, null]) {
      expect(prepararApartado({ monto: "1", sobreOrigenId }, todos, deudas, hoy), String(sobreOrigenId)).toEqual({
        ok: false,
        errores: { sobre: "Elige de dónde apartar" },
      });
    }
  });

  it("junta el error del sobre y el del monto", () => {
    const r = prepararApartado({ monto: "", sobreOrigenId: null }, todos, deudas, hoy);
    expect(r.ok ? [] : Object.keys(r.errores).sort()).toEqual(["monto", "sobre"]);
  });

  it("mueve entre sobres y no toca cuentas: el invariante se mantiene", () => {
    const r = prepararApartado({ monto: "120", sobreOrigenId: porAsignar.id }, todos, deudas, hoy);
    if (!r.ok) throw new Error("apartado");
    expect(saldosTras([r.fila], { 1: 50_000 }, { [porAsignar.id]: 30_000, [deudas]: 13_500 })).toEqual({
      cuentas: { 1: 50_000 },
      sobres: { [porAsignar.id]: 18_000, [deudas]: 25_500 },
    });
  });
});
