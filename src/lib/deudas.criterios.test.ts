/**
 * Criterios ★ 1, 2, 3, 6, 15 y 16 de la spec 005 (deudas y préstamos) en lo que cumplen las funciones puras, escritos
 * desde el texto de cada criterio. Las pruebas de construcción viven en deudas.test.ts. Lo que solo se ve en la base
 * (que registrar no cree movimientos, el candado, el gastado del mes, borrar sin movimientos) lo comprueban
 * scripts/comprobar-005.ts y scripts/comprobar-005-criterios.ts.
 */
import { describe, expect, it } from "vitest";
import {
  type CuentaDeuda,
  type DeudaParaSaldar,
  type EntradaDeuda,
  avisoDelSobreDeudas,
  cuentaParaPagar,
  estadoDe,
  montoInicialMinimo,
  patrimonioNeto,
  pendienteDe,
  pendientePorSentido,
  prepararPago,
  validarDeuda,
} from "./deudas";
import { saldosTras } from "./saldos";

const hoy = "2026-10-15";
const binance: CuentaDeuda = { id: 1, moneda: "USDT" };
const segunda: CuentaDeuda = { id: 2, moneda: "USDC" };
const efectivo: CuentaDeuda = { id: 3, moneda: "USD" };
const bolivares: CuentaDeuda = { id: 5, moneda: "VES" };
const enDolares = [binance, segunda, efectivo];
const sobreDeudas = 10;

function entrada(cambios: Partial<EntradaDeuda>): EntradaDeuda {
  return {
    sentido: "debo",
    persona: "Papás",
    monto: "520",
    fechaPrevista: "2026-12-15",
    cuentaPrevistaId: binance.id,
    nota: "",
    ...cambios,
  };
}

const deuda = (cambios: Partial<EntradaDeuda>, cuentas = enDolares) => validarDeuda(entrada(cambios), cuentas);

describe("★ 1 · registrar lo que ya existía", () => {
  it("una deuda que debo guarda sentido, persona, monto en centavos, fecha, cuenta prevista y nota", () => {
    const r = deuda({ persona: "  Papás  ", nota: "  para diciembre " });
    expect(r).toEqual({
      ok: true,
      deuda: {
        sentido: "debo",
        persona: "Papás",
        montoInicialCentavos: 52_000,
        fechaPrevista: "2026-12-15",
        cuentaPrevistaId: binance.id,
        nota: "para diciembre",
      },
    });
  });

  it("algo que me deben también se registra, sin fecha y sin nota", () => {
    const r = deuda({ sentido: "me_deben", persona: "Luis", monto: "140", fechaPrevista: "", cuentaPrevistaId: null });
    expect(r).toEqual({
      ok: true,
      deuda: {
        sentido: "me_deben",
        persona: "Luis",
        montoInicialCentavos: 14_000,
        fechaPrevista: null,
        cuentaPrevistaId: null,
        nota: null,
      },
    });
  });

  it("la persona va de 1 a 80 caracteres sin contar los espacios a los lados", () => {
    expect(deuda({ persona: "" }).ok).toBe(false);
    expect(deuda({ persona: "   " }).ok).toBe(false);
    expect(deuda({ persona: "A" }).ok).toBe(true);
    expect(deuda({ persona: "a".repeat(80) }).ok).toBe(true);
    expect(deuda({ persona: `   ${"a".repeat(80)}   ` }).ok).toBe(true);
    const larga = deuda({ persona: "a".repeat(81) });
    expect(larga.ok).toBe(false);
    if (!larga.ok) expect(larga.errores.persona).toBeDefined();
  });

  it("el monto va de 0,01 a 21.474.836,47 y se lee como el ingreso", () => {
    const monto = (texto: string) => {
      const r = deuda({ monto: texto });
      return r.ok ? r.deuda.montoInicialCentavos : r.errores.monto;
    };
    expect(monto("0,01")).toBe(1);
    expect(monto("21.474.836,47")).toBe(2_147_483_647);
    expect(monto("1.234,56")).toBe(123_456);
    expect(monto("1234.56")).toBe(123_456);
    expect(typeof monto("0")).toBe("string");
    expect(typeof monto("0,001")).toBe("string");
    expect(typeof monto("21.474.836,48")).toBe("string");
    expect(typeof monto("")).toBe("string");
    expect(typeof monto("-5")).toBe("string");
  });

  it("la fecha prevista es opcional, y puede ser pasada o futura", () => {
    expect(deuda({ fechaPrevista: "" }).ok).toBe(true);
    expect(deuda({ fechaPrevista: "2026-01-10" }).ok).toBe(true);
    expect(deuda({ fechaPrevista: "2027-03-01" }).ok).toBe(true);
    expect(deuda({ fechaPrevista: "2026-02-30" }).ok).toBe(false);
  });

  it("la cuenta prevista es opcional y solo una cuenta en dólares activa", () => {
    expect(deuda({ cuentaPrevistaId: null }).ok).toBe(true);
    for (const c of enDolares) expect(deuda({ cuentaPrevistaId: c.id }).ok).toBe(true);
    // Bolívares, aunque llegue en la lista, y una cuenta que no está entre las activas.
    expect(deuda({ cuentaPrevistaId: bolivares.id }, [...enDolares, bolivares]).ok).toBe(false);
    expect(deuda({ cuentaPrevistaId: 99 }).ok).toBe(false);
  });

  it("en lo que me deben nunca se guarda una cuenta prevista", () => {
    const r = deuda({ sentido: "me_deben", cuentaPrevistaId: binance.id });
    expect(r.ok ? r.deuda.cuentaPrevistaId : null).toBeNull();
  });
});

describe("★ 2 · el pendiente se calcula, nunca se guarda", () => {
  const papas = { sentido: "debo" as const, montoInicialCentavos: 52_000, prestadoCentavos: 0 };

  it("Papás, 520,00: tras 200,00 quedan 320,00 abiertos; tras otros 320,00 está pagada", () => {
    expect(pendienteDe({ ...papas, saldadoCentavos: 0 })).toBe(52_000);
    const trasUno = pendienteDe({ ...papas, saldadoCentavos: 20_000 });
    expect(trasUno).toBe(32_000);
    expect(estadoDe(trasUno)).toBe("abierta");
    const trasDos = pendienteDe({ ...papas, saldadoCentavos: 52_000 });
    expect(trasDos).toBe(0);
    expect(estadoDe(trasDos)).toBe("pagada");
  });

  it("en lo que me deben, pendiente = monto inicial + préstamos − cobros", () => {
    const luis = { sentido: "me_deben" as const, montoInicialCentavos: 14_000 };
    expect(pendienteDe({ ...luis, prestadoCentavos: 0, saldadoCentavos: 0 })).toBe(14_000);
    expect(pendienteDe({ ...luis, prestadoCentavos: 8_000, saldadoCentavos: 3_000 })).toBe(19_000);
    expect(pendienteDe({ ...luis, montoInicialCentavos: 0, prestadoCentavos: 8_000, saldadoCentavos: 8_000 })).toBe(0);
  });

  it("abierta con pendiente mayor que cero, pagada con cero", () => {
    expect(estadoDe(1)).toBe("abierta");
    expect(estadoDe(0)).toBe("pagada");
  });

  it("nunca da un pendiente negativo", () => {
    expect(() => pendienteDe({ ...papas, saldadoCentavos: 52_001 })).toThrow();
    expect(() => estadoDe(-1)).toThrow();
  });
});

describe("★ 3 · pago de deuda", () => {
  const abierta: DeudaParaSaldar = { id: 7, sentido: "debo", pendienteCentavos: 32_000 };
  const pagar = (cambios: Partial<Parameters<typeof prepararPago>[0]> = {}, d = abierta) =>
    prepararPago({ monto: "200", fecha: hoy, nota: "", cuenta: binance, ...cambios }, d, sobreDeudas, hoy);

  it("sale de una cuenta en dólares y del sobre Deudas, con la deuda y sin categoría", () => {
    const r = pagar();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.fila).toMatchObject({
      tipo: "pago_deuda",
      montoCentavos: 20_000,
      moneda: "USDT",
      montoUsdCentavos: 20_000,
      cuentaOrigenId: binance.id,
      sobreOrigenId: sobreDeudas,
      deudaId: 7,
      categoriaId: null,
      cuentaDestinoId: null,
      sobreDestinoId: null,
    });
  });

  it("resta de la cuenta y del sobre Deudas, y baja el pendiente", () => {
    const r = pagar();
    if (!r.ok) throw new Error("debía preparar el pago");
    const tras = saldosTras([r.fila], { [binance.id]: 60_000 }, { [sobreDeudas]: 38_500 });
    expect(tras.cuentas[binance.id]).toBe(40_000);
    expect(tras.sobres[sobreDeudas]).toBe(18_500);
    expect(
      pendienteDe({ sentido: "debo", montoInicialCentavos: 52_000, prestadoCentavos: 0, saldadoCentavos: 40_000 }),
    ).toBe(12_000);
  });

  it("el monto va de 0,01 al pendiente", () => {
    expect(pagar({ monto: "0,01" }).ok).toBe(true);
    expect(pagar({ monto: "320" }).ok).toBe(true);
    expect(pagar({ monto: "0" }).ok).toBe(false);
    expect(pagar({ monto: "" }).ok).toBe(false);
  });

  it("solo desde una cuenta en dólares, nunca bolívares", () => {
    for (const cuenta of enDolares) expect(pagar({ cuenta }).ok).toBe(true);
    const r = pagar({ cuenta: bolivares });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores.cuenta).toBeDefined();
    expect(pagar({ cuenta: null }).ok).toBe(false);
  });

  it("solo a una deuda abierta que debo", () => {
    expect(pagar({}, { ...abierta, sentido: "me_deben" }).ok).toBe(false);
    expect(pagar({}, { ...abierta, pendienteCentavos: 0 }).ok).toBe(false);
  });

  it("la cuenta viene elegida: la prevista de la deuda; si no tiene, la primera en dólares", () => {
    const cuentas = [bolivares, binance, segunda, efectivo];
    expect(cuentaParaPagar(efectivo.id, cuentas)).toBe(efectivo.id);
    expect(cuentaParaPagar(null, cuentas)).toBe(binance.id);
  });

  it('si Deudas no alcanza, el formulario avisa: "Deudas tiene 135,00; quedará en −115,00"', () => {
    expect(avisoDelSobreDeudas(13_500, 25_000)).toEqual({
      texto: "Deudas tiene 135,00; quedará en −115,00",
      negativo: true,
    });
    expect(avisoDelSobreDeudas(38_500, 20_000)).toEqual({
      texto: "Deudas tiene 385,00; quedará en 185,00",
      negativo: false,
    });
  });
});

describe("★ 6 · nunca más que lo pendiente", () => {
  it("un pago mayor que el pendiente se rechaza con el error en su campo", () => {
    const r = prepararPago(
      { monto: "320,01", fecha: hoy, nota: "", cuenta: binance },
      { id: 7, sentido: "debo", pendienteCentavos: 32_000 },
      sobreDeudas,
      hoy,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errores)).toEqual(["monto"]);
  });
});

describe("★ 15 · patrimonio neto", () => {
  it("1.430,00 en cuentas, 140,00 que me deben y 770,00 que debo dan 800,00", () => {
    expect(patrimonioNeto({ cuentasCentavos: 143_000, meDebenCentavos: 14_000, deboCentavos: 77_000 })).toBe(80_000);
  });

  it("con los pendientes de las deudas abiertas: las pagadas no suman", () => {
    const totales = pendientePorSentido([
      { sentido: "debo", pendienteCentavos: 25_000 },
      { sentido: "debo", pendienteCentavos: 52_000 },
      { sentido: "debo", pendienteCentavos: 0 },
      { sentido: "me_deben", pendienteCentavos: 14_000 },
      { sentido: "me_deben", pendienteCentavos: 0 },
    ]);
    expect(totales).toEqual({ deboCentavos: 77_000, meDebenCentavos: 14_000 });
    expect(patrimonioNeto({ cuentasCentavos: 143_000, ...totales })).toBe(80_000);
  });
});

describe("★ 16 · corregir sin romper el pendiente", () => {
  it("en lo que debo, el monto inicial no baja de lo ya pagado", () => {
    const movido = { prestadoCentavos: 0, saldadoCentavos: 20_000 };
    expect(montoInicialMinimo({ sentido: "debo", ...movido })).toBe(20_000);
    expect(validarDeuda(entrada({ monto: "199,99" }), enDolares, movido).ok).toBe(false);
    const igual = validarDeuda(entrada({ monto: "200" }), enDolares, movido);
    expect(igual.ok).toBe(true);
    if (igual.ok) expect(pendienteDe({ ...igual.deuda, ...movido })).toBe(0);
  });

  it("en lo que me deben, no baja de lo cobrado menos lo prestado", () => {
    const sinPrestar = { prestadoCentavos: 0, saldadoCentavos: 6_000 };
    expect(montoInicialMinimo({ sentido: "me_deben", ...sinPrestar })).toBe(6_000);
    const conPrestamo = { prestadoCentavos: 8_000, saldadoCentavos: 3_000 };
    expect(montoInicialMinimo({ sentido: "me_deben", ...conPrestamo })).toBe(0);

    const meDeben = (monto: string, movido: typeof sinPrestar) =>
      validarDeuda(entrada({ sentido: "me_deben", monto, cuentaPrevistaId: null }), enDolares, movido);
    expect(meDeben("59,99", sinPrestar).ok).toBe(false);
    expect(meDeben("60", sinPrestar).ok).toBe(true);
  });

  it("ningún monto aceptado al editar deja el pendiente en negativo", () => {
    const casos = [
      { sentido: "debo" as const, prestadoCentavos: 0, saldadoCentavos: 31_234 },
      { sentido: "me_deben" as const, prestadoCentavos: 0, saldadoCentavos: 4_500 },
      { sentido: "me_deben" as const, prestadoCentavos: 2_000, saldadoCentavos: 9_000 },
    ];
    for (const { sentido, ...movido } of casos) {
      const minimo = montoInicialMinimo({ sentido, ...movido });
      expect(pendienteDe({ sentido, montoInicialCentavos: minimo, ...movido })).toBeGreaterThanOrEqual(0);
      if (minimo > 0) expect(() => pendienteDe({ sentido, montoInicialCentavos: minimo - 1, ...movido })).toThrow();
    }
  });
});
