/**
 * Comprobación contra la base de los criterios ★ de la spec 003 que no caben en una función pura, escrita al verificar
 * desde el texto de cada criterio:
 *   ★ 1 · el total y cada porción del anillo, igual que una suma a mano en SQL, con la demo y con un mes armado;
 *   ★ 3 · Gastos solo trae gastos e Ingresos solo ingresos; transferencias y reasignaciones solo en Mover, aunque
 *         lleven categoría;
 *   ★ 4 · un gasto en bolívares suma su valor en USD, y su fila muestra los Bs y la tasa guardada;
 *   ★ 5 · los bordes de día, semana, mes y año, sobre la columna fecha y no sobre la hora en que se guardó;
 *   ★ 7 · con 250 movimientos la lista trae los 200 más recientes y los totales cuentan los 250; con 200 justos, todos.
 * Con --url, además, las páginas de un servidor en marcha con estos mismos datos (scripts/comprobar-003-paginas.ts):
 * el centro del anillo y "<1 %" (★ 1 y 2), qué filas salen en cada pestaña (★ 3), la fila en Bs (★ 4), los
 * parámetros manipulados (★ 6) y el "200 de N" (★ 7).
 *   pnpm exec tsx scripts/comprobar-003.ts                  → solo la base
 *   pnpm exec tsx scripts/comprobar-003.ts --url <origen>   → además, las páginas
 * Lo que inserta lleva la referencia "demo-comprobar-003-*", en fechas de 2023 a enero de 2026 que la demo no usa, y se
 * borra al terminar y, si una corrida se cortó, al empezar la siguiente. Nunca contra una base con datos reales: se
 * niega si encuentra movimientos que no sean de demostración.
 */
import { config } from "dotenv";
import { and, count, gte, isNull, like, lte, not, or, sql } from "drizzle-orm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { exigirBaseLocal } from "../src/lib/destino-base";
import { aTasa, bolivaresDesdeUsd, formatearCentavos, tasaDecimal } from "../src/lib/dinero";
import { distribuirPorCategoria } from "../src/lib/distribucion";
import { hoyEnCaracas } from "../src/lib/fechas";
import { type Rango, type TipoPeriodo, etiquetaPeriodo, rangoDePeriodo } from "../src/lib/periodos";
import { comprobarPaginas, texto } from "./comprobar-003-paginas";

const REFERENCIA = "demo-comprobar-003";
let fallos = 0;

function comprobar(criterio: string, descripcion: string, ok: boolean, detalle = "") {
  if (!ok) fallos++;
  console.log(`${ok ? "✓" : "✗"} ${criterio} · ${descripcion}${detalle ? ` (${detalle})` : ""}`);
}

const suma = (numeros: number[]) => numeros.reduce((a, n) => a + n, 0);
const mismos = (a: Iterable<number>, b: Iterable<number>) =>
  JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

async function main() {
  config({ path: ".env.local", quiet: true });
  // Escribe filas: solo en la base local (spec 002, criterio 10).
  exigirBaseLocal(process.env.DATABASE_URL, "comprobar-003");
  const { db, categorias, cuentas, movimientos, sobres } = await import("../src/db/index");
  const { saldosPorCuenta, saldosPorSobre } = await import("../src/db/consultas");
  const { movimientosDelPeriodo, resumenPorDia, totalesPorCategoria } =
    await import("../src/db/movimientos-del-periodo");
  const { FilaMovimiento } = await import("../src/components/movimiento");
  const posicionUrl = process.argv.indexOf("--url");
  const origen = posicionUrl > 0 ? (process.argv[posicionUrl + 1] ?? "").replace(/\/$/, "") : null;

  const nuestras = like(movimientos.referenciaExterna, `${REFERENCIA}-%`);
  // Lo que dejó una corrida cortada se borra antes de mirar.
  await db.delete(movimientos).where(nuestras);
  const [{ reales }] = await db
    .select({ reales: count() })
    .from(movimientos)
    .where(or(isNull(movimientos.referenciaExterna), not(like(movimientos.referenciaExterna, "demo-%"))));
  if (reales > 0) throw new Error(`Hay ${reales} movimientos que no son de demostración. No se toca esta base.`);
  const [{ ocupadas }] = await db
    .select({ ocupadas: count() })
    .from(movimientos)
    .where(and(gte(movimientos.fecha, "2023-01-01"), lte(movimientos.fecha, "2026-01-31")));
  if (ocupadas > 0)
    throw new Error(`Hay ${ocupadas} movimientos de 2023 a enero de 2026: hacen falta esas fechas libres.`);

  async function estado() {
    const [c, s] = await Promise.all([saldosPorCuenta(), saldosPorSobre()]);
    const [{ filas }] = await db.select({ filas: count() }).from(movimientos);
    return {
      huella: JSON.stringify([c.map((x) => [x.id, x.saldoCentavos]), s.map((x) => [x.id, x.saldoCentavos])]),
      filas,
    };
  }
  const inicial = await estado();
  const hoy = hoyEnCaracas(new Date());
  console.log(`Base local · hoy en Caracas ${hoy} · ${inicial.filas} movimientos`);

  const [todasCuentas, todosSobres, todasCategorias] = await Promise.all([
    db.select().from(cuentas),
    db.select().from(sobres),
    db.select().from(categorias),
  ]);
  function falta(que: string): never {
    throw new Error(`No existe ${que}. Corre pnpm db:seed y pnpm db:demo.`);
  }
  const cuenta = (n: string) => todasCuentas.find((c) => c.nombre === n) ?? falta(`la cuenta ${n}`);
  const sobre = (n: string) => todosSobres.find((s) => s.nombre === n) ?? falta(`el sobre ${n}`);
  const categoria = (n: string, tipo: "gasto" | "ingreso") =>
    todasCategorias.find((c) => c.nombre === n && c.tipo === tipo) ?? falta(`la categoría de ${tipo} ${n}`);
  const [binance, bolivares, efectivo] = [cuenta("Binance"), cuenta("Bolívares"), cuenta("Efectivo")];
  const [porAsignar, gastosDelMes, emergencia] = [sobre("Por asignar"), sobre("Gastos del mes"), sobre("Emergencia")];
  const [comida, transporte, servicios, salud, hogar] = ["Comida", "Transporte", "Servicios", "Salud", "Hogar"].map(
    (n) => categoria(n, "gasto"),
  );
  const [sueldo, proyecto] = [categoria("Sueldo remoto", "ingreso"), categoria("Proyecto local", "ingreso")];

  type Nuevo = typeof movimientos.$inferInsert;
  let n = 0;
  const marca = (tipo: string) => ({ origen: "importado" as const, referenciaExterna: `${REFERENCIA}-${tipo}-${++n}` });
  const gasto = (fecha: string, centavos: number, cat: { id: number }, nota: string): Nuevo => ({
    fecha,
    tipo: "gasto",
    montoCentavos: centavos,
    moneda: "USDT",
    montoUsdCentavos: centavos,
    cuentaOrigenId: binance.id,
    sobreOrigenId: gastosDelMes.id,
    categoriaId: cat.id,
    nota,
    ...marca("gas"),
  });
  const ingreso = (fecha: string, centavos: number, cat: { id: number }, nota: string): Nuevo => ({
    fecha,
    tipo: "ingreso",
    montoCentavos: centavos,
    moneda: "USDT",
    montoUsdCentavos: centavos,
    cuentaDestinoId: binance.id,
    sobreDestinoId: porAsignar.id,
    categoriaId: cat.id,
    nota,
    ...marca("ing"),
  });
  const reasignacion = (destino: { id: number }, cat: { id: number }, centavos: number, nota: string): Nuevo => ({
    fecha: "2025-03-01",
    tipo: "reasignacion",
    montoCentavos: centavos,
    moneda: "USD",
    montoUsdCentavos: centavos,
    sobreOrigenId: porAsignar.id,
    sobreDestinoId: destino.id,
    categoriaId: cat.id,
    nota,
    ...marca("rea"),
  });
  const insertar = (filas: Nuevo[]) =>
    db
      .insert(movimientos)
      .values(filas)
      .returning({ id: movimientos.id, fecha: movimientos.fecha, tipo: movimientos.tipo, nota: movimientos.nota });

  /** La suma en USD por categoría de un tipo en un rango, escrita a mano en SQL, sin las consultas de la pantalla. */
  async function aMano(tipo: "gasto" | "ingreso", rango: Rango) {
    const filas = await db.execute<{ categoria_id: number; centavos: string }>(sql`
      select categoria_id, sum(monto_usd_centavos)::text as centavos from movimientos
      where tipo = ${tipo} and fecha >= ${rango.desde} and fecha <= ${rango.hasta}
      group by categoria_id`);
    return new Map(filas.map((f) => [Number(f.categoria_id), Number(f.centavos)]));
  }
  async function idsAMano(rango: Rango) {
    const filas = await db.execute<{ id: number; tipo: string }>(
      sql`select id, tipo::text as tipo from movimientos where fecha >= ${rango.desde} and fecha <= ${rango.hasta}`,
    );
    const de = (...tipos: string[]) => filas.filter((f) => tipos.includes(f.tipo)).map((f) => Number(f.id));
    return { gastos: de("gasto"), ingresos: de("ingreso"), entreCuentasYSobres: de("transferencia", "reasignacion") };
  }
  /** Lo que la pantalla muestra de un rango: el total del anillo y cuántos movimientos cuenta. */
  async function medir(rango: Rango) {
    const [totales, dias] = await Promise.all([
      totalesPorCategoria("gastos", rango),
      resumenPorDia("gastos", rango, null),
    ]);
    return { centavos: distribuirPorCategoria(totales).total, cantidad: suma(dias.map((d) => d.cantidad)) };
  }

  try {
    // ★ 1 y 3 · con la demo: el anillo igual que SQL a mano, y cada pestaña con solo su tipo
    const periodosDemo: [TipoPeriodo, string][] = [
      ["dia", "2026-10-01"],
      ["semana", "2026-09-30"],
      ["mes", "2026-06-15"],
      ["mes", "2026-07-15"],
      ["mes", "2026-08-15"],
      ["mes", "2026-09-15"],
      ["mes", hoy],
      ["anio", hoy],
    ];
    for (const [tipo, ancla] of periodosDemo) {
      const rango = rangoDePeriodo(tipo, ancla);
      const etiqueta = etiquetaPeriodo(tipo, ancla, hoy);
      const resultados = [];
      for (const pestana of ["gastos", "ingresos"] as const) {
        const totales = await totalesPorCategoria(pestana, rango);
        const esperado = await aMano(pestana === "gastos" ? "gasto" : "ingreso", rango);
        const { total, porciones } = distribuirPorCategoria(totales);
        resultados.push({
          total,
          ok:
            total === suma([...esperado.values()]) &&
            totales.length === esperado.size &&
            totales.every((t) => esperado.get(t.categoriaId) === t.centavos) &&
            suma(porciones.map((p) => p.centavos)) === total,
        });
      }
      comprobar(
        "1",
        `${etiqueta}: el anillo de gastos y el de ingresos, categoría por categoría, igual que SQL a mano`,
        resultados.every((r) => r.ok),
        `gastos ${formatearCentavos(resultados[0].total)}, ingresos ${formatearCentavos(resultados[1].total)}`,
      );

      const [gastos, ingresos, mover] = await Promise.all(
        (["gastos", "ingresos", "mover"] as const).map((p) => movimientosDelPeriodo(p, rango, null)),
      );
      const ids = await idsAMano(rango);
      const enMover = new Set(mover.map((m) => m.id));
      const fuera = new Set([...gastos, ...ingresos].map((m) => m.id));
      comprobar(
        "3",
        `${etiqueta}: Gastos solo gastos, Ingresos solo ingresos, y las transferencias y reasignaciones solo en Mover`,
        gastos.every((m) => m.tipo === "gasto") &&
          ingresos.every((m) => m.tipo === "ingreso") &&
          mover.every((m) => m.tipo !== "gasto" && m.tipo !== "ingreso") &&
          mismos(
            gastos.map((m) => m.id),
            ids.gastos,
          ) &&
          mismos(
            ingresos.map((m) => m.id),
            ids.ingresos,
          ) &&
          ids.entreCuentasYSobres.every((id) => enMover.has(id) && !fuera.has(id)),
        `${gastos.length} gastos, ${ingresos.length} ingresos, ${ids.entreCuentasYSobres.length} entre cuentas y sobres`,
      );
    }

    // ★ 1, 3 y 4 · marzo de 2025, armado: gastos, uno en bolívares, ingresos, y transferencias y reasignaciones con
    // categoría (el check de forma lo permite), para que solo su tipo las deje fuera del anillo.
    const tasa = aTasa("236.5");
    const bs = bolivaresDesdeUsd(5_00, tasa);
    comprobar("4", "5,00 USD a 236,50 son 1.182,50 Bs", bs === 1_182_50, `${bs}`);
    const marzo: Nuevo[] = [
      gasto("2025-03-10", 125_00, comida, "c003 mercado"),
      gasto("2025-03-11", 91_12, transporte, "c003 gasolina"),
      gasto("2025-03-12", 85_30, servicios, "c003 internet"),
      gasto("2025-03-13", 1, salud, "c003 curita"),
      gasto("2025-03-20", 3_33, comida, "c003 café"),
      {
        ...gasto("2025-03-14", bs, hogar, "c003 ferretería en Bs"),
        moneda: "VES",
        montoUsdCentavos: 5_00,
        tasa: tasaDecimal(tasa),
        cuentaOrigenId: bolivares.id,
      },
      ingreso("2025-03-01", 1_200_00, sueldo, "c003 sueldo"),
      ingreso("2025-03-20", 300_00, proyecto, "c003 proyecto"),
      {
        fecha: "2025-03-14",
        tipo: "transferencia",
        montoCentavos: 5_00,
        moneda: "USDT",
        montoUsdCentavos: 5_00,
        montoDestinoCentavos: bs,
        monedaDestino: "VES",
        tasa: tasaDecimal(tasa),
        cuentaOrigenId: binance.id,
        cuentaDestinoId: bolivares.id,
        categoriaId: comida.id,
        nota: "c003 cambio a Bs",
        ...marca("tra"),
      },
      {
        fecha: "2025-03-05",
        tipo: "transferencia",
        montoCentavos: 100_00,
        moneda: "USDT",
        montoUsdCentavos: 100_00,
        montoDestinoCentavos: 100_00,
        monedaDestino: "USD",
        cuentaOrigenId: binance.id,
        cuentaDestinoId: efectivo.id,
        categoriaId: sueldo.id,
        nota: "c003 a efectivo",
        ...marca("tra"),
      },
      reasignacion(gastosDelMes, comida, 450_00, "c003 reparto a gastos"),
      reasignacion(emergencia, sueldo, 200_00, "c003 reparto a emergencia"),
    ];
    const insertadosMarzo = await insertar(marzo);
    const rangoMarzo = rangoDePeriodo("mes", "2025-03-31");
    const idsDe = (...tipos: string[]) => insertadosMarzo.filter((f) => tipos.includes(f.tipo)).map((f) => f.id);
    const esperadoPorCategoria = (tipo: "gasto" | "ingreso") => {
      const m = new Map<number, number>();
      for (const f of marzo.filter((x) => x.tipo === tipo)) {
        m.set(f.categoriaId ?? 0, (m.get(f.categoriaId ?? 0) ?? 0) + f.montoUsdCentavos);
      }
      return m;
    };
    const gastosMarzo = esperadoPorCategoria("gasto");
    for (const pestana of ["gastos", "ingresos"] as const) {
      const esperado = esperadoPorCategoria(pestana === "gastos" ? "gasto" : "ingreso");
      const totales = await totalesPorCategoria(pestana, rangoMarzo);
      const { total, porciones } = distribuirPorCategoria(totales);
      const totalEsperado = suma([...esperado.values()]);
      comprobar(
        "1",
        `marzo de 2025, ${pestana}: el centro es la suma exacta y cada porción la de su categoría`,
        total === totalEsperado &&
          totales.length === esperado.size &&
          totales.every((t) => esperado.get(t.categoriaId) === t.centavos) &&
          suma(porciones.map((p) => p.centavos)) === total,
        `${formatearCentavos(total)}; esperado ${formatearCentavos(totalEsperado)}`,
      );
      const dias = await resumenPorDia(pestana, rangoMarzo, null);
      comprobar(
        "1",
        `marzo de 2025, ${pestana}: la suma por día da el mismo total`,
        suma(dias.map((d) => d.centavos)) === totalEsperado,
      );
    }
    comprobar(
      "3",
      "la transferencia y la reasignación con categoría Comida no suman a Comida (128,33, no 583,33 ni 133,33)",
      gastosMarzo.get(comida.id) === 128_33 &&
        (await totalesPorCategoria("gastos", rangoMarzo)).find((t) => t.categoriaId === comida.id)?.centavos === 128_33,
    );
    comprobar(
      "3",
      "ni las de categoría Sueldo remoto a Ingresos (1.200,00, no 1.500,00 ni 1.400,00)",
      (await totalesPorCategoria("ingresos", rangoMarzo)).find((t) => t.categoriaId === sueldo.id)?.centavos ===
        1_200_00,
    );
    const [listaGastos, listaIngresos, listaMover] = await Promise.all(
      (["gastos", "ingresos", "mover"] as const).map((p) => movimientosDelPeriodo(p, rangoMarzo, null)),
    );
    comprobar(
      "3",
      "marzo de 2025: Gastos lista los 6 gastos, Ingresos los 2 ingresos y Mover las 2 transferencias y las 2 reasignaciones",
      mismos(
        listaGastos.map((m) => m.id),
        idsDe("gasto"),
      ) &&
        mismos(
          listaIngresos.map((m) => m.id),
          idsDe("ingreso"),
        ) &&
        mismos(
          listaMover.map((m) => m.id),
          idsDe("transferencia", "reasignacion"),
        ),
      `${listaGastos.length}, ${listaIngresos.length} y ${listaMover.length}`,
    );
    const filtradaComida = await movimientosDelPeriodo("gastos", rangoMarzo, comida.id);
    comprobar(
      "3",
      "filtrar Gastos por Comida trae sus 2 gastos, no la transferencia ni la reasignación que llevan Comida",
      mismos(
        filtradaComida.map((m) => m.id),
        insertadosMarzo.filter((f) => f.nota === "c003 mercado" || f.nota === "c003 café").map((f) => f.id),
      ),
      `${filtradaComida.length} filas`,
    );

    comprobar(
      "4",
      "el gasto en bolívares suma al anillo sus 5,00 USD, no los 1.182,50 Bs",
      gastosMarzo.get(hogar.id) === 5_00 &&
        (await totalesPorCategoria("gastos", rangoMarzo)).find((t) => t.categoriaId === hogar.id)?.centavos === 5_00,
    );
    const diaBs = (await resumenPorDia("gastos", rangoMarzo, null)).find((d) => d.fecha === "2025-03-14");
    comprobar(
      "4",
      "y al total de su día, 5,00 USD (el cambio a Bs de ese día va a Mover)",
      diaBs?.centavos === 5_00 && diaBs.cantidad === 1,
    );
    const filaBs = listaGastos.find((m) => m.nota === "c003 ferretería en Bs");
    const textoFila = filaBs ? texto(renderToStaticMarkup(createElement(FilaMovimiento, { m: filaBs }))) : "";
    comprobar(
      "4",
      "su fila trae 1.182,50 Bs con la tasa guardada, 236,5000, y muestra −5,00 USD, 1.182,50 Bs y 236,50 Bs/USD",
      filaBs?.moneda === "VES" &&
        filaBs.montoCentavos === 1_182_50 &&
        filaBs.montoUsdCentavos === 5_00 &&
        filaBs.tasa === "236.5000" &&
        textoFila.includes("−5,00USD") &&
        textoFila.includes("1.182,50 Bs · 236,50 Bs/USD"),
      textoFila,
    );

    // ★ 5 · bordes: un gasto en cada borde, con montos que son potencias de 2 para saber cuáles se contaron.
    const bordes: [string, number][] = [
      "2023-12-31",
      "2024-01-01",
      "2024-01-31",
      "2024-02-01",
      "2024-02-29",
      "2024-03-01",
      "2024-12-31",
      "2025-01-01",
      "2025-10-26",
      "2025-10-27",
      "2025-10-31",
      "2025-11-01",
      "2025-11-02",
      "2025-11-03",
      "2025-12-29",
      "2026-01-04",
      "2026-01-05",
    ].map((fecha, i) => [fecha, 2 ** i]);
    const montoDe = new Map(bordes);
    const semanaDel31 = ["2025-10-27", "2025-10-31", "2025-11-01", "2025-11-02"];
    const casos: [string, TipoPeriodo, string, string[]][] = [
      ["Día 31 de octubre de 2025", "dia", "2025-10-31", ["2025-10-31"]],
      ["Día 1 de noviembre de 2025", "dia", "2025-11-01", ["2025-11-01"]],
      ["Semana del viernes 31 de octubre: del lunes 27 al domingo 2", "semana", "2025-10-31", semanaDel31],
      ["la misma semana, vista desde su domingo", "semana", "2025-11-02", semanaDel31],
      ["Semana del domingo 26 de octubre: la anterior", "semana", "2025-10-26", ["2025-10-26"]],
      ["Semana que cruza el año: 29 de diciembre a 4 de enero", "semana", "2026-01-01", ["2025-12-29", "2026-01-04"]],
      ["Octubre de 2025", "mes", "2025-10-15", ["2025-10-26", "2025-10-27", "2025-10-31"]],
      ["Noviembre de 2025", "mes", "2025-11-15", ["2025-11-01", "2025-11-02", "2025-11-03"]],
      ["Enero de 2024", "mes", "2024-01-15", ["2024-01-01", "2024-01-31"]],
      ["Febrero de 2024, bisiesto", "mes", "2024-02-10", ["2024-02-01", "2024-02-29"]],
      ["Año 2023", "anio", "2023-06-15", ["2023-12-31"]],
      [
        "Año 2024",
        "anio",
        "2024-06-15",
        ["2024-01-01", "2024-01-31", "2024-02-01", "2024-02-29", "2024-03-01", "2024-12-31"],
      ],
      [
        "Año 2025",
        "anio",
        "2025-06-15",
        [
          "2025-01-01",
          "2025-10-26",
          "2025-10-27",
          "2025-10-31",
          "2025-11-01",
          "2025-11-02",
          "2025-11-03",
          "2025-12-29",
        ],
      ],
      ["Año 2026", "anio", "2026-06-15", ["2026-01-04", "2026-01-05"]],
    ];
    const antes = await Promise.all(casos.map(([, tipo, ancla]) => medir(rangoDePeriodo(tipo, ancla))));
    // El del 31 se guarda a las 22:30 de Caracas, que ya es el 1 de noviembre en UTC: cuenta la fecha, no la hora.
    const insertadosBordes = await insertar(
      bordes.map(([fecha, centavos]) => ({
        ...gasto(fecha, centavos, comida, `c003 borde ${fecha}`),
        ...(fecha === "2025-10-31" ? { creadoEn: new Date("2025-11-01T02:30:00Z") } : {}),
      })),
    );
    for (const [i, [nombre, tipo, ancla, fechas]] of casos.entries()) {
      const rango = rangoDePeriodo(tipo, ancla);
      const despues = await medir(rango);
      const delta = despues.centavos - antes[i].centavos;
      const esperado = suma(fechas.map((f) => montoDe.get(f) ?? NaN));
      comprobar(
        "5",
        `${nombre}: cuenta justo los bordes de dentro`,
        delta === esperado && despues.cantidad - antes[i].cantidad === fechas.length,
        `${rango.desde} a ${rango.hasta}`,
      );
    }
    const del31 = insertadosBordes.find((f) => f.fecha === "2025-10-31")?.id;
    const esta = async (tipo: TipoPeriodo, ancla: string) =>
      (await movimientosDelPeriodo("gastos", rangoDePeriodo(tipo, ancla), null)).some((m) => m.id === del31);
    comprobar(
      "5",
      "el gasto del 31 de octubre de 2025, guardado el 1 de noviembre en UTC, sale en octubre y en su semana, nunca en noviembre",
      (await esta("mes", "2025-10-01")) && (await esta("semana", "2025-10-27")) && !(await esta("mes", "2025-11-30")),
    );

    // ★ 7 · lista larga: 250 gastos en junio de 2025 y 200 justos en julio, intercalados por día.
    const junio = Array.from({ length: 250 }, (_, i) =>
      gasto(
        `2025-06-${String(1 + (i % 30)).padStart(2, "0")}`,
        1_00 + i,
        [comida, transporte, servicios][i % 3],
        `c003 lista ${i}`,
      ),
    );
    const julio = Array.from({ length: 200 }, (_, i) =>
      gasto(`2025-07-${String(1 + (i % 31)).padStart(2, "0")}`, 1_00 + i, comida, `c003 justa ${i}`),
    );
    const insertadosJunio = await insertar(junio);
    await insertar(julio);
    const rangoJunio = rangoDePeriodo("mes", "2025-06-30");
    const listaJunio = await movimientosDelPeriodo("gastos", rangoJunio, null, 200);
    const recientes = [...insertadosJunio]
      .sort((a, b) => (a.fecha === b.fecha ? b.id - a.id : a.fecha < b.fecha ? 1 : -1))
      .slice(0, 200)
      .map((f) => f.id);
    comprobar(
      "7",
      "con 250 en junio de 2025, la lista trae 200, los más recientes, en orden",
      JSON.stringify(listaJunio.map((m) => m.id)) === JSON.stringify(recientes),
      `${listaJunio.length} filas, la más vieja del ${listaJunio.at(-1)?.fecha}`,
    );
    const diasJunio = await resumenPorDia("gastos", rangoJunio, null);
    const totalJunio = suma(junio.map((f) => f.montoUsdCentavos));
    comprobar(
      "7",
      'y el resumen por día cuenta los 250, para decir "200 de 250"',
      suma(diasJunio.map((d) => d.cantidad)) === 250,
      `${suma(diasJunio.map((d) => d.cantidad))}`,
    );
    const totalesJunio = await totalesPorCategoria("gastos", rangoJunio);
    comprobar(
      "7",
      "el anillo cuenta los 250 (561,25 USD), y cada categoría los suyos",
      distribuirPorCategoria(totalesJunio).total === totalJunio &&
        totalJunio === 561_25 &&
        [comida, transporte, servicios].every(
          (c, k) =>
            totalesJunio.find((t) => t.categoriaId === c.id)?.centavos ===
            suma(junio.filter((_, i) => i % 3 === k).map((f) => f.montoUsdCentavos)),
        ),
      formatearCentavos(distribuirPorCategoria(totalesJunio).total),
    );
    comprobar(
      "7",
      "el total de cada día es exacto también en los días que la lista dejó fuera",
      diasJunio.length === 30 &&
        diasJunio.every(
          (d) => d.centavos === suma(junio.filter((f) => f.fecha === d.fecha).map((f) => f.montoUsdCentavos)),
        ) &&
        diasJunio.some((d) => d.fecha < (listaJunio.at(-1)?.fecha ?? "")),
    );
    const rangoJulio = rangoDePeriodo("mes", "2025-07-31");
    const listaJulio = await movimientosDelPeriodo("gastos", rangoJulio, null, 200);
    const diasJulio = await resumenPorDia("gastos", rangoJulio, null);
    comprobar(
      "7",
      'con 200 justos en julio de 2025 no hay corte: la lista trae los 200 y N es 200, sin "200 de N"',
      listaJulio.length === 200 && suma(diasJulio.map((d) => d.cantidad)) === 200,
    );

    if (origen) {
      const notas = (...tipos: string[]) => marzo.filter((f) => tipos.includes(f.tipo)).map((f) => f.nota ?? "");
      await comprobarPaginas(
        origen,
        {
          hoy,
          notas: { gastos: notas("gasto"), ingresos: notas("ingreso"), mover: notas("transferencia", "reasignacion") },
          categoriasMarzo: [...gastosMarzo].map(([id, centavos]) => ({
            nombre: todasCategorias.find((c) => c.id === id)?.nombre ?? "?",
            centavos,
          })),
          totalIngresosMarzo: suma([...esperadoPorCategoria("ingreso").values()]),
          totalJunio,
          comidaId: comida.id,
          sueldoId: sueldo.id,
        },
        comprobar,
      );
    }
  } finally {
    await db.delete(movimientos).where(nuestras);
    const final = await estado();
    comprobar(
      "—",
      "la base queda como estaba: mismos saldos y movimientos",
      final.huella === inicial.huella && final.filas === inicial.filas,
      `${final.filas} movimientos`,
    );
  }
}

main()
  .then(() => {
    console.log(fallos === 0 ? "✓ comprobar-003: todo en verde" : `✗ comprobar-003: ${fallos} comprobaciones fallaron`);
    process.exit(fallos === 0 ? 0 : 1);
  })
  .catch((error) => {
    console.error("✗ comprobar-003:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
