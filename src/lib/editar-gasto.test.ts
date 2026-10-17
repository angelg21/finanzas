/**
 * Spec 006, criterios 1 a 3: editar un gasto es volver a prepararlo con prepararGasto y decir qué pasa con su venta
 * enlazada. El gasto conserva su fila; la venta se actualiza, se crea o se borra según la forma de pago nueva.
 */
import { describe, expect, it } from "vitest";
import { planDeEdicionDeGasto } from "./editar-gasto";
import { type EntradaGasto, type FilaMovimiento, prepararGasto } from "./gastos";
import { saldosTras } from "./saldos";

const hoy = "2026-10-17";
const binance = { id: 1, moneda: "USDT" as const };
const efectivo = { id: 3, moneda: "USD" as const };
const bolivares = { id: 5, moneda: "VES" as const };
const gastosDelMes = 2;
const familia = 3;
const idGasto = 100;
const idVenta = 99;

function entrada(cambios: Partial<EntradaGasto> = {}): EntradaGasto {
  return {
    forma: "dolares",
    monto: "12,50",
    tasa: "",
    vendido: "",
    cuentaOrigen: binance,
    cuentaBolivares: bolivares,
    sobreId: gastosDelMes,
    categoriaId: 7,
    fecha: "2026-10-10",
    nota: "",
    ...cambios,
  };
}

const vendiendo = (cambios: Partial<EntradaGasto> = {}) =>
  entrada({ forma: "vendiendo", monto: "2.100", tasa: "241,8", vendido: "10", ...cambios });
const delSaldo = (cambios: Partial<EntradaGasto> = {}) =>
  entrada({ forma: "saldo", monto: "500", tasa: "241,8", ...cambios });

function filasDe(e: EntradaGasto): FilaMovimiento[] {
  const p = prepararGasto(e, hoy);
  if (!p.ok) throw new Error(JSON.stringify(p.errores));
  return p.filas;
}

/** Lo guardado de una captura: el gasto con su id, y la venta con el suyo si la hubo. */
function guardadoDe(e: EntradaGasto) {
  return { gastoId: idGasto, ventaId: filasDe(e).some((f) => f.tipo === "transferencia") ? idVenta : null };
}

describe("planDeEdicionDeGasto: el gasto conserva su fila y la venta sigue a la forma de pago", () => {
  it("dólares → dólares: actualiza el gasto con monto, cuenta y sobre nuevos, sin venta", () => {
    const nueva = entrada({ monto: "20", cuentaOrigen: efectivo, sobreId: familia, nota: " taxi " });
    const plan = planDeEdicionDeGasto(guardadoDe(entrada()), nueva, hoy);
    expect(plan).toEqual({ ok: true, gasto: { id: idGasto, fila: filasDe(nueva)[0] }, venta: null });
    if (plan.ok) {
      expect(plan.gasto.fila).toMatchObject({
        montoCentavos: 2_000,
        montoUsdCentavos: 2_000,
        moneda: "USD",
        cuentaOrigenId: efectivo.id,
        sobreOrigenId: familia,
        nota: "taxi",
      });
    }
  });

  it("vendiendo → vendiendo con otra tasa y otro vendido: la venta se actualiza recalculada", () => {
    const nueva = vendiendo({ tasa: "250", vendido: "12" });
    const plan = planDeEdicionDeGasto(guardadoDe(vendiendo()), nueva, hoy);
    const [venta, gasto] = filasDe(nueva);
    expect(plan).toEqual({
      ok: true,
      gasto: { id: idGasto, fila: gasto },
      venta: { accion: "actualizar", id: idVenta, fila: venta },
    });
    expect(venta).toMatchObject({ montoCentavos: 1_200, montoDestinoCentavos: 300_000, tasa: "250.0000" });
  });

  it("vendiendo → bolívares del saldo, o → dólares: la venta enlazada se borra", () => {
    for (const nueva of [delSaldo(), entrada()]) {
      const plan = planDeEdicionDeGasto(guardadoDe(vendiendo()), nueva, hoy);
      expect(plan).toMatchObject({ ok: true, gasto: { id: idGasto }, venta: { accion: "borrar", id: idVenta } });
    }
  });

  it("dólares o bolívares del saldo → vendiendo: se crea la venta", () => {
    for (const antes of [entrada(), delSaldo()]) {
      const nueva = vendiendo();
      const plan = planDeEdicionDeGasto(guardadoDe(antes), nueva, hoy);
      expect(plan).toEqual({
        ok: true,
        gasto: { id: idGasto, fila: filasDe(nueva)[1] },
        venta: { accion: "crear", fila: filasDe(nueva)[0] },
      });
    }
  });

  it("con la entrada nueva mal, devuelve los mismos errores que la captura y nada que escribir", () => {
    const mal = vendiendo({ tasa: "0,4", fecha: "2026-10-18" });
    const p = prepararGasto(mal, hoy);
    expect(planDeEdicionDeGasto(guardadoDe(vendiendo()), mal, hoy)).toEqual(p);
    expect(p.ok).toBe(false);
  });
});

describe("★ 1 · el cuadre: editar es como si el gasto viejo no hubiera existido y se registrara el nuevo", () => {
  const cuentas = { [binance.id]: 100_000, [efectivo.id]: 20_000, [bolivares.id]: 0 };
  const sobres = { [gastosDelMes]: 80_000, [familia]: 40_000 };
  const casos: [string, EntradaGasto, EntradaGasto][] = [
    ["dólares → dólares", entrada(), entrada({ monto: "30", cuentaOrigen: efectivo, sobreId: familia })],
    ["vendiendo → vendiendo", vendiendo(), vendiendo({ tasa: "250", vendido: "12", monto: "2.500" })],
    ["vendiendo → saldo", vendiendo(), delSaldo()],
    ["vendiendo → dólares", vendiendo(), entrada()],
    ["dólares → vendiendo", entrada(), vendiendo()],
  ];
  for (const [nombre, antes, nueva] of casos) {
    it(nombre, () => {
      const plan = planDeEdicionDeGasto(guardadoDe(antes), nueva, hoy);
      if (!plan.ok) throw new Error("el plan debía salir");
      const quedan = [...(plan.venta && plan.venta.accion !== "borrar" ? [plan.venta.fila] : []), plan.gasto.fila];
      expect(saldosTras(quedan, cuentas, sobres)).toEqual(saldosTras(filasDe(nueva), cuentas, sobres));
    });
  }
});
