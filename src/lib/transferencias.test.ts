/**
 * Spec 011: transferir entre cuentas en dólares con lo que salió y lo que llegó; la diferencia es un gasto de comisión.
 * El cuadre se mide con saldosTras, la misma regla que los saldos de la base.
 */
import { describe, expect, it } from "vitest";
import { saldosTras } from "./saldos";
import { type EntradaTransferencia, prepararTransferencia } from "./transferencias";

const hoy = "2026-10-28";
const cuentas = [
  { id: 1, nombre: "Cuenta prima", moneda: "USD" as const },
  { id: 2, nombre: "Binance", moneda: "USDT" as const },
  { id: 3, nombre: "Zinli", moneda: "USD" as const },
  { id: 4, nombre: "Bolívares", moneda: "VES" as const },
];
const sobres = [
  { id: 10, nombre: "Por asignar", tipo: "por_asignar" },
  { id: 11, nombre: "Gastos del mes", tipo: "gastos" },
  { id: 12, nombre: "Deudas", tipo: "deudas" },
];
const entrada = (cambios: Partial<EntradaTransferencia> = {}): EntradaTransferencia => ({
  origenId: 1,
  destinoId: 2,
  salio: "100",
  llego: "99",
  sobreId: 11,
  fecha: "hoy",
  nota: "",
  ...cambios,
});

describe("prepararTransferencia", () => {
  it("★ salió 100 y llegó 99: la transferencia es de 99 y la comisión, un gasto de 1 desde la cuenta de origen", () => {
    const r = prepararTransferencia(entrada(), cuentas, sobres, hoy);
    if (!r.ok) throw new Error(JSON.stringify(r.errores));
    expect(r.transferencia).toMatchObject({
      tipo: "transferencia",
      fecha: hoy,
      montoCentavos: 9_900,
      moneda: "USD",
      montoUsdCentavos: 9_900,
      montoDestinoCentavos: 9_900,
      monedaDestino: "USDT",
      cuentaOrigenId: 1,
      cuentaDestinoId: 2,
      sobreOrigenId: null,
      sobreDestinoId: null,
    });
    expect(r.comision).toMatchObject({
      tipo: "gasto",
      montoCentavos: 100,
      moneda: "USD",
      montoUsdCentavos: 100,
      cuentaOrigenId: 1,
      sobreOrigenId: 11,
      cuentaDestinoId: null,
      nota: "Comisión de la transferencia a Binance",
    });
  });

  it("★ el origen baja lo que salió, el destino sube lo que llegó, y las cuentas y los sobres bajan lo mismo: la comisión", () => {
    const r = prepararTransferencia(entrada(), cuentas, sobres, hoy);
    if (!r.ok) throw new Error("debía preparar");
    const filas = r.comision ? [r.transferencia, r.comision] : [r.transferencia];
    const antes = { cuentas: { 1: 50_000, 2: 10_000 }, sobres: { 11: 60_000 } };
    const despues = saldosTras(filas, antes.cuentas, antes.sobres);
    expect(despues.cuentas).toEqual({ 1: 40_000, 2: 19_900 });
    expect(despues.sobres).toEqual({ 11: 59_900 });
    const suma = (x: Record<number, number>) => Object.values(x).reduce((a, b) => a + b, 0);
    expect(suma(despues.cuentas) - suma(antes.cuentas)).toBe(suma(despues.sobres) - suma(antes.sobres));
  });

  it("si llegó lo mismo que salió, o se deja vacío, no hay comisión ni hace falta sobre", () => {
    for (const llego of ["100", ""]) {
      const r = prepararTransferencia(entrada({ llego, sobreId: null }), cuentas, sobres, hoy);
      if (!r.ok) throw new Error(JSON.stringify(r.errores));
      expect(r.comision).toBeNull();
      expect(r.transferencia.montoCentavos).toBe(10_000);
    }
  });

  it("entre dos cuentas en la misma moneda, sin monto ni moneda de destino", () => {
    const r = prepararTransferencia(entrada({ destinoId: 3 }), cuentas, sobres, hoy);
    if (!r.ok) throw new Error("debía preparar");
    expect(r.transferencia).toMatchObject({ montoDestinoCentavos: null, monedaDestino: null, montoCentavos: 9_900 });
  });

  it("★ lo que llegó no pasa de lo que salió", () => {
    expect(prepararTransferencia(entrada({ llego: "100,01" }), cuentas, sobres, hoy)).toEqual({
      ok: false,
      errores: { llego: "No puede pasar de lo que salió" },
    });
  });

  it("★ cuentas distintas y en dólares: los bolívares no entran", () => {
    expect(prepararTransferencia(entrada({ destinoId: 1 }), cuentas, sobres, hoy)).toEqual({
      ok: false,
      errores: { destino: "Elige otra cuenta" },
    });
    expect(prepararTransferencia(entrada({ destinoId: 4 }), cuentas, sobres, hoy)).toEqual({
      ok: false,
      errores: { destino: "Elige a qué cuenta llegó" },
    });
    expect(prepararTransferencia(entrada({ origenId: 4 }), cuentas, sobres, hoy)).toEqual({
      ok: false,
      errores: { origen: "Elige de qué cuenta salió" },
    });
  });

  it("★ con comisión, el sobre tiene que aceptar gastos: ni Por asignar ni Deudas", () => {
    for (const sobreId of [null, 10, 12, 99]) {
      expect(prepararTransferencia(entrada({ sobreId }), cuentas, sobres, hoy)).toEqual({
        ok: false,
        errores: { sobre: "Elige de qué sobre sale la comisión" },
      });
    }
  });

  it("montos y fecha como en la captura de gasto", () => {
    expect(prepararTransferencia(entrada({ salio: "", llego: "" }), cuentas, sobres, hoy)).toEqual({
      ok: false,
      errores: { salio: "Escribe el monto", llego: "Escribe el monto" },
    });
    expect(prepararTransferencia(entrada({ salio: "0", llego: "abc" }), cuentas, sobres, hoy)).toEqual({
      ok: false,
      errores: { salio: "Escribe un monto mayor que cero", llego: "Escribe un monto mayor que cero" },
    });
    expect(prepararTransferencia(entrada({ fecha: "2026-10-29" }), cuentas, sobres, hoy)).toEqual({
      ok: false,
      errores: { fecha: "Elige hoy o un día anterior" },
    });
    const ayer = prepararTransferencia(
      entrada({ fecha: "ayer", salio: "1.234,56", llego: "1230" }),
      cuentas,
      sobres,
      hoy,
    );
    if (!ayer.ok) throw new Error("debía preparar");
    expect(ayer.transferencia.fecha).toBe("2026-10-27");
    expect(ayer.comision?.montoCentavos).toBe(456);
  });
});
