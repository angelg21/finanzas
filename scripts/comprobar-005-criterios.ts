/**
 * Lo que los criterios ★ de la spec 005 piden contra la base y scripts/comprobar-005.ts no miraba, escrito al verificar
 * desde el texto de cada criterio:
 *   ★ 3 y 5 · pagos, préstamos y cobros no cuentan en el gastado del mes, la gráfica mensual, el anillo de categorías
 *             ni la pestaña Ingresos;
 *   ★ 8     · el check de forma compara como texto, termina en "else false" y rechaza las formas malas de los tipos nuevos;
 *   ★ 10    · la semilla crea Deudas después de Ocasiones; sin Deudas activo no se paga ni se aparta, pero sí se registra;
 *   ★ 11    · la cuota no cambia dentro del mes cuando Deudas recibe desde Por asignar;
 *   ★ 12    · guardarReglas deja fuera a Deudas;
 *   ★ 13    · apartar desde Por asignar y repartir a la vez nunca pasan de su saldo;
 *   ★ 16    · editar y borrar no se cruzan con un pago;
 *   ★ 23    · la captura de gasto no ofrece Deudas.
 * Corre sobre la base local con los datos de demostración y la deja como estaba:
 *   pnpm exec tsx scripts/comprobar-005-criterios.ts
 * Lo que la base rechaza lleva la referencia "demo-comprobar-005-criterios-*"; lo demás, ids de captura que empiezan por
 * 0c05000c, que se borran al terminar y, si una corrida se cortó, al empezar la siguiente. Nunca contra una base con
 * datos reales: se niega si encuentra movimientos o deudas que no sean de demostración.
 */
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { count, eq, inArray, isNull, like, not, or, sql } from "drizzle-orm";
import { categorias, reglasReparto, sobres } from "../src/db/schema";
import { prepararApartado, sobresParaApartar } from "../src/lib/apartado";
import { referenciaDeCaptura, referenciaDeReasignacion } from "../src/lib/captura";
import { exigirBaseLocal } from "../src/lib/destino-base";
import { type FilaDeuda, prepararPago, validarDeuda } from "../src/lib/deudas";
import { centavosATexto } from "../src/lib/dinero";
import { hoyEnCaracas, inicioDeMes } from "../src/lib/fechas";
import { rangoDePeriodo } from "../src/lib/periodos";
import { prepararCobro, prepararPrestamo } from "../src/lib/prestamos";
import { reglaEditable } from "../src/lib/reglas";

const REFERENCIA = "demo-comprobar-005-criterios";
/** El primer bloque de los ids de captura de esta comprobación. */
const MARCA = "0c05000c";
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

async function lanza(f: () => Promise<unknown>) {
  try {
    await f();
    return false;
  } catch {
    return true;
  }
}

async function main() {
  config({ path: ".env.local" });
  // Escribe filas: solo en la base local (spec 002, criterio 10).
  exigirBaseLocal(process.env.DATABASE_URL, "comprobar-005-criterios");
  const { db, deudas, movimientos } = await import("../src/db/index");
  const { gastadoEsteMes, resumenMensual, saldosPorCuenta, saldosPorSobre, sobresParaGasto } =
    await import("../src/db/consultas");
  const { movimientosDelPeriodo, resumenPorDia, totalesPorCategoria } =
    await import("../src/db/movimientos-del-periodo");
  const { deudaPorId, sobreDeudas } = await import("../src/db/deudas");
  const { cuotaDelMes } = await import("../src/db/reparto");
  const { guardarReglas } = await import("../src/db/reglas");
  const { repartirPorAsignar } = await import("../src/db/movimientos");
  const { apartarADeudas, borrarDeuda, cobrarPrestamo, editarDeuda, pagarDeuda, prestar, registrarDeuda } =
    await import("../src/db/guardar-deudas");

  const movimientosNuestros = or(
    like(movimientos.referenciaExterna, `${REFERENCIA}-%`),
    like(movimientos.referenciaExterna, `captura-${MARCA}-%`),
  );
  const deudasNuestras = or(like(deudas.referencia, `${REFERENCIA}-%`), like(deudas.referencia, `captura-${MARCA}-%`));
  async function limpiar() {
    await db.delete(movimientos).where(movimientosNuestros);
    await db.delete(deudas).where(deudasNuestras);
  }
  await limpiar();
  const [{ reales }] = await db
    .select({ reales: count() })
    .from(movimientos)
    .where(or(isNull(movimientos.referenciaExterna), not(like(movimientos.referenciaExterna, "demo-%"))));
  const [{ deudasReales }] = await db
    .select({ deudasReales: count() })
    .from(deudas)
    .where(or(isNull(deudas.referencia), not(like(deudas.referencia, "demo-%"))));
  if (reales + deudasReales > 0) {
    throw new Error(`Hay ${reales} movimientos y ${deudasReales} deudas que no son de demostración. No se toca.`);
  }

  async function estado() {
    const [c, s, [{ filas }], [{ cuantasDeudas }], reglas] = await Promise.all([
      saldosPorCuenta(),
      saldosPorSobre(),
      db.select({ filas: count() }).from(movimientos),
      db.select({ cuantasDeudas: count() }).from(deudas),
      db.select().from(reglasReparto).orderBy(reglasReparto.id),
    ]);
    const totalCuentas = c.reduce((a, x) => a + x.saldoUsdCentavos, 0);
    const totalSobres = s.reduce((a, x) => a + x.saldoCentavos, 0);
    const huella = JSON.stringify([c.map((x) => [x.id, x.saldoCentavos]), s.map((x) => [x.id, x.saldoCentavos])]);
    return { cuentas: c, sobres: s, cuadra: totalCuentas === totalSobres, filas, cuantasDeudas, reglas, huella };
  }
  const saldoDe = async (id: number) => (await saldosPorSobre()).find((s) => s.id === id)?.saldoCentavos ?? NaN;

  const inicial = await estado();
  const hoy = hoyEnCaracas(new Date());
  const mes = rangoDePeriodo("mes", hoy);
  const deudasSobre = await sobreDeudas();
  const porAsignar = inicial.sobres.find((s) => s.tipo === "por_asignar");
  const gastosDelMes = inicial.sobres.find((s) => s.tipo === "gastos");
  const binance = inicial.cuentas.find((c) => c.nombre === "Binance");
  if (!deudasSobre?.activo || !porAsignar || !gastosDelMes || !binance) {
    throw new Error("Faltan datos base: corre pnpm db:seed");
  }
  const enDolares = inicial.cuentas.filter((c) => c.moneda !== "VES");
  const binanceDeuda = { id: binance.id, moneda: binance.moneda };
  console.log(`Base local · hoy en Caracas ${hoy} · ${inicial.filas} movimientos · ${inicial.cuantasDeudas} deudas`);

  function deuda(cambios: Partial<Parameters<typeof validarDeuda>[0]>): FilaDeuda {
    const r = validarDeuda(
      {
        sentido: "debo",
        persona: "Prueba (comprobar-005-criterios)",
        monto: "100",
        fechaPrevista: "",
        cuentaPrevistaId: binance!.id,
        nota: "",
        ...cambios,
      },
      enDolares,
    );
    if (!r.ok) throw new Error(`validarDeuda rechazó: ${Object.keys(r.errores).join(", ")}`);
    return r.deuda;
  }
  async function registrada(cambios: Partial<Parameters<typeof validarDeuda>[0]> = {}) {
    const fila = deuda(cambios);
    const r = await registrarDeuda(idDePrueba(), fila);
    if (!r.nueva) throw new Error("La deuda no se registró");
    return { id: r.id, fila };
  }
  async function pago(id: string, deudaId: number, monto: string) {
    const actual = await deudaPorId(deudaId);
    if (!actual) throw new Error("La deuda no existe");
    const r = prepararPago({ monto, fecha: hoy, nota: "", cuenta: binanceDeuda }, actual, deudasSobre!.id, hoy);
    if (!r.ok) throw new Error(`prepararPago rechazó ${monto}: ${Object.keys(r.errores).join(", ")}`);
    return { ...r.fila, referenciaExterna: referenciaDeCaptura(id, "pago") };
  }
  /** Una reasignación de Por asignar a `destino` con la referencia de la captura, como la escriben apartar y repartir. */
  function desdePorAsignar(id: string, destino: number, centavos: number) {
    const r = prepararApartado(
      { monto: centavosATexto(centavos), sobreOrigenId: porAsignar!.id },
      [{ ...porAsignar!, saldoCentavos: Number.MAX_SAFE_INTEGER }],
      destino,
      hoy,
    );
    if (!r.ok) throw new Error(`prepararApartado rechazó: ${Object.keys(r.errores).join(", ")}`);
    return { ...r.fila, referenciaExterna: referenciaDeReasignacion(id, destino) };
  }

  /** Lo que ven el gastado del mes, la gráfica mensual, el anillo de categorías y las pestañas Gastos e Ingresos. */
  async function gastosEIngresos() {
    const lecturas = await Promise.all([
      gastadoEsteMes(),
      resumenMensual(6),
      totalesPorCategoria("gastos", mes),
      totalesPorCategoria("ingresos", mes),
      movimientosDelPeriodo("gastos", mes, null).then((l) => l.map((m) => m.id)),
      movimientosDelPeriodo("ingresos", mes, null).then((l) => l.map((m) => m.id)),
      resumenPorDia("gastos", mes, null),
      resumenPorDia("ingresos", mes, null),
    ]);
    return JSON.stringify(lecturas);
  }

  const reglasAntes = JSON.stringify(inicial.reglas);
  try {
    // ★ 10 · la semilla crea Deudas, de tipo deudas, después de Ocasiones
    const orden = inicial.sobres.map((s) => s.nombre);
    comprobar(
      "10",
      'la semilla crea "Deudas", de tipo deudas, justo después de Ocasiones',
      deudasSobre.nombre === "Deudas" && orden.indexOf("Deudas") === orden.indexOf("Ocasiones") + 1,
      orden.join(", "),
    );

    // ★ 23 · la captura de gasto no ofrece Deudas, y sí todos los demás salvo Por asignar
    const paraGasto = (await sobresParaGasto()).map((s) => s.tipo);
    comprobar(
      "23",
      "la captura de gasto no ofrece Deudas ni Por asignar, y sí los demás sobres activos",
      !paraGasto.includes("deudas") &&
        !paraGasto.includes("por_asignar") &&
        paraGasto.length === inicial.sobres.length - 2,
      paraGasto.join(", "),
    );

    // ★ 12 · guardarReglas deja fuera a Deudas: con las reglas de siempre más una de Deudas, no guarda nada
    const editables = inicial.reglas.filter(
      (r) => r.activa && reglaEditable(inicial.sobres.find((s) => s.id === r.sobreId)?.tipo ?? "por_asignar"),
    );
    const conDeudas = [
      ...editables.map((r) => ({ sobreId: r.sobreId, tipo: r.tipo, valor: r.valor })),
      { sobreId: deudasSobre.id, tipo: "fijo" as const, valor: 38_500 },
    ];
    const rechazaDeudas = await lanza(() => guardarReglas(conDeudas, null));
    const reglasTras = await db.select().from(reglasReparto).orderBy(reglasReparto.id);
    comprobar(
      "12",
      "guardarReglas rechaza una regla para Deudas y no toca las demás",
      rechazaDeudas && JSON.stringify(reglasTras) === reglasAntes,
    );

    // ★ 3 y 5 · pagar, prestar y cobrar no cambian el gastado del mes, la gráfica, el anillo ni la pestaña Ingresos
    const vistaAntes = await gastosEIngresos();
    const enDosMeses = inicioDeMes(hoy, 2).replace(/01$/, "15");
    const papas = await registrada({
      persona: "Papás (comprobar-005-criterios)",
      monto: "520",
      fechaPrevista: enDosMeses,
    });
    const idPago = idDePrueba();
    const filaPago = await pago(idPago, papas.id, "200");
    const rPago = await pagarDeuda(idPago, filaPago);
    const origen = sobresParaApartar(
      inicial.sobres.filter((s) => s.id !== deudasSobre.id).map((s) => ({ ...s, tipo: s.tipo as string })),
    ).sort((a, b) => b.saldoCentavos - a.saldoCentavos)[0];
    if (!origen || origen.saldoCentavos < 10_000) throw new Error("Ningún sobre con saldo: corre pnpm db:demo");
    const idPrestamo = idDePrueba();
    const prestamo = prepararPrestamo(
      {
        persona: "Luis (comprobar-005-criterios)",
        monto: "80",
        fecha: "hoy",
        fechaPrevista: "",
        nota: "",
        cuenta: binanceDeuda,
        sobreOrigenId: origen.id,
      },
      inicial.sobres,
      hoy,
    );
    if (!prestamo.ok) throw new Error(`prepararPrestamo rechazó: ${Object.keys(prestamo.errores)}`);
    const rPrestamo = await prestar(idPrestamo, prestamo.deuda, {
      ...prestamo.fila,
      referenciaExterna: referenciaDeCaptura(idPrestamo, "prestamo"),
    });
    const luis = "deudaId" in rPrestamo ? await deudaPorId(rPrestamo.deudaId) : null;
    if (!luis) throw new Error("El préstamo no quedó");
    const idCobro = idDePrueba();
    const cobro = prepararCobro(
      { monto: "60", fecha: "hoy", nota: "", cuenta: binanceDeuda },
      luis,
      porAsignar.id,
      hoy,
    );
    if (!cobro.ok) throw new Error(`prepararCobro rechazó: ${Object.keys(cobro.errores)}`);
    const filaCobro = { ...cobro.fila, referenciaExterna: referenciaDeCaptura(idCobro, "cobro") };
    const rCobro = await cobrarPrestamo(idCobro, filaCobro);
    const vistaTras = await gastosEIngresos();
    const nuestros = await db
      .select({ id: movimientos.id, tipo: movimientos.tipo })
      .from(movimientos)
      .where(
        inArray(movimientos.referenciaExterna, [
          referenciaDeCaptura(idPago, "pago"),
          referenciaDeCaptura(idPrestamo, "prestamo"),
          referenciaDeCaptura(idCobro, "cobro"),
        ]),
      );
    comprobar(
      "3 y 5",
      "un pago, un préstamo y un cobro de hoy no cambian el gastado del mes, la gráfica, el anillo ni Gastos e Ingresos",
      "nueva" in rPago &&
        rPago.nueva &&
        "nueva" in rCobro &&
        rCobro.nueva &&
        nuestros.length === 3 &&
        vistaTras === vistaAntes,
      nuestros.map((m) => m.tipo).join(", "),
    );
    const mover = (await movimientosDelPeriodo("mover", mes, null)).map((m) => m.id);
    comprobar(
      "3 y 5",
      "los tres salen en Mover",
      nuestros.every((m) => mover.includes(m.id)),
    );

    // ★ 8 · el check de forma: compara como texto, termina en "else false" y rechaza las formas malas
    const [forma] = await db.execute<{ def: string }>(
      sql`select pg_get_constraintdef(oid) as def from pg_constraint where conname = 'movimientos_forma_por_tipo'`,
    );
    const checksDeDeudas = await db.execute<{ def: string }>(
      sql`select pg_get_constraintdef(oid) as def from pg_constraint
          where conname in ('deudas_monto_valido', 'deudas_cuenta_prevista_solo_debo')`,
    );
    comprobar(
      "8",
      'el check de forma compara el tipo como texto y termina en "else false"; los de deudas, el sentido como texto',
      /CASE \(?tipo\)?::text/.test(forma?.def ?? "") &&
        /ELSE false\s*END/.test(forma?.def ?? "") &&
        checksDeDeudas.length === 2 &&
        checksDeDeudas.every((c) => /sentido\)?::text/.test(c.def)),
    );
    const [categoria] = await db.select({ id: categorias.id }).from(categorias).limit(1);
    if (!categoria) throw new Error("No hay categorías: corre pnpm db:seed");
    // Cada una cambia un solo lado de un pago o un cobro que la base ya aceptó.
    const malas = {
      "pago con categoría": { ...filaPago, categoriaId: categoria.id },
      "pago con cuenta de destino": { ...filaPago, cuentaDestinoId: binance.id },
      "préstamo sin deuda": { ...filaPago, tipo: "prestamo" as const, deudaId: null },
      "cobro con cuenta de origen": { ...filaCobro, cuentaOrigenId: binance.id },
      "cobro sin sobre de destino": { ...filaCobro, sobreDestinoId: null },
      "cobro sin deuda": { ...filaCobro, deudaId: null },
      "ingreso con deuda": { ...filaCobro, tipo: "ingreso" as const, categoriaId: categoria.id },
    };
    const codigos: string[] = [];
    for (const [nombre, valores] of Object.entries(malas)) {
      const referencia = `${REFERENCIA}-${codigos.length}`;
      codigos.push(
        `${nombre}: ${await codigoDe(() => db.insert(movimientos).values({ ...valores, referenciaExterna: referencia }))}`,
      );
    }
    const meDebenNegativo = await codigoDe(() =>
      db.insert(deudas).values({
        ...deuda({ sentido: "me_deben", cuentaPrevistaId: null }),
        montoInicialCentavos: -1,
        referencia: `${REFERENCIA}-negativa`,
      }),
    );
    comprobar(
      "8",
      "la base rechaza cada forma mala de los tipos nuevos y un monto inicial negativo (23514)",
      codigos.every((c) => c.endsWith(": 23514")) && meDebenNegativo === "23514",
      [
        ...codigos.filter((c) => !c.endsWith(": 23514")),
        meDebenNegativo === "23514" ? "" : `negativa: ${meDebenNegativo}`,
      ]
        .filter(Boolean)
        .join("; "),
    );

    // ★ 11 · la cuota no cambia dentro del mes cuando Deudas recibe desde Por asignar
    const cuotaAntes = await cuotaDelMes();
    const aDeudas = Math.min(await saldoDe(porAsignar.id), 1_000);
    if (aDeudas <= 0) throw new Error("Por asignar sin saldo tras el cobro");
    const idReparto = idDePrueba();
    const rReparto = await repartirPorAsignar(idReparto, porAsignar.id, [
      desdePorAsignar(idReparto, deudasSobre.id, aDeudas),
    ]);
    const cuotaTras = await cuotaDelMes();
    comprobar(
      "11",
      `Deudas recibe ${aDeudas} desde Por asignar y la cuota del mes no cambia`,
      "nueva" in rReparto &&
        rReparto.nueva &&
        !!cuotaAntes &&
        cuotaAntes.cuotaCentavos > 0 &&
        cuotaTras?.cuotaCentavos === cuotaAntes.cuotaCentavos,
      `${cuotaAntes?.cuotaCentavos} → ${cuotaTras?.cuotaCentavos}`,
    );

    // ★ 13 · apartar desde Por asignar y repartir a la vez, cada uno por todo su saldo: solo uno entra
    const saldoPorAsignar = await saldoDe(porAsignar.id);
    if (saldoPorAsignar <= 0) throw new Error("Por asignar sin saldo para la carrera");
    const [idAparta, idReparte] = [idDePrueba(), idDePrueba()];
    const [rAparta, rReparte] = await Promise.all([
      apartarADeudas(idAparta, desdePorAsignar(idAparta, deudasSobre.id, saldoPorAsignar)),
      repartirPorAsignar(idReparte, porAsignar.id, [desdePorAsignar(idReparte, gastosDelMes.id, saldoPorAsignar)]),
    ]);
    const entraron = [rAparta, rReparte].filter((r) => "nueva" in r && r.nueva).length;
    const frenados = [rAparta, rReparte].filter((r) => "sinSaldo" in r).length;
    const porAsignarTras = await saldoDe(porAsignar.id);
    comprobar(
      "13",
      `apartar y repartir los ${saldoPorAsignar} de Por asignar a la vez: uno entra, el otro no, y no queda en negativo`,
      entraron === 1 && frenados === 1 && porAsignarTras === 0,
      `Por asignar en ${porAsignarTras}`,
    );

    // ★ 16 · borrar y pagar a la vez una deuda sin movimientos: gana uno, sin errores ni cruces
    const suelta = await registrada({ persona: "Suelta (comprobar-005-criterios)" });
    const idPagoSuelta = idDePrueba();
    const filaSuelta = await pago(idPagoSuelta, suelta.id, "50");
    const [rBorrar, rPagarSuelta] = await Promise.all([borrarDeuda(suelta.id), pagarDeuda(idPagoSuelta, filaSuelta)]);
    const borroYNoPago = "ok" in rBorrar && "noExiste" in rPagarSuelta;
    const pagoYNoBorro = "nueva" in rPagarSuelta && rPagarSuelta.nueva && "conMovimientos" in rBorrar;
    comprobar(
      "16",
      "borrar y pagar a la vez: o se borra y el pago no encuentra la deuda, o se paga y ya no se borra",
      borroYNoPago !== pagoYNoBorro,
      borroYNoPago ? "ganó borrar" : "ganó pagar",
    );

    // ★ 16 · bajar el monto inicial y pagar a la vez: nunca los dos, y el pendiente nunca negativo
    const otra = await registrada({ persona: "Otra (comprobar-005-criterios)" });
    const idPagoOtra = idDePrueba();
    const filaOtra = await pago(idPagoOtra, otra.id, "80");
    const [rEditar, rPagarOtra] = await Promise.all([
      editarDeuda(otra.id, { ...otra.fila, montoInicialCentavos: 5_000 }),
      pagarDeuda(idPagoOtra, filaOtra),
    ]);
    const editoYNoPago = "ok" in rEditar && "excede" in rPagarOtra && rPagarOtra.pendienteCentavos === 5_000;
    const pagoYNoEdito =
      "nueva" in rPagarOtra && rPagarOtra.nueva && "minimoCentavos" in rEditar && rEditar.minimoCentavos === 8_000;
    const pendienteOtra = (await deudaPorId(otra.id))?.pendienteCentavos ?? NaN;
    comprobar(
      "16",
      "bajar el monto a 50,00 y pagar 80,00 a la vez: gana uno y el pendiente queda en 50,00 o en 20,00",
      editoYNoPago !== pagoYNoEdito && pendienteOtra === (editoYNoPago ? 5_000 : 2_000),
      `${editoYNoPago ? "ganó editar" : "ganó pagar"}, pendiente ${pendienteOtra}`,
    );

    // ★ 10 · sin Deudas activo no se paga ni se aparta, y la cuota sale del reparto; registrar sí se puede
    const idSinSobre = idDePrueba();
    const filaSinSobre = await pago(idSinSobre, papas.id, "10");
    const idApartaSinSobre = idDePrueba();
    const filaApartaSinSobre = {
      ...desdePorAsignar(idApartaSinSobre, deudasSobre.id, 1),
      sobreOrigenId: gastosDelMes.id,
    };
    await db.update(sobres).set({ activo: false }).where(eq(sobres.id, deudasSobre.id));
    try {
      const inactivo = await sobreDeudas();
      const noPaga = await lanza(() => pagarDeuda(idSinSobre, filaSinSobre));
      const noAparta = await lanza(() => apartarADeudas(idApartaSinSobre, filaApartaSinSobre));
      const sinCuota = (await cuotaDelMes()) === null;
      const registra = await registrarDeuda(idDePrueba(), deuda({ persona: "Sin sobre (comprobar-005-criterios)" }));
      comprobar(
        "10",
        "con Deudas inactivo se sabe, no se paga ni se aparta, el reparto sigue sin cuota, y registrar sí se puede",
        inactivo?.activo === false && noPaga && noAparta && sinCuota && registra.nueva,
      );
    } finally {
      await db.update(sobres).set({ activo: true }).where(eq(sobres.id, deudasSobre.id));
    }

    const final = await estado();
    comprobar("9", "tras todo lo anterior, sigue en Cuadra", final.cuadra);
  } finally {
    await db.update(sobres).set({ activo: true }).where(eq(sobres.id, deudasSobre.id));
    await limpiar();
    const final = await estado();
    comprobar(
      "—",
      "la base queda como estaba: mismos saldos, movimientos, deudas y reglas",
      final.huella === inicial.huella &&
        final.filas === inicial.filas &&
        final.cuantasDeudas === inicial.cuantasDeudas &&
        JSON.stringify(final.reglas) === reglasAntes,
      `${final.filas} movimientos, ${final.cuantasDeudas} deudas`,
    );
  }
}

main()
  .then(() => {
    console.log(
      fallos === 0
        ? "✓ comprobar-005-criterios: todo en verde"
        : `✗ comprobar-005-criterios: ${fallos} comprobaciones fallaron`,
    );
    process.exit(fallos === 0 ? 0 : 1);
  })
  .catch((error) => {
    console.error("✗ comprobar-005-criterios:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
