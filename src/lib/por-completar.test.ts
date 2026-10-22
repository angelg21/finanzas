/**
 * Spec 009: un gasto por completar no mueve dinero (criterio 1) y se valida al anotarlo (2); completar varios registra
 * los gastos de una vez, con una sola venta si se pagó vendiendo USDT, y pregunta por el resto (8 y 9).
 */
import { describe, expect, it } from "vitest";
import { type EntradaVarios, prepararCompletarVarios, validarPorCompletar } from "./por-completar";
import { saldosTras } from "./saldos";

const hoy = "2026-10-22";
const binance = { id: 1, moneda: "USDT" as const };
const efectivo = { id: 3, moneda: "USD" as const };
const bolivares = { id: 5, moneda: "VES" as const };
const gastosDelMes = 2;
const familia = 3;
const comida = 10;
const salidas = 11;

describe("validarPorCompletar", () => {
  const base = { categoriaId: comida, nota: " Arepas ", fecha: "2026-10-18", monto: "", moneda: "" };

  it("★ 1 · sin monto: solo categoría, descripción y fecha", () => {
    expect(validarPorCompletar(base, [comida], hoy)).toEqual({
      ok: true,
      fila: { fecha: "2026-10-18", categoriaId: comida, nota: "Arepas", montoCentavos: null, moneda: null },
    });
  });

  it("con monto, en Bs o en USD", () => {
    expect(validarPorCompletar({ ...base, monto: "2100", moneda: "VES" }, [comida], hoy)).toMatchObject({
      ok: true,
      fila: { montoCentavos: 210_000, moneda: "VES" },
    });
    expect(validarPorCompletar({ ...base, monto: "12,5", moneda: "USD" }, [comida], hoy)).toMatchObject({
      ok: true,
      fila: { montoCentavos: 1_250, moneda: "USD" },
    });
  });

  it("los errores de cada campo", () => {
    expect(
      validarPorCompletar(
        { ...base, categoriaId: 99, fecha: "2026-10-23", monto: "abc", moneda: "VES" },
        [comida],
        hoy,
      ),
    ).toEqual({
      ok: false,
      errores: {
        categoria: "Elige una categoría",
        fecha: "Elige hoy o un día anterior",
        monto: "Escribe un monto mayor que cero, o déjalo vacío",
      },
    });
    expect(validarPorCompletar({ ...base, monto: "10", moneda: "" }, [comida], hoy)).toEqual({
      ok: false,
      errores: { moneda: "Elige si son Bs o USD" },
    });
  });
});

const item = (pendienteId: number, monto: string, categoriaId = comida, sobreId = gastosDelMes) => ({
  pendienteId,
  monto,
  sobreId,
  categoriaId,
  fecha: "2026-10-18",
  nota: `pendiente ${pendienteId}`,
});

const entrada = (cambios: Partial<EntradaVarios> = {}): EntradaVarios => ({
  forma: "vendiendo",
  cuentaOrigen: binance,
  cuentaBolivares: bolivares,
  tasa: "250",
  vendido: "20",
  items: [item(1, "2000"), item(2, "2500", salidas)],
  resto: "",
  restoCategoriaId: familia,
  restoSobreId: familia,
  ...cambios,
});

describe("★ 8 · completar varios vendiendo USDT: una sola venta", () => {
  it("con lo que sobra sin decidir, pregunta y no prepara nada", () => {
    // 20 USDT a 250 dan 5.000 Bs; los gastos suman 4.500: sobran 500.
    expect(prepararCompletarVarios(entrada(), hoy)).toEqual({ estado: "resto", restoBs: 50_000 });
  });

  it("al decidir que va a Bolívares: una venta por lo vendido y un gasto en Bs por pendiente, a la misma tasa", () => {
    const r = prepararCompletarVarios(entrada({ resto: "bolivares" }), hoy);
    if (r.estado !== "ok") throw new Error(JSON.stringify(r));
    const ventas = r.filas.filter((f) => f.tipo === "transferencia");
    const gastos = r.filas.filter((f) => f.tipo === "gasto");
    expect(ventas).toEqual([
      expect.objectContaining({
        fecha: hoy,
        montoCentavos: 2_000,
        moneda: "USDT",
        montoDestinoCentavos: 500_000,
        monedaDestino: "VES",
        tasa: "250.0000",
        cuentaOrigenId: binance.id,
        cuentaDestinoId: bolivares.id,
      }),
    ]);
    expect(gastos.map((g) => [g.montoCentavos, g.moneda, g.montoUsdCentavos, g.tasa, g.cuentaOrigenId])).toEqual([
      [200_000, "VES", 800, "250.0000", bolivares.id],
      [250_000, "VES", 1_000, "250.0000", bolivares.id],
    ]);
    expect(gastos.map((g) => g.categoriaId)).toEqual([comida, salidas]);
    expect(r.pendientes).toEqual([1, 2]);
    // Bolívares se queda con los 500 Bs de vuelto.
    const despues = saldosTras(r.filas, { [binance.id]: 10_000, [bolivares.id]: 0 }, { [gastosDelMes]: 5_000 });
    expect(despues.cuentas).toEqual({ [binance.id]: 8_000, [bolivares.id]: 50_000 });
    expect(despues.sobres).toEqual({ [gastosDelMes]: 3_200 });
  });

  it("al decidir que no es suyo: el resto es un gasto más, y Bolívares queda en cero", () => {
    const r = prepararCompletarVarios(entrada({ resto: "gasto" }), hoy);
    if (r.estado !== "ok") throw new Error(JSON.stringify(r));
    const resto = r.filas.find((f) => f.tipo === "gasto" && f.nota === "Resto de la venta");
    expect(resto).toMatchObject({
      fecha: hoy,
      montoCentavos: 50_000,
      moneda: "VES",
      montoUsdCentavos: 200,
      categoriaId: familia,
      sobreOrigenId: familia,
    });
    const despues = saldosTras(r.filas, { [binance.id]: 10_000, [bolivares.id]: 0 }, {});
    expect(despues.cuentas[bolivares.id]).toBe(0);
    expect(despues.cuentas[binance.id]).toBe(8_000);
    // Lo que bajaron los sobres es lo vendido: Binance bajó exacto lo que salió.
    const bajaron = r.filas.filter((f) => f.tipo === "gasto").reduce((a, f) => a + f.montoUsdCentavos, 0);
    expect(bajaron).toBe(2_000);
  });

  it("sin resto no pregunta; si los gastos pasan de lo recibido, se guarda igual y Bolívares baja de cero", () => {
    expect(prepararCompletarVarios(entrada({ vendido: "18" }), hoy).estado).toBe("ok");
    const r = prepararCompletarVarios(entrada({ vendido: "10" }), hoy);
    if (r.estado !== "ok") throw new Error(JSON.stringify(r));
    expect(saldosTras(r.filas, { [bolivares.id]: 0 }, {}).cuentas[bolivares.id]).toBe(-200_000);
  });

  it("el resto como gasto pide su categoría y su sobre", () => {
    expect(prepararCompletarVarios(entrada({ resto: "gasto", restoSobreId: null }), hoy)).toEqual({
      estado: "error",
      errores: { resto: "Elige la categoría y el sobre del resto" },
    });
  });
});

describe("★ 8 · completar varios en dólares o del saldo", () => {
  it("en dólares, un gasto por pendiente desde la cuenta, sin venta", () => {
    const r = prepararCompletarVarios(
      entrada({ forma: "dolares", cuentaOrigen: efectivo, items: [item(1, "12"), item(2, "8")] }),
      hoy,
    );
    if (r.estado !== "ok") throw new Error(JSON.stringify(r));
    expect(r.filas.map((f) => [f.tipo, f.montoCentavos, f.moneda, f.cuentaOrigenId])).toEqual([
      ["gasto", 1_200, "USD", efectivo.id],
      ["gasto", 800, "USD", efectivo.id],
    ]);
  });

  it("del saldo de Bolívares, a la tasa, sin venta ni pregunta por el resto", () => {
    const r = prepararCompletarVarios(entrada({ forma: "saldo" }), hoy);
    if (r.estado !== "ok") throw new Error(JSON.stringify(r));
    expect(r.filas.every((f) => f.tipo === "gasto" && f.moneda === "VES" && f.cuentaOrigenId === bolivares.id)).toBe(
      true,
    );
  });

  it("los errores de cada pendiente, por su id, y los de la venta", () => {
    const r = prepararCompletarVarios(entrada({ items: [item(1, ""), item(2, "2500")], tasa: "0,4" }), hoy);
    expect(r).toEqual({
      estado: "error",
      errores: {
        tasa: "Escribe la tasa en Bs por dólar, como 241,8",
        porPendiente: { 1: "Escribe el monto" },
      },
    });
    expect(prepararCompletarVarios(entrada({ items: [] }), hoy)).toEqual({
      estado: "error",
      errores: { general: "Elige al menos un gasto" },
    });
  });
});
