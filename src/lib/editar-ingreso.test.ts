/**
 * Spec 006, criterios 1, 4, 5 y 7: editar un ingreso cambia su fila y la diferencia entra o sale del sobre que lo
 * recibió ("Por asignar"); bajarlo solo se puede si ese sobre alcanza. Borrarlo se lleva su reparto: el sobre
 * destino pierde lo que quedó sin repartir y cada sobre devuelve lo suyo.
 */
import { describe, expect, it } from "vitest";
import { planDeBorradoDeIngreso, planDeEdicionDeIngreso } from "./editar-ingreso";
import { saldosTras } from "./saldos";

const hoy = "2026-10-17";
const binance = { id: 1, moneda: "USDT" as const };
const prima = { id: 4, moneda: "USD" as const };
const bolivares = { id: 5, moneda: "VES" as const };
const porAsignar = 1;
const gastosDelMes = 2;
const familia = 3;
const guardado = { id: 50, montoUsdCentavos: 120_000, sobreDestinoId: porAsignar };
const nueva = (cambios: Partial<{ monto: string; fecha: string; nota: string; categoriaId: number }> = {}) => ({
  monto: "1200",
  fecha: "2026-10-15",
  nota: "",
  categoriaId: 20,
  ...cambios,
});

describe("planDeEdicionDeIngreso", () => {
  it("subir el monto: la fila nueva y la diferencia, que entra al sobre que lo recibió", () => {
    const plan = planDeEdicionDeIngreso(guardado, nueva({ monto: "1500", nota: " sueldo " }), prima, 0, hoy);
    expect(plan).toMatchObject({
      ok: true,
      diferencia: 30_000,
      fila: {
        tipo: "ingreso",
        montoCentavos: 150_000,
        montoUsdCentavos: 150_000,
        moneda: "USD",
        cuentaDestinoId: prima.id,
        sobreDestinoId: porAsignar,
        categoriaId: 20,
        fecha: "2026-10-15",
        nota: "sueldo",
      },
    });
  });

  it("bajar el monto si el sobre alcanza, también justo hasta cero", () => {
    const plan = planDeEdicionDeIngreso(guardado, nueva({ monto: "1000" }), binance, 20_000, hoy);
    expect(plan).toMatchObject({ ok: true, diferencia: -20_000, fila: { montoCentavos: 100_000 } });
  });

  it("★ 5 · bajar más de lo que tiene el sobre no se guarda, y dice cuánto tiene y qué hacer", () => {
    const plan = planDeEdicionDeIngreso(guardado, nueva({ monto: "1000" }), binance, 15_000, hoy);
    expect(plan).toEqual({
      ok: false,
      errores: {
        monto: "Por asignar tiene 150,00; para bajar 200,00, borra el ingreso con su reparto y regístralo de nuevo",
      },
    });
  });

  it("las reglas de la captura valen igual: monto, cuenta en dólares y fecha", () => {
    expect(planDeEdicionDeIngreso(guardado, nueva({ monto: "0" }), binance, 0, hoy)).toMatchObject({
      ok: false,
      errores: { monto: expect.any(String) },
    });
    expect(planDeEdicionDeIngreso(guardado, nueva(), bolivares, 0, hoy)).toMatchObject({
      ok: false,
      errores: { cuenta: "Elige una cuenta en dólares" },
    });
    expect(planDeEdicionDeIngreso(guardado, nueva({ fecha: "2026-10-18" }), binance, 0, hoy)).toMatchObject({
      ok: false,
      errores: { fecha: "Elige hoy o un día anterior" },
    });
  });

  it("★ 1 · el cuadre: aplicar la diferencia en la cuenta y en el sobre deja las dos sumas iguales", () => {
    const plan = planDeEdicionDeIngreso(guardado, nueva({ monto: "1000" }), binance, 20_000, hoy);
    if (!plan.ok) throw new Error("el plan debía salir");
    const quitar = {
      ...plan.fila,
      montoCentavos: guardado.montoUsdCentavos,
      montoUsdCentavos: guardado.montoUsdCentavos,
    };
    const antes = saldosTras([quitar], { [binance.id]: 0 }, { [porAsignar]: 0 });
    const despues = saldosTras([plan.fila], { [binance.id]: 0 }, { [porAsignar]: 0 });
    const suma = (s: Record<number, number>) => Object.values(s).reduce((a, b) => a + b, 0);
    expect(suma(despues.cuentas) - suma(antes.cuentas)).toBe(plan.diferencia);
    expect(suma(despues.sobres) - suma(antes.sobres)).toBe(plan.diferencia);
  });
});

describe("planDeBorradoDeIngreso: el ingreso se va con su reparto", () => {
  const reparto = [
    { sobreId: gastosDelMes, nombre: "Gastos del mes", montoUsdCentavos: 17_500, saldoCentavos: 5_000 },
    { sobreId: familia, nombre: "Familia", montoUsdCentavos: 10_000, saldoCentavos: 10_000 },
  ];

  it("★ 7 · Por asignar pierde lo que quedó sin repartir; avisa del sobre que quedará en negativo", () => {
    const plan = planDeBorradoDeIngreso({
      montoUsdCentavos: 120_000,
      destino: { nombre: "Por asignar", saldoCentavos: 92_500 },
      reparto,
    });
    expect(plan).toEqual({ ok: true, avisos: ["Gastos del mes quedará en −125,00"] });
  });

  it("★ 7 · si Por asignar quedaría en negativo, no se borra y lo dice", () => {
    const plan = planDeBorradoDeIngreso({
      montoUsdCentavos: 120_000,
      destino: { nombre: "Por asignar", saldoCentavos: 50_000 },
      reparto,
    });
    expect(plan).toEqual({ ok: false, error: "Por asignar tiene 500,00; le faltan 425,00" });
  });

  it("sin reparto (importado o de demostración), solo el ingreso", () => {
    expect(
      planDeBorradoDeIngreso({
        montoUsdCentavos: 30_000,
        destino: { nombre: "Por asignar", saldoCentavos: 30_000 },
        reparto: [],
      }),
    ).toEqual({ ok: true, avisos: [] });
  });
});
