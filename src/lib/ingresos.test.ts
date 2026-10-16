/**
 * Criterios 6 a 9 de la spec 004: de lo tecleado en el ingreso a las filas que se guardan, y la validación de los
 * montos confirmados para cada sobre. Lo que solo se ve en la base (una sentencia, el candado) lo comprueba
 * scripts/comprobar-004.ts.
 */
import { describe, expect, it } from "vitest";
import { saldosTras } from "./saldos";
import {
  type AsignacionTecleada,
  type CuentaIngreso,
  type EntradaIngreso,
  asignacionesDelFormulario,
  campoDeAsignacion,
  camposDePropuesta,
  filasDeReparto,
  prepararIngreso,
  validarAsignaciones,
} from "./ingresos";

const hoy = "2026-10-14";
const binance: CuentaIngreso = { id: 1, moneda: "USDT" };
const segunda: CuentaIngreso = { id: 2, moneda: "USDC" };
const efectivo: CuentaIngreso = { id: 3, moneda: "USD" };
const prima: CuentaIngreso = { id: 4, moneda: "USD" };
const bolivares: CuentaIngreso = { id: 5, moneda: "VES" };

const porAsignar = 1;
const gastosDelMes = 2;
const familia = 3;
const emergencia = 4;
const planes = 5;
const ocasiones = 6;
const inversion = 7;
const sueldo = 20;
const activos = [porAsignar, gastosDelMes, familia, emergencia, planes, ocasiones, inversion];

/** El primer cobro de octubre del ejemplo del plan, repartido como lo propone la regla sembrada. */
const propuesta: AsignacionTecleada[] = [
  { sobreId: gastosDelMes, monto: "450" },
  { sobreId: familia, monto: "100" },
  { sobreId: ocasiones, monto: "25" },
  { sobreId: emergencia, monto: "250" },
  { sobreId: planes, monto: "187,50" },
  { sobreId: inversion, monto: "187,50" },
];

function entrada(cambios: Partial<EntradaIngreso>): EntradaIngreso {
  return {
    monto: "1200",
    fecha: hoy,
    nota: "",
    categoriaId: sueldo,
    porAsignarId: porAsignar,
    sobresValidos: activos,
    asignaciones: propuesta,
    ...cambios,
  };
}

function guardar(cambios: Partial<EntradaIngreso>, cuenta: CuentaIngreso | null = binance) {
  const resultado = prepararIngreso(entrada(cambios), hoy, cuenta);
  if (!resultado.ok) throw new Error(`Se esperaba guardar y hubo errores: ${JSON.stringify(resultado.errores)}`);
  return resultado;
}

function rechazar(cambios: Partial<EntradaIngreso>, cuenta: CuentaIngreso | null = binance) {
  const resultado = prepararIngreso(entrada(cambios), hoy, cuenta);
  if (resultado.ok) throw new Error(`No debía guardarse y dio ${resultado.filas.length} movimientos`);
  return resultado.errores;
}

const reasignacion = (sobreDestinoId: number, centavos: number, fecha = hoy) => ({
  fecha,
  tipo: "reasignacion",
  montoCentavos: centavos,
  moneda: "USD",
  montoUsdCentavos: centavos,
  montoDestinoCentavos: null,
  monedaDestino: null,
  tasa: null,
  cuentaOrigenId: null,
  cuentaDestinoId: null,
  sobreOrigenId: porAsignar,
  sobreDestinoId,
  categoriaId: null,
  nota: null,
  origen: "manual",
});

describe("★ criterio 6 · el ingreso cae en la cuenta y en Por asignar", () => {
  it("1.200 en Binance: un ingreso en USDT que vale 1 a 1 en USD, a Por asignar, con categoría, fecha y nota", () => {
    const { filas } = guardar({ nota: "  Sueldo de octubre " });
    expect(filas[0]).toEqual({
      fecha: hoy,
      tipo: "ingreso",
      montoCentavos: 120_000,
      moneda: "USDT",
      montoUsdCentavos: 120_000,
      montoDestinoCentavos: null,
      monedaDestino: null,
      tasa: null,
      cuentaOrigenId: null,
      cuentaDestinoId: binance.id,
      sobreOrigenId: null,
      sobreDestinoId: porAsignar,
      categoriaId: sueldo,
      nota: "Sueldo de octubre",
      origen: "manual",
    });
  });

  it("una reasignación en USD desde Por asignar a cada sobre con monto, en la fecha del ingreso", () => {
    const { filas } = guardar({ fecha: "2026-10-01" });
    expect(filas.slice(1)).toEqual([
      reasignacion(gastosDelMes, 45_000, "2026-10-01"),
      reasignacion(familia, 10_000, "2026-10-01"),
      reasignacion(ocasiones, 2_500, "2026-10-01"),
      reasignacion(emergencia, 25_000, "2026-10-01"),
      reasignacion(planes, 18_750, "2026-10-01"),
      reasignacion(inversion, 18_750, "2026-10-01"),
    ]);
  });

  it("los sobres en 0 o vacíos no dan reasignación", () => {
    const asignaciones = [
      { sobreId: gastosDelMes, monto: "1200" },
      { sobreId: familia, monto: "0" },
      { sobreId: emergencia, monto: "" },
      { sobreId: planes, monto: "0,00" },
    ];
    expect(guardar({ asignaciones }).filas.map((f) => f.tipo)).toEqual(["ingreso", "reasignacion"]);
  });

  it("USDC, USD y la cuenta de la prima también entran 1 a 1 (ADR 0006)", () => {
    for (const cuenta of [segunda, efectivo, prima]) {
      const [ingreso] = guardar({ monto: "800", asignaciones: [{ sobreId: planes, monto: "800" }] }, cuenta).filas;
      expect(ingreso).toMatchObject({ cuentaDestinoId: cuenta.id, moneda: cuenta.moneda, montoCentavos: 80_000 });
      expect(ingreso.montoUsdCentavos).toBe(80_000);
    }
  });

  it("la cuenta en bolívares no se acepta, ni la falta de cuenta", () => {
    expect(rechazar({}, bolivares).cuenta).toBeDefined();
    expect(rechazar({}, null).cuenta).toBeDefined();
  });

  it("el monto se lee con aCentavos y debe ser mayor que cero", () => {
    expect(guardar({ monto: "1.200,50", asignaciones: [] }).filas[0].montoCentavos).toBe(120_050);
    for (const monto of ["", "abc", "0", "-5", "0,001"]) expect(rechazar({ monto }).monto, monto).toBeDefined();
  });

  it("la fecha es hoy o un día anterior, y real", () => {
    for (const fecha of ["2026-10-15", "2026-02-30", "", "hoy"]) expect(rechazar({ fecha }).fecha, fecha).toBeDefined();
    expect(guardar({ fecha: "2026-09-30" }).filas.every((f) => f.fecha === "2026-09-30")).toBe(true);
  });

  it("una nota vacía se guarda como null", () => {
    expect(guardar({ nota: "   " }).filas[0].nota).toBeNull();
  });

  it("con varios errores los devuelve todos a la vez", () => {
    expect(Object.keys(rechazar({ monto: "", fecha: "2030-01-01" }, bolivares)).sort()).toEqual([
      "cuenta",
      "fecha",
      "monto",
    ]);
  });
});

describe("★ criterio 8 · lo que se ve es lo que se guarda", () => {
  it("guarda exactamente los montos confirmados, aunque no sean la propuesta", () => {
    const asignaciones = [
      { sobreId: gastosDelMes, monto: "500" },
      { sobreId: inversion, monto: "700" },
    ];
    expect(guardar({ asignaciones }).filas.slice(1)).toEqual([
      reasignacion(gastosDelMes, 50_000),
      reasignacion(inversion, 70_000),
    ]);
  });

  it("si la suma es menor, guarda y dice cuánto queda sin asignar", () => {
    const asignaciones = [{ sobreId: gastosDelMes, monto: "1150" }];
    expect(guardar({ asignaciones }).sinAsignar).toBe(5_000);
    expect(guardar({}).sinAsignar).toBe(0);
  });

  it("los errores del reparto se devuelven junto a los demás", () => {
    const errores = rechazar({ fecha: "2030-01-01", asignaciones: [{ sobreId: familia, monto: "-1" }] });
    expect(errores.fecha).toBeDefined();
    expect(errores.sobres?.[familia]).toBeDefined();
  });

  it("Por asignar no puede recibir reparto, aunque llegue entre los sobres válidos", () => {
    const errores = rechazar({ asignaciones: [{ sobreId: porAsignar, monto: "10" }] });
    expect(errores.sobres?.[porAsignar]).toBeDefined();
  });
});

describe("validarAsignaciones", () => {
  const validos = [gastosDelMes, familia, emergencia, planes, ocasiones, inversion];

  it("con la suma exacta: los centavos de cada sobre y nada sin asignar", () => {
    expect(validarAsignaciones(120_000, propuesta, validos)).toEqual({
      ok: true,
      asignaciones: [
        { sobreId: gastosDelMes, centavos: 45_000 },
        { sobreId: familia, centavos: 10_000 },
        { sobreId: ocasiones, centavos: 2_500 },
        { sobreId: emergencia, centavos: 25_000 },
        { sobreId: planes, centavos: 18_750 },
        { sobreId: inversion, centavos: 18_750 },
      ],
      sinAsignar: 0,
    });
  });

  it("con la suma menor: lo que queda en Por asignar", () => {
    const resultado = validarAsignaciones(120_000, [{ sobreId: planes, monto: "1150" }], validos);
    expect(resultado).toMatchObject({ ok: true, sinAsignar: 5_000 });
  });

  it("un campo vacío vale 0", () => {
    expect(validarAsignaciones(100, [{ sobreId: planes, monto: "  " }], validos)).toEqual({
      ok: true,
      asignaciones: [{ sobreId: planes, centavos: 0 }],
      sinAsignar: 100,
    });
  });

  function erroresDe(monto: number, asignaciones: AsignacionTecleada[]) {
    const resultado = validarAsignaciones(monto, asignaciones, validos);
    if (resultado.ok) throw new Error("Se esperaban errores");
    return resultado.errores;
  }

  it("rechaza un monto negativo, con el error en su campo", () => {
    expect(Object.keys(erroresDe(100_00, [{ sobreId: planes, monto: "-5" }]).sobres ?? {})).toEqual([String(planes)]);
  });

  it("rechaza más de dos decimales en vez de redondear, y lo que no es número", () => {
    for (const monto of ["10,555", "0,001", "abc", "1e3"]) {
      expect(erroresDe(100_00, [{ sobreId: planes, monto }]).sobres?.[planes], monto).toBeDefined();
    }
  });

  it("rechaza una suma mayor que el monto, con un error del reparto", () => {
    const errores = erroresDe(1_000_00, [
      { sobreId: planes, monto: "600" },
      { sobreId: inversion, monto: "400,01" },
    ]);
    expect(errores.reparto).toBeDefined();
    expect(errores.sobres).toBeUndefined();
  });

  it("rechaza un sobre que no existe, está inactivo o se repite", () => {
    expect(erroresDe(100_00, [{ sobreId: 99, monto: "10" }]).sobres?.[99]).toBeDefined();
    const repetido = erroresDe(100_00, [
      { sobreId: planes, monto: "10" },
      { sobreId: planes, monto: "20" },
    ]);
    expect(repetido.sobres?.[planes]).toBeDefined();
  });

  it("no suma si algún campo tiene error: el error es del campo, no del total", () => {
    const errores = erroresDe(10_00, [
      { sobreId: planes, monto: "abc" },
      { sobreId: inversion, monto: "500" },
    ]);
    expect(errores.sobres?.[planes]).toBeDefined();
    expect(errores.reparto).toBeUndefined();
  });

  it("lanza si el monto a repartir no es un entero de centavos no negativo", () => {
    expect(() => validarAsignaciones(-1, [], validos)).toThrow();
    expect(() => validarAsignaciones(1.5, [], validos)).toThrow();
  });
});

describe("filasDeReparto", () => {
  it("una reasignación desde Por asignar por cada sobre con monto, sin las de 0", () => {
    const filas = filasDeReparto(
      porAsignar,
      [
        { sobreId: planes, centavos: 30_00 },
        { sobreId: inversion, centavos: 0 },
        { sobreId: emergencia, centavos: 20_00 },
      ],
      hoy,
    );
    expect(filas).toEqual([reasignacion(planes, 30_00), reasignacion(emergencia, 20_00)]);
  });
});

describe("★ criterio 9 · el invariante se mantiene", () => {
  const suma = (saldos: Record<number, number>) => Object.values(saldos).reduce((a, b) => a + b, 0);
  /** Cuentas en dólares y sobres que cuadran: los dos suman 60.000 centavos. */
  const cuentas = { [binance.id]: 50_000, [prima.id]: 10_000 };
  const sobres = { [porAsignar]: 0, [gastosDelMes]: 45_000, [ocasiones]: 15_000 };

  it("tras el ingreso repartido, cuentas y sobres suben lo mismo y Por asignar queda donde estaba", () => {
    const despues = saldosTras(guardar({}).filas, cuentas, sobres);
    expect(suma(despues.cuentas)).toBe(60_000 + 120_000);
    expect(suma(despues.sobres)).toBe(suma(despues.cuentas));
    expect(despues.sobres[porAsignar]).toBe(0);
    expect(despues.sobres[gastosDelMes]).toBe(45_000 + 45_000);
  });

  it("con algo sin repartir, cuadra igual y lo que queda está en Por asignar", () => {
    const { filas, sinAsignar } = guardar({ asignaciones: [{ sobreId: gastosDelMes, monto: "1000" }] });
    const despues = saldosTras(filas, cuentas, sobres);
    expect(suma(despues.sobres)).toBe(suma(despues.cuentas));
    expect(despues.sobres[porAsignar]).toBe(sinAsignar);
    expect(sinAsignar).toBe(20_000);
  });

  it("un ingreso en la cuenta de la prima también cuadra (ADR 0006)", () => {
    const despues = saldosTras(guardar({}, prima).filas, cuentas, sobres);
    expect(despues.cuentas[prima.id]).toBe(10_000 + 120_000);
    expect(suma(despues.sobres)).toBe(suma(despues.cuentas));
  });

  it("repartir lo que ya estaba en Por asignar no cambia ninguna cuenta", () => {
    const conSaldo = { ...sobres, [porAsignar]: 30_000, [gastosDelMes]: 15_000 };
    const filas = filasDeReparto(porAsignar, [{ sobreId: planes, centavos: 30_000 }], hoy);
    const despues = saldosTras(filas, cuentas, conSaldo);
    expect(despues.cuentas).toEqual(cuentas);
    expect(despues.sobres[porAsignar]).toBe(0);
    expect(suma(despues.sobres)).toBe(suma(conSaldo));
  });
});

describe("camposDePropuesta: la propuesta como se escribe en cada campo (criterios 2, 5 y 13)", () => {
  const conSaldo = (saldoEmergencia: number) => [
    { sobreId: gastosDelMes, orden: 1, tipo: "fijo" as const, valor: 450_00, topeCentavos: null, saldoCentavos: 0 },
    { sobreId: familia, orden: 2, tipo: "fijo" as const, valor: 100_00, topeCentavos: null, saldoCentavos: 0 },
    { sobreId: ocasiones, orden: 3, tipo: "fijo" as const, valor: 25_00, topeCentavos: null, saldoCentavos: 0 },
    {
      sobreId: emergencia,
      orden: 4,
      tipo: "porcentaje" as const,
      valor: 4_000,
      topeCentavos: 2_700_00,
      saldoCentavos: saldoEmergencia,
    },
    { sobreId: planes, orden: 5, tipo: "porcentaje" as const, valor: 3_000, topeCentavos: null, saldoCentavos: 0 },
    { sobreId: inversion, orden: 6, tipo: "porcentaje" as const, valor: 3_000, topeCentavos: null, saldoCentavos: 0 },
  ];
  const octubre = { "2026-10": { [gastosDelMes]: 450_00, [familia]: 100_00, [ocasiones]: 25_00 } };

  it("el primer cobro del mes, como textos que validarAsignaciones lee igual", () => {
    const campos = camposDePropuesta(1_200_00, "2026-10-01", conSaldo(0), {});
    expect(campos).toEqual({
      [gastosDelMes]: "450",
      [familia]: "100",
      [ocasiones]: "25",
      [emergencia]: "250",
      [planes]: "187,50",
      [inversion]: "187,50",
    });
    const tecleadas = Object.entries(campos).map(([sobreId, monto]) => ({ sobreId: Number(sobreId), monto }));
    expect(validarAsignaciones(1_200_00, tecleadas, activos)).toMatchObject({ ok: true, sinAsignar: 0 });
  });

  it("lo recibido es el del mes de la fecha: en octubre los fijos ya están, en septiembre no", () => {
    expect(camposDePropuesta(800_00, "2026-10-20", conSaldo(0), octubre)).toMatchObject({
      [gastosDelMes]: "0",
      [emergencia]: "320",
      [planes]: "240",
    });
    expect(camposDePropuesta(800_00, "2026-09-30", conSaldo(0), octubre)).toMatchObject({
      [gastosDelMes]: "450",
      [emergencia]: "90",
      [planes]: "67,50",
    });
  });

  it("usa el saldo de cada sobre para su tope", () => {
    expect(camposDePropuesta(1_200_00, "2026-10-01", conSaldo(2_700_00), {})).toMatchObject({
      [emergencia]: "0",
      [planes]: "312,50",
    });
  });
});

describe("campos del reparto en el formulario", () => {
  it("cada sobre tiene su campo, y se leen todos los que llegan, por id de sobre", () => {
    const datos = new FormData();
    datos.set(campoDeAsignacion(planes), "187,50");
    datos.set(campoDeAsignacion(inversion), "");
    datos.set("monto", "1200");
    datos.set("asignacion-", "1");
    datos.set("asignacion-abc", "1");
    datos.set("asignacion-1234567890", "1");
    expect(asignacionesDelFormulario(datos)).toEqual({ [planes]: "187,50", [inversion]: "" });
  });
});
