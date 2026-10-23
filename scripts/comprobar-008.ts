/**
 * Los criterios ★ de la spec 008 contra la base, escritos desde su texto al verificar:
 *   ★ 1 · "SAX", "sax", " Sax " y "Sáx" son la misma etiqueta: crearla con otra grafía usa la existente, también si
 *         seis pestañas la crean a la vez; el índice único de la clave rechaza una segunda fila;
 *   ★ 4 · la base no admite una etiqueta en otro tipo de movimiento; la venta de USDT de un gasto y el reparto de un
 *         ingreso no la llevan, tampoco al editar;
 *   ★ 5 · en Gastos e Ingresos, las etiquetas del periodo con su total; filtrar por una deja la lista y el total de
 *         arriba solo con lo suyo, y se combina con la categoría; el anillo sigue siendo el del periodo;
 *   6   · cada fila trae el nombre de su etiqueta.
 * Los ★ 2, 3 y 7 (elegir, crear ahí mismo y que sin etiqueta no haya ninguna consulta) los prueba
 * src/app/(con-sesion)/etiqueta-del-formulario.criterios.test.ts, y que un `?etiqueta=` malo no filtre ni rompa la
 * página, src/lib/etiquetas.test.ts y `pnpm humo`.
 * Corre sobre la base local con los datos de demostración y la deja como estaba:
 *   pnpm exec tsx scripts/comprobar-008.ts
 * Lo suyo son capturas cuyo id empieza por 0c080008 y etiquetas cuyo nombre empieza por "demo-c008", que se borran al
 * terminar y, si una corrida se cortó, al empezar la siguiente. Se niega ante movimientos que no sean de demostración.
 */
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { count, eq, isNull, like, not, or } from "drizzle-orm";
import { referenciaDeCaptura, referenciaDeReasignacion } from "../src/lib/captura";
import { exigirBaseLocal } from "../src/lib/destino-base";
import { planDeEdicionDeGasto } from "../src/lib/editar-gasto";
import { type EtiquetaPedida, nombreDeEtiqueta } from "../src/lib/etiquetas";
import { hoyEnCaracas } from "../src/lib/fechas";
import { type EntradaGasto, prepararGasto } from "../src/lib/gastos";
import { prepararIngreso } from "../src/lib/ingresos";
import { rangoDePeriodo } from "../src/lib/periodos";

const MARCA = "0c080008";
const PREFIJO = "demo-c008";
let fallos = 0;

function comprobar(criterio: string, descripcion: string, ok: boolean, detalle = "") {
  if (!ok) fallos++;
  console.log(`${ok ? "✓" : "✗"} ${criterio} · ${descripcion}${detalle ? ` (${detalle})` : ""}`);
}

const idDePrueba = () => `${MARCA}${randomUUID().slice(8)}`;

/** El código de Postgres de un error de drizzle, o "ninguno" si no lanzó. */
async function codigoDe(f: () => Promise<unknown>) {
  try {
    await f();
    return "ninguno";
  } catch (error) {
    return (error as { cause?: { code?: string } }).cause?.code ?? "otro";
  }
}

async function main() {
  config({ path: ".env.local" });
  // Escribe filas: solo en la base local (spec 002, criterio 10).
  exigirBaseLocal(process.env.DATABASE_URL, "comprobar-008");
  const { db, etiquetas, movimientos } = await import("../src/db/index");
  const { categoriasDeGastoPorUso, saldosPorCuenta, saldosPorSobre } = await import("../src/db/consultas");
  const { categoriasDeIngresoPorUso } = await import("../src/db/reparto");
  const { registrarCaptura, registrarMovimientos } = await import("../src/db/movimientos");
  const { buscarOCrearEtiqueta } = await import("../src/db/etiquetas");
  const { editarGasto } = await import("../src/db/editar-movimientos");
  const { etiquetasDelPeriodo, movimientosDelPeriodo, resumenPorDia, totalesPorCategoria } =
    await import("../src/db/movimientos-del-periodo");

  const clavePrefijo = nombreDeEtiqueta(PREFIJO);
  if (!clavePrefijo.ok) throw new Error("Prefijo inválido");
  async function limpiar() {
    await db.delete(movimientos).where(like(movimientos.referenciaExterna, `captura-${MARCA}-%`));
    await db.delete(etiquetas).where(like(etiquetas.clave, `${clavePrefijo.ok ? clavePrefijo.clave : PREFIJO}%`));
  }
  await limpiar();
  const [{ reales }] = await db
    .select({ reales: count() })
    .from(movimientos)
    .where(or(isNull(movimientos.referenciaExterna), not(like(movimientos.referenciaExterna, "demo-%"))));
  if (reales > 0) throw new Error(`Hay ${reales} movimientos que no son de demostración. No se toca esta base.`);

  async function estado() {
    const [c, s, [{ filas }], [{ cuantas }]] = await Promise.all([
      saldosPorCuenta(),
      saldosPorSobre(),
      db.select({ filas: count() }).from(movimientos),
      db.select({ cuantas: count() }).from(etiquetas),
    ]);
    const totalCuentas = c.reduce((a, x) => a + x.saldoUsdCentavos, 0);
    const totalSobres = s.reduce((a, x) => a + x.saldoCentavos, 0);
    const huella = JSON.stringify([c.map((x) => [x.id, x.saldoCentavos]), s.map((x) => [x.id, x.saldoCentavos])]);
    return { cuentas: c, sobres: s, filas, cuantas, cuadra: totalCuentas === totalSobres, huella };
  }
  const inicial = await estado();
  const hoy = hoyEnCaracas(new Date());
  const mes = rangoDePeriodo("mes", hoy);
  const binance = inicial.cuentas.find((c) => c.nombre === "Binance");
  const prima = inicial.cuentas.find((c) => c.nombre === "Cuenta prima");
  const bolivares = inicial.cuentas.find((c) => c.moneda === "VES");
  const porAsignar = inicial.sobres.find((s) => s.tipo === "por_asignar");
  const gastosDelMes = inicial.sobres.find((s) => s.tipo === "gastos");
  const planes = inicial.sobres.find((s) => s.nombre === "Planes");
  const [catA, catB] = await categoriasDeGastoPorUso();
  const [sueldo] = await categoriasDeIngresoPorUso();
  if (!binance || !prima || !bolivares || !porAsignar || !gastosDelMes || !planes || !catB || !sueldo) {
    throw new Error("Faltan datos base: corre pnpm db:seed y pnpm db:demo");
  }
  const validos = inicial.sobres.filter((s) => s.tipo !== "por_asignar").map((s) => s.id);
  console.log(`Base local · hoy en Caracas ${hoy} · ${inicial.filas} movimientos · ${inicial.cuantas} etiquetas`);

  function entradaGasto(cambios: Partial<EntradaGasto> = {}): EntradaGasto {
    return {
      forma: "dolares",
      monto: "10",
      tasa: "",
      vendido: "",
      cuentaOrigen: { id: prima!.id, moneda: prima!.moneda },
      cuentaBolivares: { id: bolivares!.id, moneda: "VES" },
      sobreId: gastosDelMes!.id,
      categoriaId: catA.id,
      fecha: hoy,
      nota: "comprobar-008",
      ...cambios,
    };
  }
  /** Un gasto como lo guarda la captura: la etiqueta pedida va a registrarCaptura, que la pone solo en el gasto. */
  async function gasto(etiqueta: EtiquetaPedida, cambios: Partial<EntradaGasto> = {}, captura = idDePrueba()) {
    const p = prepararGasto(entradaGasto(cambios), hoy);
    if (!p.ok) throw new Error(`prepararGasto rechazó: ${JSON.stringify(p.errores)}`);
    const r = await registrarCaptura(
      captura,
      p.filas.map((f) => ({
        ...f,
        referenciaExterna: referenciaDeCaptura(captura, f.tipo === "transferencia" ? "transferencia" : "gasto"),
      })),
      etiqueta,
    );
    return { captura, nueva: r.nueva };
  }
  /** Un ingreso como lo guarda su captura: la etiqueta pedida va en el ingreso, no en el reparto. */
  async function ingreso(etiqueta: EtiquetaPedida, monto: string, aPlanes: string) {
    const captura = idDePrueba();
    const p = prepararIngreso(
      {
        monto,
        fecha: hoy,
        nota: "comprobar-008",
        categoriaId: sueldo.id,
        porAsignarId: porAsignar!.id,
        sobresValidos: validos,
        asignaciones: [{ sobreId: planes!.id, monto: aPlanes }],
      },
      hoy,
      { id: prima!.id, moneda: prima!.moneda },
    );
    if (!p.ok) throw new Error(`prepararIngreso rechazó: ${JSON.stringify(p.errores)}`);
    await registrarCaptura(
      captura,
      p.filas.map((f) => ({
        ...f,
        referenciaExterna:
          f.tipo === "ingreso"
            ? referenciaDeCaptura(captura, "ingreso")
            : referenciaDeReasignacion(captura, f.sobreDestinoId),
      })),
      etiqueta,
    );
    return captura;
  }
  const deCaptura = (captura: string) =>
    db
      .select()
      .from(movimientos)
      .where(like(movimientos.referenciaExterna, `captura-${captura}-%`));

  try {
    // ★ 1 · una etiqueta, sin duplicados por tipeo
    const sax = await buscarOCrearEtiqueta(`${PREFIJO} SAX`);
    const grafias = [`${PREFIJO} sax`, `  ${PREFIJO}   Sax `, `${PREFIJO.toUpperCase()} SÁX`];
    const otras = await Promise.all(grafias.map((g) => buscarOCrearEtiqueta(g)));
    comprobar(
      "1",
      `"SAX", "sax", " Sax " y "SÁX" son la misma: se usa la existente, con la grafía de la primera`,
      otras.every((e) => e.id === sax.id) && otras.every((e) => e.nombre === `${PREFIJO} SAX`),
      otras.map((e) => `${e.id} ${e.nombre}`).join(", "),
    );
    const variantes = ["Rielco", "rielco", " RIELCO ", "Riélco", "rielco  ", "RiElCo"].map((v) => `${PREFIJO} ${v}`);
    const aLaVez = await Promise.all(variantes.map((v) => buscarOCrearEtiqueta(v)));
    const [{ rielcos }] = await db
      .select({ rielcos: count() })
      .from(etiquetas)
      .where(like(etiquetas.clave, `${clavePrefijo.ok ? clavePrefijo.clave : ""} rielco%`));
    comprobar(
      "1",
      "seis pestañas que la crean a la vez con grafías distintas terminan en una sola fila",
      new Set(aLaVez.map((e) => e.id)).size === 1 && rielcos === 1,
      `${rielcos} filas`,
    );
    const nombreSax = nombreDeEtiqueta(`${PREFIJO} sax`);
    const duplicada = await codigoDe(() =>
      db.insert(etiquetas).values({ nombre: `${PREFIJO} sax`, clave: nombreSax.ok ? nombreSax.clave : "" }),
    );
    comprobar("1", "una segunda fila con la misma clave la rechaza el índice único", duplicada === "23505", duplicada);

    // ★ 4 · solo gastos e ingresos llevan etiqueta
    const { captura: conVenta } = await gasto(
      { id: sax.id },
      {
        forma: "vendiendo",
        monto: "4000",
        tasa: "40",
        vendido: "100",
        cuentaOrigen: { id: binance.id, moneda: binance.moneda },
      },
    );
    const filasVenta = await deCaptura(conVenta);
    comprobar(
      "4",
      "el gasto vendiendo USDT lleva la etiqueta y su venta no",
      filasVenta.find((f) => f.tipo === "gasto")?.etiquetaId === sax.id &&
        filasVenta.find((f) => f.tipo === "transferencia")?.etiquetaId === null,
    );
    const gastoVentaId = filasVenta.find((f) => f.tipo === "gasto")!.id;
    await editarGasto(
      gastoVentaId,
      (g) =>
        planDeEdicionDeGasto(
          g,
          entradaGasto({
            forma: "vendiendo",
            monto: "4500",
            tasa: "45",
            vendido: "100",
            cuentaOrigen: { id: binance.id, moneda: binance.moneda },
          }),
          hoy,
        ),
      { id: sax.id },
    );
    const trasEditar = await deCaptura(conVenta);
    comprobar(
      "4",
      "al editarlo, la venta recalculada sigue sin etiqueta",
      trasEditar.find((f) => f.tipo === "transferencia")?.etiquetaId === null &&
        trasEditar.find((f) => f.tipo === "gasto")?.etiquetaId === sax.id,
    );
    const conReparto = await ingreso({ id: sax.id }, "100", "30");
    const filasReparto = await deCaptura(conReparto);
    comprobar(
      "4",
      "el ingreso lleva la etiqueta y su reparto no",
      filasReparto.find((f) => f.tipo === "ingreso")?.etiquetaId === sax.id &&
        filasReparto.filter((f) => f.tipo === "reasignacion").every((f) => f.etiquetaId === null),
    );
    const venta = filasVenta.find((f) => f.tipo === "transferencia")!;
    const reasignacion = filasReparto.find((f) => f.tipo === "reasignacion")!;
    /** La fila como para insertarla de nuevo: sin su id ni su fecha de creación. */
    const sinId = (f: typeof venta) => {
      const copia: Partial<typeof venta> = { ...f };
      delete copia.id;
      delete copia.creadoEn;
      return copia as Omit<typeof venta, "id" | "creadoEn">;
    };
    const codigos = [
      await codigoDe(() =>
        registrarMovimientos([
          { ...sinId(venta), referenciaExterna: `captura-${idDePrueba()}-transferencia`, etiquetaId: sax.id },
        ]),
      ),
      await codigoDe(() =>
        registrarMovimientos([
          {
            ...sinId(reasignacion),
            referenciaExterna: `captura-${idDePrueba()}-reasignacion-${planes.id}`,
            etiquetaId: sax.id,
          },
        ]),
      ),
      await codigoDe(() => db.update(movimientos).set({ etiquetaId: sax.id }).where(eq(movimientos.id, venta.id))),
    ];
    comprobar(
      "4",
      "la base rechaza una etiqueta en una transferencia o una reasignación, al insertar y al actualizar",
      codigos.every((c) => c === "23514"),
      codigos.join(", "),
    );

    // Revisión de la 006, hallazgo 1: la etiqueta nueva se crea al guardar, en la misma transacción que la captura.
    const conNueva = await gasto({ nueva: `${PREFIJO} Nueva` }, { monto: "9" });
    const nueva = (
      await db
        .select()
        .from(etiquetas)
        .where(eq(etiquetas.clave, `${clavePrefijo.ok ? clavePrefijo.clave : ""} nueva`))
    )[0];
    comprobar(
      "3",
      "guardar un gasto con una etiqueta nueva la crea y la pone en el gasto",
      conNueva.nueva && nueva !== undefined && (await deCaptura(conNueva.captura))[0]?.etiquetaId === nueva.id,
    );
    const otraVez = await gasto({ nueva: `${PREFIJO} Repetida` }, { monto: "11" }, conNueva.captura);
    const repetida = await db
      .select()
      .from(etiquetas)
      .where(eq(etiquetas.clave, `${clavePrefijo.ok ? clavePrefijo.clave : ""} repetida`));
    comprobar(
      "3",
      "si la captura ya estaba (otro gasto con el mismo id), no se guarda y la etiqueta nueva tampoco queda",
      !otraVez.nueva && repetida.length === 0 && (await deCaptura(conNueva.captura)).length === 1,
    );

    // ★ 5 y 6 · filtrar y acumular
    const rielco = aLaVez[0];
    await gasto({ id: rielco.id }, { monto: "10" });
    await gasto({ id: rielco.id }, { monto: "15" });
    await gasto({ id: rielco.id }, { monto: "7", categoriaId: catB.id });
    await gasto(null, { monto: "20" });
    await ingreso({ id: rielco.id }, "100", "0");
    const anilloAntes = JSON.stringify(await totalesPorCategoria("gastos", mes));
    const deGastos = await etiquetasDelPeriodo("gastos", mes, null);
    const deIngresos = await etiquetasDelPeriodo("ingresos", mes, null);
    comprobar(
      "5",
      "Gastos muestra Rielco con 32,00 y SAX con lo suyo; Ingresos, Rielco con 100,00",
      deGastos.find((e) => e.id === rielco.id)?.centavos === 3200 &&
        deGastos.some((e) => e.id === sax.id) &&
        deIngresos.find((e) => e.id === rielco.id)?.centavos === 10000,
      JSON.stringify(deGastos.filter((e) => e.nombre.startsWith(PREFIJO)).map((e) => [e.nombre, e.centavos])),
    );
    const lista = await movimientosDelPeriodo("gastos", mes, null, 200, rielco.id);
    const dias = await resumenPorDia("gastos", mes, null, rielco.id);
    comprobar(
      "5",
      "filtrar por Rielco deja en la lista solo sus tres gastos, y el total de arriba en 32,00",
      lista.length === 3 &&
        lista.every((m) => m.etiquetaId === rielco.id && m.tipo === "gasto") &&
        dias.reduce((a, d) => a + d.centavos, 0) === 3200,
    );
    const conCategoria = await movimientosDelPeriodo("gastos", mes, catA.id, 200, rielco.id);
    const etiquetasConCategoria = await etiquetasDelPeriodo("gastos", mes, catA.id);
    comprobar(
      "5",
      "se combina con la categoría: Rielco en la primera categoría son dos gastos y 25,00",
      conCategoria.length === 2 && etiquetasConCategoria.find((e) => e.id === rielco.id)?.centavos === 2500,
    );
    const sinFiltro = await movimientosDelPeriodo("gastos", mes, null, 200, null);
    comprobar(
      "5",
      "sin filtro vuelven todos, también el de sin etiqueta; el anillo es el del periodo, sin mirar la etiqueta",
      sinFiltro.some((m) => m.etiquetaId === null && m.nota === "comprobar-008") &&
        JSON.stringify(await totalesPorCategoria("gastos", mes)) === anilloAntes,
    );
    comprobar(
      "6",
      "cada fila trae el nombre de su etiqueta para el detalle",
      lista.every((m) => m.etiqueta === rielco.nombre),
      lista[0]?.etiqueta ?? "",
    );
    const todas = await deCaptura(conVenta);
    comprobar(
      "4",
      "las filas de esta comprobación existen y siguen cuadrando",
      todas.length === 2 && (await estado()).cuadra,
    );
  } finally {
    await limpiar();
  }

  const final = await estado();
  comprobar(
    "1",
    "al terminar, la base queda como estaba, también las etiquetas",
    final.huella === inicial.huella && final.filas === inicial.filas && final.cuantas === inicial.cuantas,
  );
  console.log(fallos === 0 ? "\n✓ comprobar-008: todo en verde" : `\n✗ comprobar-008: ${fallos} fallos`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
