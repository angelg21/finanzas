/**
 * Spec 012: el historial de Gestor de Gastos, leído de su .xlsx y convertido en movimientos de la app. Lo que no se
 * puede leer sin adivinar es un error; lo que ya está en la app o se pidió omitir, se salta con su motivo.
 */
import { describe, expect, it } from "vitest";
import { type ContextoDeImportacion, type Mapeo, planDeImportacion } from "./importacion";
import { type Celda, type Hojas, leerExportacion } from "./leer-exportacion";
import { mapeoGestorDeGastos } from "./mapeo-gestor-de-gastos";

const hoy = "2026-11-09";
const n = (numero: string) => ({ numero });
const cabecera = [
  "Fecha y hora",
  "Categoría",
  "Cuenta",
  "Cantidad en la divisa predeterminada",
  "Divisa predeterminada",
  "Cantidad en la divisa de la cuenta",
  "Divisa de la cuenta",
  "Cantidad de la transacción en la divisa de la transacción",
  "Divisa de la transacción",
  "Etiquetas",
  "Comentario",
];
const cabeceraTransferencias = [
  "Fecha y hora",
  "Saliente",
  "Entrante",
  "Cantidad en divisa saliente",
  "Divisa saliente",
  "Cantidad en divisa entrante",
  "Divisa entrante",
  "Comentario",
];
const fila = (
  serial: string,
  categoria: string,
  cuenta: string,
  usd: string,
  nota = "",
  etiqueta = "",
  enCuenta = usd,
  divisa = "USD",
): Celda[] => [n(serial), categoria, cuenta, n(usd), "USD", n(enCuenta), divisa, "", "", etiqueta, nota];
const hojas = (gastos: Celda[][], ingresos: Celda[][] = [], transferencias: Celda[][] = []): Hojas => ({
  Gastos: [["Lista de gastos"], cabecera, ...gastos],
  Ingresos: [["Lista de ingresos"], cabecera, ...ingresos],
  Transferencias: [["Lista de transferencias"], cabeceraTransferencias, ...transferencias],
});

const contexto = (cambios: Partial<ContextoDeImportacion> = {}): ContextoDeImportacion => ({
  cuentas: [
    { nombre: "Binance", moneda: "USDT" },
    { nombre: "Cuenta prima", moneda: "USD" },
    { nombre: "Bolívares", moneda: "VES" },
  ],
  categorias: [
    { nombre: "Comida Fuera", tipo: "gasto" },
    { nombre: "Hogar", tipo: "gasto" },
    { nombre: "Sueldo remoto", tipo: "ingreso" },
  ],
  etiquetas: [{ nombre: "SAX" }],
  yaAnotados: [],
  ...cambios,
});

const plan = (h: Hojas, c = contexto(), mapeo: Mapeo = mapeoGestorDeGastos) => {
  const leidas = leerExportacion(h, hoy);
  expect(leidas.errores).toEqual([]);
  return planDeImportacion(leidas.filas, c, mapeo);
};

describe("leerExportacion", () => {
  it("lee las tres hojas: la fecha desde el número de Excel, los montos en centavos y la nota", () => {
    const { filas, errores } = leerExportacion(
      hojas(
        [
          fila("46308.0", "Comida en la calle", "Binance", "18.0", "Shawuarma"),
          fila("45907.0", "Comida en la calle", "Banco de Venezuela", "9.65", "Pizza", "", "1482.0", "VES"),
        ],
        [fila("46295.0", "Salario", "Zelle", "1215.0", " Primer pago ", "SAX")],
        [[n("45973.0"), "Binance", "Zinli", n("10.0"), "USD", "", "", "Curso"]],
      ),
      hoy,
    );
    expect(errores).toEqual([]);
    expect(filas).toEqual([
      {
        hoja: "gastos",
        fila: 3,
        fecha: "2026-10-13",
        cuenta: "Binance",
        destino: null,
        categoria: "Comida en la calle",
        centavosUsd: 1800,
        monedaCuenta: "USD",
        centavosCuenta: 1800,
        centavosDestino: null,
        etiqueta: null,
        nota: "Shawuarma",
      },
      expect.objectContaining({
        fila: 4,
        fecha: "2025-09-07",
        centavosUsd: 965,
        monedaCuenta: "VES",
        centavosCuenta: 148200,
      }),
      expect.objectContaining({
        hoja: "ingresos",
        fecha: "2026-09-30",
        centavosUsd: 121500,
        etiqueta: "SAX",
        nota: "Primer pago",
      }),
      expect.objectContaining({
        hoja: "transferencias",
        fecha: "2025-11-12",
        cuenta: "Binance",
        destino: "Zinli",
        categoria: null,
        centavosUsd: 1000,
        centavosDestino: null,
        nota: "Curso",
      }),
    ]);
  });

  it("rechaza lo que no se lee sin adivinar: otra cabecera, fracciones de centavo, fechas futuras u otra divisa", () => {
    const otraCabecera = hojas([]);
    otraCabecera.Gastos[1] = ["Fecha", ...cabecera.slice(1)];
    expect(leerExportacion(otraCabecera, hoy).errores).toEqual([expect.stringContaining("Gastos")]);

    const { errores } = leerExportacion(
      hojas([
        fila("46308.0", "Salidas", "Binance", "67.333"),
        fila("46400.0", "Salidas", "Binance", "1.0"),
        [n("46308.0"), "Salidas", "Binance", n("5.0"), "EUR", n("5.0"), "EUR", "", "", "", ""],
        fila("46308.0", "Salidas", "Binance", "0.0"),
      ]),
      hoy,
    );
    expect(errores).toEqual([
      expect.stringMatching(/Gastos, fila 3.*monto/),
      expect.stringMatching(/Gastos, fila 4.*fecha/),
      expect.stringMatching(/Gastos, fila 5.*divisa/),
      expect.stringMatching(/Gastos, fila 6.*monto/),
    ]);
  });
});

describe("planDeImportacion", () => {
  it("cada cuenta vieja va a su equivalente y en su moneda; Zinli se crea", () => {
    const p = plan(
      hojas([
        fila("46294.0", "Hogar", "Ahorro Earn", "65.0"),
        fila("46293.0", "Hogar", "Zelle", "11.6"),
        fila("45907.0", "Hogar", "Banco de Venezuela", "9.65", "", "", "1482.0", "VES"),
        fila("46292.0", "Hogar", "Zinli", "3.0"),
      ]),
    );
    expect(p.errores).toEqual([]);
    expect(p.movimientos.map((m) => [m.tipo, m.cuenta, m.moneda, m.montoCentavos, m.montoUsdCentavos])).toEqual([
      ["gasto", "Binance", "USDT", 6500, 6500],
      ["gasto", "Cuenta prima", "USD", 1160, 1160],
      ["gasto", "Bolívares", "VES", 148200, 965],
      ["gasto", "Zinli", "USD", 300, 300],
    ]);
    expect(p.crear.cuentas).toEqual([{ nombre: "Zinli", moneda: "USD", tipo: "billetera" }]);
  });

  it("las categorías van a la que ya existe sin importar mayúsculas ni acentos; las que faltan se crean una vez", () => {
    const p = plan(
      hojas(
        [
          fila("46308.0", "Comida en la calle", "Binance", "18.0"),
          fila("46307.0", "Casa", "Binance", "7.68"),
          fila("46306.0", "Salidas", "Binance", "59.0"),
          fila("46305.0", "Inversion", "Binance", "49.15", "Claude code"),
          fila("46304.0", "Suscripción", "Binance", "3.5"),
        ],
        [fila("46295.0", "Salario", "Binance", "400.0", "Pago de kumia", "KumIA")],
      ),
    );
    expect(p.movimientos.map((m) => m.categoria)).toEqual([
      "Comida Fuera",
      "Hogar",
      "Salidas",
      "Suscripción",
      "Suscripción",
      "Sueldo remoto",
    ]);
    expect(p.crear.categorias).toEqual([
      { nombre: "Salidas", tipo: "gasto", icono: "cerveza", color: "ambar" },
      { nombre: "Suscripción", tipo: "gasto", icono: "suscripcion", color: "turquesa" },
    ]);
  });

  it("no trae dos veces lo que ya está en la app ni lo que se pidió omitir, y dice por qué", () => {
    const p = plan(
      hojas(
        [
          fila("46299.0", "Daniela", "Binance", "125.0", "Boleto de Dani"),
          fila("46295.0", "Salidas", "Binance", "1215.0", "Mismo día y monto, pero es un gasto"),
        ],
        [fila("46295.0", "Salario", "Zelle", "1215.0", "Primer pago", "SAX")],
      ),
      contexto({ yaAnotados: [{ fecha: "2026-09-30", tipo: "ingreso", centavosUsd: 121500, nota: "Sueldo SAX" }] }),
    );
    expect(p.omitidas).toEqual([
      expect.objectContaining({ hoja: "gastos", fila: 3, motivo: expect.stringContaining("préstamo") }),
      expect.objectContaining({ hoja: "ingresos", fila: 3, motivo: "Ya está en la app: «Sueldo SAX»" }),
    ]);
    expect(p.movimientos.map((m) => m.nota)).toEqual(["Mismo día y monto, pero es un gasto"]);
  });

  it("cada fila tiene una referencia estable, distinta aunque dos filas sean iguales, y omitir no las corre", () => {
    const h = hojas([
      fila("46299.0", "Daniela", "Binance", "125.0"),
      fila("46298.0", "Salidas", "Binance", "32.12"),
      fila("46298.0", "Salidas", "Binance", "32.12"),
    ]);
    const p = plan(h);
    expect(p.movimientos.map((m) => m.referencia)).toEqual([
      "historial-gastos-2026-10-03-3212-1",
      "historial-gastos-2026-10-03-3212-2",
    ]);
    expect(plan(h).movimientos).toEqual(p.movimientos);
  });

  it("una transferencia entre monedas guarda lo recibido; entre lo que aquí es la misma cuenta, se omite", () => {
    const p = plan(
      hojas(
        [],
        [],
        [
          [n("45973.0"), "Binance", "Zinli", n("10.0"), "USD", "", "", "Curso"],
          [n("45970.0"), "Binance", "Ahorro Earn", n("50.0"), "USD", "", "", ""],
        ],
      ),
    );
    expect(p.movimientos).toEqual([
      expect.objectContaining({
        tipo: "transferencia",
        cuenta: "Binance",
        destino: "Zinli",
        montoCentavos: 1000,
        moneda: "USDT",
        montoUsdCentavos: 1000,
        montoDestinoCentavos: 1000,
        monedaDestino: "USD",
      }),
    ]);
    expect(p.omitidas).toEqual([
      expect.objectContaining({ hoja: "transferencias", motivo: expect.stringContaining("misma cuenta") }),
    ]);
  });

  it("la etiqueta que ya existe se usa con su nombre; la nueva se crea", () => {
    const p = plan(
      hojas(
        [],
        [
          fila("46245.0", "Pago", "Binance", "450.0", "", "sax"),
          fila("46240.0", "Salario", "Binance", "400.0", "", "KumIA"),
          fila("46207.0", "Salario", "Binance", "400.0", "", "KumIA"),
        ],
      ),
    );
    expect(p.movimientos.map((m) => m.etiqueta)).toEqual(["SAX", "KumIA", "KumIA"]);
    expect(p.crear.etiquetas).toEqual(["KumIA"]);
  });

  it("una cuenta sin equivalente es un error: no se adivina", () => {
    const p = plan(hojas([fila("46308.0", "Salidas", "Mercantil", "5.0")]));
    expect(p.errores).toEqual([expect.stringContaining("Mercantil")]);
  });
});
