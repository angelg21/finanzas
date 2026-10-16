/**
 * Spec 005, lo que debo: registrar una deuda, su pendiente calculado y el pago (criterios 1 a 3, 6 y 16). Lo que solo
 * se ve en la base (el candado, la nueva comprobación del pendiente, el check) lo comprueba scripts/comprobar-005.ts.
 */
import { describe, expect, it } from "vitest";
import { saldosTras } from "./saldos";
import {
  type CuentaDeuda,
  type EntradaDeuda,
  type EntradaPago,
  avisoDelSobreDeudas,
  cuentaParaPagar,
  estadoDe,
  montoInicialMinimo,
  pendienteDe,
  patrimonioNeto,
  pendientePorSentido,
  prepararPago,
  validarDeuda,
} from "./deudas";

const hoy = "2026-10-15";
const binance: CuentaDeuda = { id: 1, moneda: "USDT" };
const prima: CuentaDeuda = { id: 4, moneda: "USD" };
const bolivares: CuentaDeuda = { id: 5, moneda: "VES" };
const enDolares = [binance, prima];
const sobreDeudas = 8;

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

function errores(e: EntradaDeuda, movido?: Parameters<typeof validarDeuda>[2]) {
  const r = validarDeuda(e, enDolares, movido);
  if (r.ok) throw new Error("Se esperaban errores");
  return r.errores;
}

describe("validarDeuda: registrar lo que ya existía (criterio 1)", () => {
  it("una deuda que debo, con fecha y cuenta prevista", () => {
    expect(validarDeuda(entrada({ nota: "  Pasajes  " }), enDolares)).toEqual({
      ok: true,
      deuda: {
        sentido: "debo",
        persona: "Papás",
        montoInicialCentavos: 52_000,
        fechaPrevista: "2026-12-15",
        cuentaPrevistaId: binance.id,
        nota: "Pasajes",
      },
    });
  });

  it("algo que me deben, sin fecha: la cuenta prevista no se guarda aunque llegue", () => {
    const r = validarDeuda(
      entrada({ sentido: "me_deben", persona: " Luis ", monto: "140", fechaPrevista: "" }),
      enDolares,
    );
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

  it("la fecha prevista puede estar en el pasado: una deuda ya vencida", () => {
    const r = validarDeuda(entrada({ fechaPrevista: "2026-09-30" }), enDolares);
    expect(r.ok && r.deuda.fechaPrevista).toBe("2026-09-30");
  });

  it("sin cuenta prevista también vale", () => {
    const r = validarDeuda(entrada({ cuentaPrevistaId: null }), enDolares);
    expect(r.ok && r.deuda.cuentaPrevistaId).toBeNull();
  });

  it("la persona, de 1 a 80 caracteres sin contar los espacios a los lados", () => {
    expect(errores(entrada({ persona: "   " })).persona).toBe("Escribe a quién");
    expect(errores(entrada({ persona: "a".repeat(81) })).persona).toBe("Usa hasta 80 caracteres");
    expect(validarDeuda(entrada({ persona: `  ${"a".repeat(80)}  ` }), enDolares).ok).toBe(true);
    // Una letra con tilde o un emoji cuentan como un carácter, no como dos.
    expect(validarDeuda(entrada({ persona: "ñ".repeat(80) }), enDolares).ok).toBe(true);
  });

  it("el monto se lee con aCentavos, de 0,01 a 21.474.836,47", () => {
    expect(errores(entrada({ monto: "" })).monto).toBe("Escribe el monto");
    expect(errores(entrada({ monto: "0" })).monto).toBe("Escribe un monto mayor que cero");
    expect(errores(entrada({ monto: "-5" })).monto).toBe("Escribe un monto mayor que cero");
    expect(errores(entrada({ monto: "abc" })).monto).toBe("Escribe un monto mayor que cero");
    expect(errores(entrada({ monto: "21474836,48" })).monto).toBe("No puede pasar de 21.474.836,47");
    const tope = validarDeuda(entrada({ monto: "21.474.836,47" }), enDolares);
    expect(tope.ok && tope.deuda.montoInicialCentavos).toBe(2_147_483_647);
    const minimo = validarDeuda(entrada({ monto: "0,01" }), enDolares);
    expect(minimo.ok && minimo.deuda.montoInicialCentavos).toBe(1);
  });

  it("al crear, también lo que me deben empieza en 0,01 o más", () => {
    expect(errores(entrada({ sentido: "me_deben", monto: "0" })).monto).toBe("Escribe un monto mayor que cero");
  });

  it("una fecha prevista que no es un día real es un error", () => {
    expect(errores(entrada({ fechaPrevista: "2026-02-30" })).fechaPrevista).toBe("Elige una fecha válida");
    expect(errores(entrada({ fechaPrevista: "mañana" })).fechaPrevista).toBe("Elige una fecha válida");
  });

  it("la cuenta prevista, solo una cuenta en dólares activa", () => {
    expect(errores(entrada({ cuentaPrevistaId: bolivares.id })).cuentaPrevista).toBe("Elige una cuenta en dólares");
    expect(errores(entrada({ cuentaPrevistaId: 99 })).cuentaPrevista).toBe("Elige una cuenta en dólares");
  });

  it("junta todos los errores a la vez", () => {
    expect(
      Object.keys(errores(entrada({ persona: "", monto: "", fechaPrevista: "x", cuentaPrevistaId: 99 }))).sort(),
    ).toEqual(["cuentaPrevista", "fechaPrevista", "monto", "persona"]);
  });
});

describe("pendienteDe y estadoDe: el pendiente se calcula (criterio 2)", () => {
  const papas = { sentido: "debo" as const, montoInicialCentavos: 52_000, prestadoCentavos: 0 };

  it("debo: monto inicial menos los pagos", () => {
    expect(pendienteDe({ ...papas, saldadoCentavos: 0 })).toBe(52_000);
    expect(pendienteDe({ ...papas, saldadoCentavos: 20_000 })).toBe(32_000);
    expect(pendienteDe({ ...papas, saldadoCentavos: 52_000 })).toBe(0);
  });

  it("me deben: monto inicial más préstamos menos cobros", () => {
    const luis = { sentido: "me_deben" as const, montoInicialCentavos: 0, prestadoCentavos: 14_000 };
    expect(pendienteDe({ ...luis, saldadoCentavos: 5_000 })).toBe(9_000);
    expect(pendienteDe({ ...luis, montoInicialCentavos: 1_000, saldadoCentavos: 5_000 })).toBe(10_000);
  });

  it("abierta con pendiente mayor que cero; pagada con cero", () => {
    expect(estadoDe(32_000)).toBe("abierta");
    expect(estadoDe(1)).toBe("abierta");
    expect(estadoDe(0)).toBe("pagada");
  });

  it("el error de unos datos rotos no lleva la persona ni la nota a los registros", () => {
    const fila = { ...papas, saldadoCentavos: 0.5, persona: "PERSONA-PRIVADA", nota: "NOTA-PRIVADA" };
    expect(() => pendienteDe(fila)).toThrow(RangeError);
    try {
      pendienteDe(fila);
    } catch (error) {
      expect(String(error)).not.toMatch(/PRIVADA/);
    }
  });

  it("un pendiente negativo o un préstamo en lo que debo son datos rotos y lanzan", () => {
    expect(() => pendienteDe({ ...papas, saldadoCentavos: 52_001 })).toThrow(RangeError);
    expect(() => pendienteDe({ ...papas, prestadoCentavos: 100, saldadoCentavos: 0 })).toThrow(RangeError);
    expect(() => pendienteDe({ ...papas, saldadoCentavos: 0.5 })).toThrow(RangeError);
    expect(() => estadoDe(-1)).toThrow(RangeError);
  });
});

describe("prepararPago (criterios 3 y 6)", () => {
  const papas = { id: 3, sentido: "debo" as const, pendienteCentavos: 52_000 };
  const pago = (cambios: Partial<EntradaPago>): EntradaPago => ({
    monto: "200",
    fecha: hoy,
    nota: "",
    cuenta: binance,
    ...cambios,
  });

  it("una fila pago_deuda: cuenta de origen, el sobre Deudas, la deuda y sin categoría", () => {
    expect(prepararPago(pago({ nota: " Primera parte " }), papas, sobreDeudas, hoy)).toEqual({
      ok: true,
      fila: {
        fecha: hoy,
        tipo: "pago_deuda",
        montoCentavos: 20_000,
        moneda: "USDT",
        montoUsdCentavos: 20_000,
        montoDestinoCentavos: null,
        monedaDestino: null,
        tasa: null,
        cuentaOrigenId: binance.id,
        cuentaDestinoId: null,
        sobreOrigenId: sobreDeudas,
        sobreDestinoId: null,
        categoriaId: null,
        deudaId: 3,
        nota: "Primera parte",
        origen: "manual",
      },
    });
  });

  it("en USD o USDT vale 1 a 1", () => {
    const r = prepararPago(pago({ cuenta: prima, monto: "320,50" }), papas, sobreDeudas, hoy);
    expect(r.ok && [r.fila.moneda, r.fila.montoCentavos, r.fila.montoUsdCentavos]).toEqual(["USD", 32_050, 32_050]);
  });

  it("de 0,01 al pendiente: pagar todo lo pendiente vale, un centavo más no", () => {
    expect(prepararPago(pago({ monto: "520" }), papas, sobreDeudas, hoy).ok).toBe(true);
    expect(prepararPago(pago({ monto: "0,01" }), papas, sobreDeudas, hoy).ok).toBe(true);
    expect(prepararPago(pago({ monto: "520,01" }), papas, sobreDeudas, hoy)).toEqual({
      ok: false,
      errores: { monto: "No puede pasar de lo pendiente: 520,00" },
    });
    expect(prepararPago(pago({ monto: "0" }), papas, sobreDeudas, hoy)).toEqual({
      ok: false,
      errores: { monto: "Escribe un monto mayor que cero" },
    });
    expect(prepararPago(pago({ monto: "" }), papas, sobreDeudas, hoy)).toEqual({
      ok: false,
      errores: { monto: "Escribe el monto" },
    });
  });

  it("solo desde una cuenta en dólares", () => {
    for (const cuenta of [bolivares, null]) {
      expect(prepararPago(pago({ cuenta }), papas, sobreDeudas, hoy)).toEqual({
        ok: false,
        errores: { cuenta: "Elige una cuenta en dólares" },
      });
    }
  });

  it("la fecha del pago, hoy o antes", () => {
    expect(prepararPago(pago({ fecha: "2026-10-16" }), papas, sobreDeudas, hoy)).toEqual({
      ok: false,
      errores: { fecha: "Elige hoy o un día anterior" },
    });
    expect(prepararPago(pago({ fecha: "2026-10-01" }), papas, sobreDeudas, hoy).ok).toBe(true);
  });

  it("una deuda pagada o algo que me deben no se paga", () => {
    expect(prepararPago(pago({}), { ...papas, pendienteCentavos: 0 }, sobreDeudas, hoy)).toEqual({
      ok: false,
      errores: { deuda: "Esta deuda ya está pagada" },
    });
    expect(prepararPago(pago({}), { ...papas, sentido: "me_deben" }, sobreDeudas, hoy)).toEqual({
      ok: false,
      errores: { deuda: "Esto no es algo que debas" },
    });
  });

  it("el ejemplo: Papás 520,00; tras 200,00 quedan 320,00 abiertos; tras 320,00 está pagada", () => {
    const primero = prepararPago(pago({ monto: "200" }), papas, sobreDeudas, hoy);
    if (!primero.ok) throw new Error("primer pago");
    const tras1 = pendienteDe({
      sentido: "debo",
      montoInicialCentavos: 52_000,
      prestadoCentavos: 0,
      saldadoCentavos: 20_000,
    });
    expect([tras1, estadoDe(tras1)]).toEqual([32_000, "abierta"]);
    const segundo = prepararPago(pago({ monto: "320" }), { ...papas, pendienteCentavos: tras1 }, sobreDeudas, hoy);
    if (!segundo.ok) throw new Error("segundo pago");
    const tras2 = pendienteDe({
      sentido: "debo",
      montoInicialCentavos: 52_000,
      prestadoCentavos: 0,
      saldadoCentavos: 52_000,
    });
    expect([tras2, estadoDe(tras2)]).toEqual([0, "pagada"]);
  });

  it("resta de la cuenta y del sobre Deudas por igual: el invariante se mantiene", () => {
    const r = prepararPago(pago({}), papas, sobreDeudas, hoy);
    if (!r.ok) throw new Error("pago");
    const despues = saldosTras([r.fila], { [binance.id]: 60_000 }, { [sobreDeudas]: 60_000 });
    expect(despues).toEqual({ cuentas: { [binance.id]: 40_000 }, sobres: { [sobreDeudas]: 40_000 } });
  });
});

describe("cuentaParaPagar: la cuenta viene elegida (criterio 3)", () => {
  it("la prevista de la deuda, si sigue siendo una cuenta en dólares activa", () => {
    expect(cuentaParaPagar(prima.id, [bolivares, binance, prima])).toBe(prima.id);
  });

  it("si no tiene, o ya no es válida, la primera cuenta en dólares", () => {
    expect(cuentaParaPagar(null, [bolivares, binance, prima])).toBe(binance.id);
    expect(cuentaParaPagar(bolivares.id, [bolivares, binance, prima])).toBe(binance.id);
    expect(cuentaParaPagar(99, [bolivares, binance, prima])).toBe(binance.id);
  });

  it("sin cuentas en dólares, ninguna", () => {
    expect(cuentaParaPagar(null, [bolivares])).toBeNull();
  });
});

describe("avisoDelSobreDeudas: el aviso antes de guardar (criterio 3)", () => {
  it("si no alcanza, dice cuánto tiene y en cuánto quedará, en negativo", () => {
    expect(avisoDelSobreDeudas(13_500, 25_000)).toEqual({
      texto: "Deudas tiene 135,00; quedará en −115,00",
      negativo: true,
    });
  });

  it("si alcanza, la misma línea sin marca negativa; justo en cero no es negativo", () => {
    expect(avisoDelSobreDeudas(38_500, 25_000)).toEqual({
      texto: "Deudas tiene 385,00; quedará en 135,00",
      negativo: false,
    });
    expect(avisoDelSobreDeudas(25_000, 25_000).negativo).toBe(false);
  });

  it("si Deudas ya estaba en negativo, lo dice con su signo", () => {
    expect(avisoDelSobreDeudas(-1_000, 500).texto).toBe("Deudas tiene −10,00; quedará en −15,00");
  });
});

describe("montoInicialMinimo y editar sin romper el pendiente (criterio 16)", () => {
  it("debo: no baja de lo ya pagado, y nunca de 0,01", () => {
    expect(montoInicialMinimo({ sentido: "debo", prestadoCentavos: 0, saldadoCentavos: 20_000 })).toBe(20_000);
    expect(montoInicialMinimo({ sentido: "debo", prestadoCentavos: 0, saldadoCentavos: 0 })).toBe(1);
  });

  it("me deben: no baja de lo cobrado menos lo prestado, y nunca de cero", () => {
    expect(montoInicialMinimo({ sentido: "me_deben", prestadoCentavos: 14_000, saldadoCentavos: 5_000 })).toBe(0);
    expect(montoInicialMinimo({ sentido: "me_deben", prestadoCentavos: 0, saldadoCentavos: 5_000 })).toBe(5_000);
    expect(montoInicialMinimo({ sentido: "me_deben", prestadoCentavos: 3_000, saldadoCentavos: 5_000 })).toBe(2_000);
  });

  it("al editar, validarDeuda rechaza un monto que dejaría el pendiente en negativo", () => {
    const pagado = { prestadoCentavos: 0, saldadoCentavos: 20_000 };
    expect(errores(entrada({ monto: "199,99" }), pagado).monto).toBe("Ya pagaste 200,00: no puede ser menos");
    const r = validarDeuda(entrada({ monto: "200" }), enDolares, pagado);
    expect(
      r.ok && pendienteDe({ sentido: "debo", montoInicialCentavos: r.deuda.montoInicialCentavos, ...pagado }),
    ).toBe(0);
  });

  it("al editar un préstamo, el monto inicial puede quedar en cero", () => {
    const prestamo = { prestadoCentavos: 14_000, saldadoCentavos: 5_000 };
    const r = validarDeuda(entrada({ sentido: "me_deben", monto: "0" }), enDolares, prestamo);
    expect(r.ok && r.deuda.montoInicialCentavos).toBe(0);
  });

  it("al editar lo que me deben, el mínimo es lo cobrado de más sobre lo prestado", () => {
    const cobrado = { prestadoCentavos: 0, saldadoCentavos: 5_000 };
    expect(errores(entrada({ sentido: "me_deben", monto: "49" }), cobrado).monto).toBe(
      "Ya te devolvieron 50,00: no puede ser menos",
    );
  });
});

describe("pendientePorSentido: lo que debo y lo que me deben, abierto", () => {
  it("suma los pendientes por sentido; las pagadas suman cero", () => {
    expect(
      pendientePorSentido([
        { sentido: "debo", pendienteCentavos: 25_000 },
        { sentido: "debo", pendienteCentavos: 52_000 },
        { sentido: "debo", pendienteCentavos: 0 },
        { sentido: "me_deben", pendienteCentavos: 14_000 },
      ]),
    ).toEqual({ deboCentavos: 77_000, meDebenCentavos: 14_000 });
  });

  it("sin deudas, cero y cero", () => {
    expect(pendientePorSentido([])).toEqual({ deboCentavos: 0, meDebenCentavos: 0 });
  });
});

describe("patrimonioNeto: cuentas más lo que me deben menos lo que debo (criterio 15)", () => {
  it("el ejemplo: 1.430,00 en cuentas, 140,00 que me deben y 770,00 que debo dan 800,00", () => {
    expect(patrimonioNeto({ cuentasCentavos: 143_000, meDebenCentavos: 14_000, deboCentavos: 77_000 })).toBe(80_000);
  });

  it("puede quedar en negativo", () => {
    expect(patrimonioNeto({ cuentasCentavos: 10_000, meDebenCentavos: 0, deboCentavos: 25_000 })).toBe(-15_000);
  });
});
