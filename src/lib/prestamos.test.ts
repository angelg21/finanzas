/**
 * Spec 005, lo que me deben: prestar y cobrar (criterios 4, 5 y 7). Lo que solo se ve en la base (la deuda y el
 * movimiento juntos, el candado del cobro) lo comprueba scripts/comprobar-005.ts.
 */
import { describe, expect, it } from "vitest";
import { type CuentaDeuda, pendienteDe } from "./deudas";
import { type EntradaPrestamo, prepararCobro, prepararPrestamo } from "./prestamos";
import { saldosTras } from "./saldos";

const hoy = "2026-10-16";
const binance: CuentaDeuda = { id: 1, moneda: "USDT" };
const bolivares: CuentaDeuda = { id: 5, moneda: "VES" };
const porAsignar = 10;
const planes = 14;
const sobres = [
  { id: porAsignar, tipo: "por_asignar" },
  { id: planes, tipo: "meta" },
  { id: 12, tipo: "deudas" },
  { id: 16, tipo: "inversion" },
];

function prestamo(cambios: Partial<EntradaPrestamo>): EntradaPrestamo {
  return {
    persona: "Luis",
    monto: "80",
    fecha: "hoy",
    fechaPrevista: "",
    nota: "",
    cuenta: binance,
    sobreOrigenId: planes,
    ...cambios,
  };
}

describe("prepararPrestamo (criterio 4)", () => {
  it("una deuda me_deben en 0 y un movimiento prestamo desde la cuenta y el sobre, sin categoría", () => {
    const r = prepararPrestamo(
      prestamo({ fecha: "2026-10-15", fechaPrevista: "2026-12-01", nota: " Alquiler " }),
      sobres,
      hoy,
    );
    expect(r).toEqual({
      ok: true,
      deuda: {
        sentido: "me_deben",
        persona: "Luis",
        montoInicialCentavos: 0,
        fechaPrevista: "2026-12-01",
        cuentaPrevistaId: null,
        nota: "Alquiler",
      },
      fila: {
        fecha: "2026-10-15",
        tipo: "prestamo",
        montoCentavos: 8_000,
        moneda: "USDT",
        montoUsdCentavos: 8_000,
        montoDestinoCentavos: null,
        monedaDestino: null,
        tasa: null,
        cuentaOrigenId: binance.id,
        cuentaDestinoId: null,
        sobreOrigenId: planes,
        sobreDestinoId: null,
        categoriaId: null,
        nota: "Alquiler",
        origen: "manual",
      },
    });
  });

  it("la fecha del préstamo es la de siempre: hoy, ayer u otra pasada", () => {
    const r = prepararPrestamo(prestamo({ fecha: "ayer" }), sobres, hoy);
    expect(r.ok && r.fila.fecha).toBe("2026-10-15");
    expect(prepararPrestamo(prestamo({ fecha: "2026-10-17" }), sobres, hoy)).toEqual({
      ok: false,
      errores: { fecha: "Elige hoy o un día anterior" },
    });
  });

  it("Por asignar sí se ofrece; Inversión y Deudas no", () => {
    expect(prepararPrestamo(prestamo({ sobreOrigenId: porAsignar }), sobres, hoy).ok).toBe(true);
    for (const sobreOrigenId of [12, 16, 99, null]) {
      expect(prepararPrestamo(prestamo({ sobreOrigenId }), sobres, hoy), String(sobreOrigenId)).toEqual({
        ok: false,
        errores: { sobre: "Elige de qué sobre sale" },
      });
    }
  });

  it("persona, monto, cuenta en dólares y fecha prevista válida", () => {
    const r = prepararPrestamo(
      prestamo({ persona: " ", monto: "0", cuenta: bolivares, fechaPrevista: "2026-02-30" }),
      sobres,
      hoy,
    );
    expect(r).toEqual({
      ok: false,
      errores: {
        persona: "Escribe a quién",
        monto: "Escribe un monto mayor que cero",
        cuenta: "Elige una cuenta en dólares",
        fechaPrevista: "Elige una fecha válida",
      },
    });
  });

  it("resta de la cuenta y del sobre, y el pendiente es lo prestado", () => {
    const r = prepararPrestamo(prestamo({}), sobres, hoy);
    if (!r.ok) throw new Error("préstamo");
    const despues = saldosTras([r.fila], { [binance.id]: 50_000 }, { [planes]: 20_000 });
    expect(despues).toEqual({ cuentas: { [binance.id]: 42_000 }, sobres: { [planes]: 12_000 } });
    expect(pendienteDe({ ...r.deuda, prestadoCentavos: 8_000, saldadoCentavos: 0 })).toBe(8_000);
  });
});

describe("prepararCobro (criterios 5 y 6)", () => {
  const luis = { id: 7, sentido: "me_deben" as const, pendienteCentavos: 8_000 };
  const cobro = (monto: string, cuenta: CuentaDeuda | null = binance) => ({ monto, fecha: "hoy", nota: "", cuenta });

  it("una fila cobro_prestamo hacia la cuenta y Por asignar, con la deuda y sin categoría", () => {
    expect(prepararCobro(cobro("30"), luis, porAsignar, hoy)).toEqual({
      ok: true,
      fila: {
        fecha: hoy,
        tipo: "cobro_prestamo",
        montoCentavos: 3_000,
        moneda: "USDT",
        montoUsdCentavos: 3_000,
        montoDestinoCentavos: null,
        monedaDestino: null,
        tasa: null,
        cuentaOrigenId: null,
        cuentaDestinoId: binance.id,
        sobreOrigenId: null,
        sobreDestinoId: porAsignar,
        categoriaId: null,
        deudaId: 7,
        nota: null,
        origen: "manual",
      },
    });
  });

  it("de 0,01 al pendiente", () => {
    expect(prepararCobro(cobro("80"), luis, porAsignar, hoy).ok).toBe(true);
    expect(prepararCobro(cobro("80,01"), luis, porAsignar, hoy)).toEqual({
      ok: false,
      errores: { monto: "No puede pasar de lo pendiente: 80,00" },
    });
  });

  it("solo a una cuenta en dólares", () => {
    expect(prepararCobro(cobro("30", bolivares), luis, porAsignar, hoy)).toEqual({
      ok: false,
      errores: { cuenta: "Elige una cuenta en dólares" },
    });
  });

  it("lo que debo o lo ya cobrado no se cobra", () => {
    expect(prepararCobro(cobro("30"), { ...luis, sentido: "debo" }, porAsignar, hoy)).toEqual({
      ok: false,
      errores: { deuda: "Esto no es algo que te deban" },
    });
    expect(prepararCobro(cobro("30"), { ...luis, pendienteCentavos: 0 }, porAsignar, hoy)).toEqual({
      ok: false,
      errores: { deuda: "Ya está cobrado" },
    });
  });

  it("suma a la cuenta y a Por asignar por igual: el invariante se mantiene", () => {
    const r = prepararCobro(cobro("30"), luis, porAsignar, hoy);
    if (!r.ok) throw new Error("cobro");
    expect(saldosTras([r.fila], { [binance.id]: 0 }, { [porAsignar]: 0 })).toEqual({
      cuentas: { [binance.id]: 3_000 },
      sobres: { [porAsignar]: 3_000 },
    });
  });
});
