/**
 * Criterios ★ 6 a 10 de la spec 004 (ingresos y reparto) que se cumplen en funciones puras, escritos desde el texto
 * de cada criterio. Las pruebas de construcción viven en ingresos.test.ts. Lo que solo se ve en la base (una sola
 * sentencia, el cuadre de /cuentas, el candado al repartir) lo comprueba scripts/comprobar-004.ts.
 */
import { describe, expect, it } from "vitest";
import { prefijoDeCaptura, referenciaDeCaptura, referenciaDeReasignacion, resolverReintento } from "./captura";
import { saldosTras } from "./saldos";
import {
  type AsignacionTecleada,
  type CuentaIngreso,
  type EntradaIngreso,
  type FilaIngreso,
  type ReglaConSaldo,
  camposDePropuesta,
  filasDeReparto,
  prepararIngreso,
  validarAsignaciones,
} from "./ingresos";

const hoy = "2026-10-15";
const binance: CuentaIngreso = { id: 1, moneda: "USDT" };
const segunda: CuentaIngreso = { id: 2, moneda: "USDC" };
const prima: CuentaIngreso = { id: 4, moneda: "USD" };
const bolivares: CuentaIngreso = { id: 5, moneda: "VES" };
const porAsignar = 1;
const gastosDelMes = 2;
const familia = 3;
const emergencia = 7;
const planes = 8;
const inversion = 9;
/** Un sobre que existe pero está inactivo: no viene entre los válidos. */
const inactivo = 10;
const sueldo = 20;
const validos = [porAsignar, gastosDelMes, familia, emergencia, planes, inversion];

function entrada(cambios: Partial<EntradaIngreso>): EntradaIngreso {
  return {
    monto: "1200",
    fecha: hoy,
    nota: "",
    categoriaId: sueldo,
    porAsignarId: porAsignar,
    sobresValidos: validos,
    asignaciones: [],
    ...cambios,
  };
}

const tecleo = (pares: [number, string][]): AsignacionTecleada[] =>
  pares.map(([sobreId, monto]) => ({ sobreId, monto }));

function guardar(cambios: Partial<EntradaIngreso>, cuenta: CuentaIngreso = binance) {
  const r = prepararIngreso(entrada(cambios), hoy, cuenta);
  if (!r.ok) throw new Error(`Se esperaba guardar y hubo errores: ${JSON.stringify(r.errores)}`);
  return r;
}

function errores(cambios: Partial<EntradaIngreso>, cuenta: CuentaIngreso | null = binance) {
  const r = prepararIngreso(entrada(cambios), hoy, cuenta);
  if (r.ok) throw new Error("Se esperaba un rechazo y se guardó");
  return r.errores;
}

const reasignaciones = (filas: FilaIngreso[]) => filas.filter((f) => f.tipo === "reasignacion");

describe("★ 6 · cae en la cuenta y en Por asignar", () => {
  it("guarda una fila ingreso con su cuenta, Por asignar, la categoría, la fecha y la nota", () => {
    const { filas } = guardar({ fecha: "2026-10-14", nota: " Octubre " });
    const ingresos = filas.filter((f) => f.tipo === "ingreso");
    expect(ingresos).toHaveLength(1);
    expect(ingresos[0]).toMatchObject({
      cuentaDestinoId: binance.id,
      sobreDestinoId: porAsignar,
      categoriaId: sueldo,
      fecha: "2026-10-14",
      nota: "Octubre",
      montoCentavos: 120_000,
    });
  });

  it("una reasignación en USD de Por asignar a cada sobre con monto mayor que cero", () => {
    const asignaciones = tecleo([
      [gastosDelMes, "450"],
      [familia, "0"],
      [emergencia, "250"],
      [planes, ""],
      [inversion, "187,50"],
    ]);
    const r = reasignaciones(guardar({ asignaciones }).filas);
    expect(r.map((f) => [f.sobreDestinoId, f.montoCentavos])).toEqual([
      [gastosDelMes, 45_000],
      [emergencia, 25_000],
      [inversion, 18_750],
    ]);
    for (const f of r) {
      expect(f).toMatchObject({
        sobreOrigenId: porAsignar,
        moneda: "USD",
        cuentaDestinoId: null,
        cuentaOrigenId: null,
      });
      expect(f.montoUsdCentavos).toBe(f.montoCentavos);
    }
  });

  it.each([binance, segunda, prima])("una cuenta en $moneda vale 1 a 1 en USD", (cuenta) => {
    const ingreso = guardar({ monto: "1234,56" }, cuenta).filas[0];
    expect(ingreso).toMatchObject({ tipo: "ingreso", moneda: cuenta.moneda, montoCentavos: 123_456 });
    expect(ingreso?.montoUsdCentavos).toBe(123_456);
  });

  it("la cuenta en bolívares no vale", () => {
    expect(errores({}, bolivares).cuenta).toBeDefined();
    expect(errores({}, null).cuenta).toBeDefined();
  });
});

describe("★ 7 · las referencias de la captura y el reintento", () => {
  const id = "0C040004-AAAA-4BBB-8CCC-DDDDEEEEFFFF";

  it("el ingreso es captura-<uuid>-ingreso y cada reasignación captura-<uuid>-reasignacion-<sobre>", () => {
    expect(referenciaDeCaptura(id, "ingreso")).toBe("captura-0c040004-aaaa-4bbb-8ccc-ddddeeeeffff-ingreso");
    expect(referenciaDeReasignacion(id, planes)).toBe(
      `captura-0c040004-aaaa-4bbb-8ccc-ddddeeeeffff-reasignacion-${planes}`,
    );
  });

  it("todas las filas de la captura se releen con el mismo prefijo, sin abarcar otra captura", () => {
    const prefijo = prefijoDeCaptura(id);
    expect(referenciaDeCaptura(id, "ingreso").startsWith(prefijo)).toBe(true);
    expect(referenciaDeReasignacion(id, inversion).startsWith(prefijo)).toBe(true);
    const otra = "0c040004-aaaa-4bbb-8ccc-ddddeeeefff0";
    expect(referenciaDeCaptura(otra, "ingreso").startsWith(prefijo)).toBe(false);
  });

  const filas = guardar({
    asignaciones: tecleo([
      [gastosDelMes, "450"],
      [planes, "750"],
    ]),
  }).filas;
  const ahora = new Date("2026-10-15T12:00:00Z");
  const guardadas = (hace: number, f = filas) => f.map((x) => ({ ...x, creadoEn: new Date(ahora.getTime() - hace) }));

  it('el mismo envío, guardado hace un momento, es "ya estaba"', () => {
    expect(resolverReintento(guardadas(5_000), filas, ahora)).toBe("ya-estaba");
  });

  it('con un monto cambiado, o guardado hace mucho, es "otra"', () => {
    const cambiadas = filas.map((f, i) => (i === 1 ? { ...f, montoCentavos: f.montoCentavos - 1 } : f));
    expect(resolverReintento(guardadas(5_000), cambiadas, ahora)).toBe("otra");
    expect(resolverReintento(guardadas(60 * 60_000), filas, ahora)).toBe("otra");
    expect(resolverReintento(guardadas(5_000).slice(1), filas, ahora)).toBe("otra");
  });
});

describe("★ 8 · lo que se ve es lo que se guarda", () => {
  const reglas: ReglaConSaldo[] = [
    { sobreId: gastosDelMes, orden: 1, tipo: "fijo", valor: 45_000, topeCentavos: null, saldoCentavos: 0 },
    { sobreId: emergencia, orden: 2, tipo: "porcentaje", valor: 4_000, topeCentavos: 270_000, saldoCentavos: 0 },
    { sobreId: planes, orden: 3, tipo: "porcentaje", valor: 3_000, topeCentavos: null, saldoCentavos: 0 },
    { sobreId: inversion, orden: 4, tipo: "porcentaje", valor: 3_000, topeCentavos: null, saldoCentavos: 0 },
  ];

  it("la propuesta trae un campo por sobre, y al confirmarla se guarda tal cual", () => {
    const campos = camposDePropuesta(100_001, hoy, reglas, {});
    expect(Object.keys(campos).map(Number).sort()).toEqual([gastosDelMes, emergencia, planes, inversion].sort());
    const asignaciones = Object.entries(campos).map(([sobreId, monto]) => ({ sobreId: Number(sobreId), monto }));
    const r = guardar({ monto: "1000,01", asignaciones });
    expect(r.sinAsignar).toBe(0);
    expect(reasignaciones(r.filas).reduce((a, f) => a + f.montoCentavos, 0)).toBe(100_001);
  });

  it("guarda los montos confirmados aunque no sean los de la propuesta", () => {
    const asignaciones = tecleo([
      [gastosDelMes, "500"],
      [emergencia, "0,01"],
      [inversion, "699,99"],
    ]);
    const r = reasignaciones(guardar({ asignaciones }).filas);
    expect(r.map((f) => [f.sobreDestinoId, f.montoCentavos])).toEqual([
      [gastosDelMes, 50_000],
      [emergencia, 1],
      [inversion, 69_999],
    ]);
  });

  it.each([
    ["negativo", "-10"],
    ["con más de dos decimales", "10,555"],
  ])("un monto %s se rechaza en su campo", (_, monto) => {
    const e = errores({
      asignaciones: tecleo([
        [planes, monto],
        [inversion, "100"],
      ]),
    });
    expect(e.sobres?.[planes]).toBeDefined();
    expect(e.sobres?.[inversion]).toBeUndefined();
  });

  it("una suma mayor que el ingreso se rechaza", () => {
    const e = errores({
      asignaciones: tecleo([
        [planes, "1000"],
        [inversion, "200,01"],
      ]),
    });
    expect(e.reparto).toBeDefined();
  });

  it.each([
    ["Por asignar", porAsignar],
    ["inactivo", inactivo],
    ["que no existe", 999],
  ])("un sobre %s se rechaza en su campo", (_, sobreId) => {
    const e = errores({ asignaciones: tecleo([[sobreId, "100"]]) });
    expect(e.sobres?.[sobreId]).toBeDefined();
  });

  it("si la suma es menor, lo que queda se informa para el segundo clic", () => {
    const r = guardar({ asignaciones: tecleo([[planes, "1150"]]) });
    expect(r.sinAsignar).toBe(5_000);
  });
});

describe("★ 9 · el invariante se mantiene", () => {
  const cuentasAntes = { [binance.id]: 30_000, [prima.id]: 70_000 };
  const sobresAntes = { [porAsignar]: 10_000, [gastosDelMes]: 40_000, [planes]: 50_000 };
  const suma = (s: Record<number, number>) => Object.values(s).reduce((a, x) => a + x, 0);

  it("con todo repartido, sobres y cuentas siguen cuadrando y Por asignar queda donde estaba", () => {
    const asignaciones = tecleo([
      [gastosDelMes, "450"],
      [emergencia, "300"],
      [planes, "225"],
      [inversion, "225"],
    ]);
    const { filas, sinAsignar } = guardar({ asignaciones });
    expect(sinAsignar).toBe(0);
    const tras = saldosTras(filas, cuentasAntes, sobresAntes);
    expect(suma(tras.sobres)).toBe(suma(tras.cuentas));
    expect(suma(tras.cuentas)).toBe(suma(cuentasAntes) + 120_000);
    expect(tras.sobres[porAsignar]).toBe(10_000);
  });

  it("con algo sin repartir, cuadra igual y lo que queda está en Por asignar", () => {
    const { filas } = guardar({ asignaciones: tecleo([[planes, "1000"]]) }, prima);
    const tras = saldosTras(filas, cuentasAntes, sobresAntes);
    expect(suma(tras.sobres)).toBe(suma(tras.cuentas));
    expect(tras.sobres[porAsignar]).toBe(10_000 + 20_000);
  });
});

describe("★ 10 · repartir el saldo de Por asignar", () => {
  const saldo = 37_550;

  it("nunca se reparte más que el saldo", () => {
    const r = validarAsignaciones(
      saldo,
      tecleo([
        [planes, "300"],
        [inversion, "75,51"],
      ]),
      validos.slice(1),
    );
    expect(r.ok).toBe(false);
  });

  it("con el saldo justo se acepta, y lo que no se reparte se informa", () => {
    const todo = validarAsignaciones(
      saldo,
      tecleo([
        [planes, "300"],
        [inversion, "75,50"],
      ]),
      validos.slice(1),
    );
    expect(todo).toMatchObject({ ok: true, sinAsignar: 0 });
    const parte = validarAsignaciones(saldo, tecleo([[planes, "300"]]), validos.slice(1));
    expect(parte).toMatchObject({ ok: true, sinAsignar: 7_550 });
  });

  it("al confirmar se guardan solo reasignaciones desde Por asignar", () => {
    const filas = filasDeReparto(
      porAsignar,
      [
        { sobreId: planes, centavos: 30_000 },
        { sobreId: emergencia, centavos: 0 },
        { sobreId: inversion, centavos: 7_550 },
      ],
      hoy,
    );
    expect(filas).toHaveLength(2);
    for (const f of filas) {
      expect(f).toMatchObject({ tipo: "reasignacion", sobreOrigenId: porAsignar, cuentaDestinoId: null });
    }
    const tras = saldosTras(filas, { [binance.id]: saldo }, { [porAsignar]: saldo });
    expect(tras.sobres[porAsignar]).toBe(0);
    expect(tras.cuentas[binance.id]).toBe(saldo);
  });
});
