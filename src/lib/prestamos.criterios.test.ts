/**
 * Criterios ★ 4 y 5 de la spec 005 (prestar y cobrar) en lo que cumplen las funciones puras, escritos desde el texto de
 * cada criterio. Las pruebas de construcción viven en prestamos.test.ts. Que el préstamo guarde la deuda y el movimiento
 * juntos, y que el cobro no salga en Ingresos ni en la gráfica, lo comprueban scripts/comprobar-005.ts y
 * scripts/comprobar-005-criterios.ts.
 */
import { describe, expect, it } from "vitest";
import { type CuentaDeuda, type DeudaParaSaldar, pendienteDe } from "./deudas";
import { type EntradaPrestamo, prepararCobro, prepararPrestamo } from "./prestamos";
import { saldosTras } from "./saldos";

const hoy = "2026-10-15";
const binance: CuentaDeuda = { id: 1, moneda: "USDT" };
const efectivo: CuentaDeuda = { id: 3, moneda: "USD" };
const bolivares: CuentaDeuda = { id: 5, moneda: "VES" };

const porAsignar = 1;
const gastosDelMes = 2;
const familia = 3;
const deudas = 10;
const inversion = 9;
const sobres = [
  { id: porAsignar, tipo: "por_asignar" },
  { id: gastosDelMes, tipo: "gastos" },
  { id: familia, tipo: "familia" },
  { id: inversion, tipo: "inversion" },
  { id: deudas, tipo: "deudas" },
];

function prestamo(cambios: Partial<EntradaPrestamo> = {}) {
  return prepararPrestamo(
    {
      persona: "Luis",
      monto: "80",
      fecha: "hoy",
      fechaPrevista: "",
      nota: "para la moto",
      cuenta: binance,
      sobreOrigenId: porAsignar,
      ...cambios,
    },
    sobres,
    hoy,
  );
}

describe("★ 4 · préstamo a otro", () => {
  it("guarda juntas una deuda que me deben en 0 y un préstamo desde la cuenta y el sobre, sin categoría", () => {
    const r = prestamo({ fechaPrevista: "2026-12-01" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.deuda).toEqual({
      sentido: "me_deben",
      persona: "Luis",
      montoInicialCentavos: 0,
      fechaPrevista: "2026-12-01",
      cuentaPrevistaId: null,
      nota: "para la moto",
    });
    expect(r.fila).toMatchObject({
      tipo: "prestamo",
      fecha: hoy,
      montoCentavos: 8_000,
      moneda: "USDT",
      montoUsdCentavos: 8_000,
      cuentaOrigenId: binance.id,
      sobreOrigenId: porAsignar,
      categoriaId: null,
      cuentaDestinoId: null,
      sobreDestinoId: null,
    });
  });

  it("la fecha prevista es opcional", () => {
    const r = prestamo();
    expect(r.ok && r.deuda.fechaPrevista).toBeNull();
  });

  it("resta de la cuenta y del sobre, y lo prestado queda como pendiente", () => {
    const r = prestamo({ sobreOrigenId: gastosDelMes });
    if (!r.ok) throw new Error("debía preparar el préstamo");
    const tras = saldosTras([r.fila], { [binance.id]: 60_000 }, { [gastosDelMes]: 45_000 });
    expect(tras.cuentas[binance.id]).toBe(52_000);
    expect(tras.sobres[gastosDelMes]).toBe(37_000);
    expect(
      pendienteDe({ sentido: "me_deben", montoInicialCentavos: 0, prestadoCentavos: 8_000, saldadoCentavos: 0 }),
    ).toBe(8_000);
  });

  it("sale de los sobres activos, también de Por asignar, pero nunca de Inversión ni de Deudas", () => {
    expect(prestamo({ sobreOrigenId: porAsignar }).ok).toBe(true);
    expect(prestamo({ sobreOrigenId: gastosDelMes }).ok).toBe(true);
    expect(prestamo({ sobreOrigenId: familia }).ok).toBe(true);
    for (const sobreOrigenId of [inversion, deudas, 99, null]) {
      const r = prestamo({ sobreOrigenId });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errores.sobre).toBeDefined();
    }
  });

  it("solo desde una cuenta en dólares, 1 a 1", () => {
    const r = prestamo({ cuenta: efectivo });
    expect(r.ok && r.fila.montoUsdCentavos).toBe(8_000);
    expect(prestamo({ cuenta: bolivares }).ok).toBe(false);
    expect(prestamo({ cuenta: null }).ok).toBe(false);
  });

  it("pide a quién y un monto mayor que cero", () => {
    expect(prestamo({ persona: "  " }).ok).toBe(false);
    expect(prestamo({ monto: "0" }).ok).toBe(false);
    expect(prestamo({ monto: "" }).ok).toBe(false);
  });
});

describe("★ 5 · cobro de préstamo", () => {
  const luis: DeudaParaSaldar = { id: 9, sentido: "me_deben", pendienteCentavos: 8_000 };
  const cobrar = (cambios: Partial<Parameters<typeof prepararCobro>[0]> = {}, d = luis) =>
    prepararCobro({ monto: "30", fecha: "hoy", nota: "", cuenta: binance, ...cambios }, d, porAsignar, hoy);

  it("entra a una cuenta en dólares y a Por asignar, con la deuda y sin categoría", () => {
    const r = cobrar();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.fila).toMatchObject({
      tipo: "cobro_prestamo",
      fecha: hoy,
      montoCentavos: 3_000,
      moneda: "USDT",
      montoUsdCentavos: 3_000,
      cuentaDestinoId: binance.id,
      sobreDestinoId: porAsignar,
      deudaId: 9,
      categoriaId: null,
      cuentaOrigenId: null,
      sobreOrigenId: null,
    });
  });

  it("suma a la cuenta y a Por asignar, y baja el pendiente", () => {
    const r = cobrar();
    if (!r.ok) throw new Error("debía preparar el cobro");
    const tras = saldosTras([r.fila], { [binance.id]: 10_000 }, { [porAsignar]: 0 });
    expect(tras.cuentas[binance.id]).toBe(13_000);
    expect(tras.sobres[porAsignar]).toBe(3_000);
    expect(
      pendienteDe({ sentido: "me_deben", montoInicialCentavos: 0, prestadoCentavos: 8_000, saldadoCentavos: 3_000 }),
    ).toBe(5_000);
  });

  it("el monto va de 0,01 al pendiente; más se rechaza con el error en su campo (★ 6)", () => {
    expect(cobrar({ monto: "0,01" }).ok).toBe(true);
    expect(cobrar({ monto: "80" }).ok).toBe(true);
    expect(cobrar({ monto: "0" }).ok).toBe(false);
    const deMas = cobrar({ monto: "80,01" });
    expect(deMas.ok).toBe(false);
    if (!deMas.ok) expect(Object.keys(deMas.errores)).toEqual(["monto"]);
  });

  it("solo de algo que me deben y está abierto, y a una cuenta en dólares", () => {
    expect(cobrar({}, { ...luis, sentido: "debo" }).ok).toBe(false);
    expect(cobrar({}, { ...luis, pendienteCentavos: 0 }).ok).toBe(false);
    expect(cobrar({ cuenta: bolivares }).ok).toBe(false);
  });
});
