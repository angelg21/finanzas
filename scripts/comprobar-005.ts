/**
 * Comprobación contra la base de los criterios ★ de la spec 005 que no caben en una función pura: registrar, pagar,
 * apartar, editar y borrar con el cuadre intacto, el pendiente que nunca se pasa (también con dos pagos a la vez),
 * los reintentos sin duplicados, el check de forma y las sumas de SQL iguales a saldosTras. Corre sobre la base
 * local con los datos de demostración y la deja como estaba:
 *   pnpm exec tsx scripts/comprobar-005.ts
 * Lo que no pasa por una captura lleva la referencia "demo-comprobar-005-*". Lo que sí usa ids de captura que empiezan
 * por 0c050005, para reconocerlos: se borran al terminar y, si una corrida se cortó, al empezar la siguiente. Nunca
 * contra una base con datos reales: se niega si encuentra movimientos o deudas que no sean de demostración.
 */
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { count, eq, isNull, like, not, or } from "drizzle-orm";
import { reglasReparto } from "../src/db/schema";
import { prepararApartado, sobresParaApartar } from "../src/lib/apartado";
import {
  referenciaDeCaptura,
  referenciaDeReasignacion,
  resolverReintento,
  resolverReintentoDeDeuda,
} from "../src/lib/captura";
import { exigirBaseLocal } from "../src/lib/destino-base";
import { type FilaDeuda, prepararPago, validarDeuda } from "../src/lib/deudas";
import { hoyEnCaracas, inicioDeMes } from "../src/lib/fechas";
import { proponerReparto } from "../src/lib/reparto";
import { saldosTras } from "../src/lib/saldos";

const REFERENCIA = "demo-comprobar-005";
/** El primer bloque de los ids de captura de esta comprobación. */
const MARCA = "0c050005";
let fallos = 0;

function comprobar(criterio: string, descripcion: string, ok: boolean, detalle = "") {
  if (!ok) fallos++;
  console.log(`${ok ? "✓" : "✗"} ${criterio} · ${descripcion}${detalle ? ` (${detalle})` : ""}`);
}

/** Un id de captura reconocible: 0c050005-xxxx-4xxx-8xxx-xxxxxxxxxxxx. */
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
  exigirBaseLocal(process.env.DATABASE_URL, "comprobar-005");
  const { db, deudas, movimientos } = await import("../src/db/index");
  const { saldosPorCuenta, saldosPorSobre } = await import("../src/db/consultas");
  const { deudaPorId, sobreDeudas } = await import("../src/db/deudas");
  const { cuotaDelMes, datosDelReparto } = await import("../src/db/reparto");
  const { apartarADeudas, borrarDeuda, editarDeuda, pagarDeuda, registrarDeuda } =
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
  // Lo que dejó una corrida cortada se borra antes de mirar.
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
    const [c, s, [{ filas }], [{ cuantasDeudas }]] = await Promise.all([
      saldosPorCuenta(),
      saldosPorSobre(),
      db.select({ filas: count() }).from(movimientos),
      db.select({ cuantasDeudas: count() }).from(deudas),
    ]);
    const totalCuentas = c.reduce((a, x) => a + x.saldoUsdCentavos, 0);
    const totalSobres = s.reduce((a, x) => a + x.saldoCentavos, 0);
    return {
      cuentas: c,
      sobres: s,
      totalCuentas,
      totalSobres,
      cuadra: totalCuentas === totalSobres,
      filas,
      cuantasDeudas,
    };
  }
  type Estado = Awaited<ReturnType<typeof estado>>;
  const huella = (e: Estado) =>
    JSON.stringify([e.cuentas.map((c) => [c.id, c.saldoCentavos]), e.sobres.map((s) => [s.id, s.saldoCentavos])]);
  const saldoDe = (e: Estado, id: number) => e.sobres.find((s) => s.id === id)?.saldoCentavos ?? NaN;
  const cuentaDe = (e: Estado, id: number) => e.cuentas.find((c) => c.id === id)?.saldoCentavos ?? NaN;
  const cuadra = (e: Estado) => `sobres ${e.totalSobres}, cuentas ${e.totalCuentas}`;

  /** Las sumas de SQL contra saldosTras sobre todas las filas de la base (criterio 9). */
  async function sqlIgualASaldosTras() {
    const [e, filas] = await Promise.all([estado(), db.select().from(movimientos)]);
    const tras = saldosTras(filas, {}, {});
    return (
      e.sobres.every((s) => (tras.sobres[s.id] ?? 0) === s.saldoCentavos) &&
      e.cuentas.every((c) => (tras.cuentas[c.id] ?? 0) === c.saldoCentavos)
    );
  }

  const inicial = await estado();
  const hoy = hoyEnCaracas(new Date());
  const deudasSobre = await sobreDeudas();
  const binance = inicial.cuentas.find((c) => c.nombre === "Binance");
  const inversion = inicial.sobres.find((s) => s.tipo === "inversion");
  if (!deudasSobre?.activo || !binance || !inversion) throw new Error("Faltan datos base: corre pnpm db:seed");
  const enDolares = inicial.cuentas.filter((c) => c.moneda !== "VES");
  const binanceDeuda = { id: binance.id, moneda: binance.moneda };

  /** Una fila de deudas como la daría el formulario. */
  function deuda(cambios: Partial<Parameters<typeof validarDeuda>[0]>): FilaDeuda {
    const r = validarDeuda(
      {
        sentido: "debo",
        persona: "Papás (comprobar-005)",
        monto: "520",
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
  /** Las filas de un pago con la referencia de su captura. */
  async function pago(id: string, deudaId: number, monto: string) {
    const actual = await deudaPorId(deudaId);
    if (!actual) throw new Error("La deuda no existe");
    const r = prepararPago({ monto, fecha: hoy, nota: "", cuenta: binanceDeuda }, actual, deudasSobre!.id, hoy);
    if (!r.ok) throw new Error(`prepararPago rechazó ${monto}: ${Object.keys(r.errores).join(", ")}`);
    return { ...r.fila, referenciaExterna: referenciaDeCaptura(id, "pago") };
  }
  const pendienteDe = async (id: number) => (await deudaPorId(id))?.pendienteCentavos ?? NaN;

  console.log(`Base local · hoy en Caracas ${hoy} · ${inicial.filas} movimientos · ${inicial.cuantasDeudas} deudas`);
  comprobar("9", "al empezar, Cuadra", inicial.cuadra, cuadra(inicial));

  try {
    // ★ 1 y 7 · registrar no mueve saldos, y un reintento no duplica
    const idDeuda = idDePrueba();
    const fila = deuda({});
    const registrada = await registrarDeuda(idDeuda, fila);
    const tras1 = await estado();
    comprobar(
      "1",
      "registrar una deuda guarda una fila y no crea movimientos",
      registrada.nueva && tras1.filas === inicial.filas,
    );
    comprobar(
      "1",
      "ni cambia saldos: sigue en Cuadra",
      huella(tras1) === huella(inicial) && tras1.cuadra,
      cuadra(tras1),
    );
    if (!registrada.nueva) throw new Error("La deuda no se registró");
    const papas = registrada.id;
    const otraVez = await registrarDeuda(idDeuda, fila);
    const [{ conEsaReferencia }] = await db
      .select({ conEsaReferencia: count() })
      .from(deudas)
      .where(eq(deudas.referencia, referenciaDeCaptura(idDeuda, "deuda")));
    comprobar(
      "7",
      'el reintento de registrar no duplica y es "ya estaba"',
      !otraVez.nueva &&
        resolverReintentoDeDeuda(otraVez.guardada, fila, new Date()) === "ya-estaba" &&
        conEsaReferencia === 1,
    );

    // ★ 8 · los checks de deudas
    const sinMonto = await codigoDe(() =>
      db.insert(deudas).values({ ...fila, montoInicialCentavos: 0, referencia: `${REFERENCIA}-cero` }),
    );
    const conCuenta = await codigoDe(() =>
      db.insert(deudas).values({ ...fila, sentido: "me_deben", referencia: `${REFERENCIA}-cuenta` }),
    );
    comprobar(
      "8",
      "la base rechaza una deuda que debo en 0 y algo que me deben con cuenta prevista (23514)",
      sinMonto === "23514" && conCuenta === "23514",
      `${sinMonto}, ${conCuenta}`,
    );

    // ★ 13 · apartar desde el sobre con más saldo
    const origen = sobresParaApartar(
      inicial.sobres.filter((s) => s.id !== deudasSobre.id).map((s) => ({ ...s, tipo: s.tipo as string })),
    ).sort((a, b) => b.saldoCentavos - a.saldoCentavos)[0];
    if (!origen || origen.saldoCentavos < 100)
      throw new Error("Ningún sobre con saldo para apartar: corre pnpm db:demo");
    const aApartar = Math.min(origen.saldoCentavos, 38_500);
    const idApartado = idDePrueba();
    const apartado = (id: string, monto: number, sobres = [origen]) => {
      const r = prepararApartado(
        { monto: String(monto / 100).replace(".", ","), sobreOrigenId: sobres[0].id },
        sobres,
        deudasSobre.id,
        hoy,
      );
      if (!r.ok) throw new Error(`prepararApartado rechazó: ${Object.keys(r.errores).join(", ")}`);
      return { ...r.fila, referenciaExterna: referenciaDeReasignacion(id, deudasSobre.id) };
    };
    const antesDeApartar = await estado();
    const filaApartado = apartado(idApartado, aApartar);
    const r13 = await apartarADeudas(idApartado, filaApartado);
    const trasApartar = await estado();
    comprobar(
      "13",
      `apartar ${aApartar} desde ${origen.nombre} mueve solo entre sobres, y sigue en Cuadra`,
      "nueva" in r13 &&
        r13.nueva &&
        saldoDe(trasApartar, deudasSobre.id) === saldoDe(antesDeApartar, deudasSobre.id) + aApartar &&
        saldoDe(trasApartar, origen.id) === saldoDe(antesDeApartar, origen.id) - aApartar &&
        trasApartar.totalCuentas === antesDeApartar.totalCuentas &&
        trasApartar.cuadra,
      cuadra(trasApartar),
    );
    const reApartado = await apartarADeudas(idApartado, filaApartado);
    comprobar(
      "7",
      'el reintento de apartar no duplica y es "ya estaba"',
      "nueva" in reApartado &&
        !reApartado.nueva &&
        resolverReintento(reApartado.guardadas, [filaApartado], new Date()) === "ya-estaba",
    );
    const saldoOrigen = saldoDe(trasApartar, origen.id);
    const demasiado = { ...filaApartado, montoCentavos: saldoOrigen + 1, montoUsdCentavos: saldoOrigen + 1 };
    const idDemasiado = idDePrueba();
    const r13b = await apartarADeudas(idDemasiado, {
      ...demasiado,
      referenciaExterna: referenciaDeReasignacion(idDemasiado, deudasSobre.id),
    });
    comprobar(
      "13",
      "apartar un centavo más que el saldo del origen se rechaza dentro del candado",
      "sinSaldo" in r13b && r13b.saldoCentavos === saldoOrigen,
    );
    const idInversion = idDePrueba();
    const desdeInversion = await lanza(() =>
      apartarADeudas(idInversion, {
        ...filaApartado,
        sobreOrigenId: inversion.id,
        montoCentavos: 1,
        montoUsdCentavos: 1,
        referenciaExterna: referenciaDeReasignacion(idInversion, deudasSobre.id),
      }),
    );
    comprobar("13", "apartar desde Inversión lo frena la escritura", desdeInversion);

    // ★ 3 · un pago resta de la cuenta y de Deudas, y baja el pendiente
    const idPago1 = idDePrueba();
    const antesDelPago = await estado();
    const pago1 = await pago(idPago1, papas, "200");
    const r3 = await pagarDeuda(idPago1, pago1);
    const trasPago = await estado();
    comprobar(
      "3",
      "pagar 200,00: la cuenta y Deudas bajan 200,00, el pendiente queda en 320,00 y sigue en Cuadra",
      "nueva" in r3 &&
        r3.nueva &&
        cuentaDe(trasPago, binance.id) === cuentaDe(antesDelPago, binance.id) - 20_000 &&
        saldoDe(trasPago, deudasSobre.id) === saldoDe(antesDelPago, deudasSobre.id) - 20_000 &&
        (await pendienteDe(papas)) === 32_000 &&
        trasPago.cuadra,
      cuadra(trasPago),
    );

    // ★ 6 · nunca más que lo pendiente, ni con dos pestañas
    const idExcede = idDePrueba();
    const excede = {
      ...pago1,
      montoCentavos: 32_001,
      montoUsdCentavos: 32_001,
      referenciaExterna: referenciaDeCaptura(idExcede, "pago"),
    };
    const r6 = await pagarDeuda(idExcede, excede);
    comprobar(
      "6",
      "un pago de 320,01 sobre 320,00 pendientes se rechaza",
      "excede" in r6 && r6.pendienteCentavos === 32_000,
    );
    const [idA, idB] = [idDePrueba(), idDePrueba()];
    const [pA, pB] = await Promise.all([pago(idA, papas, "200"), pago(idB, papas, "200")]);
    const [rA, rB] = await Promise.all([pagarDeuda(idA, pA), pagarDeuda(idB, pB)]);
    const nuevas = [rA, rB].filter((r) => "nueva" in r && r.nueva).length;
    const excedidas = [rA, rB].filter((r) => "excede" in r).length;
    comprobar(
      "6",
      "dos pagos de 200,00 a la vez sobre 320,00: uno entra y el otro no",
      nuevas === 1 && excedidas === 1,
      `${await pendienteDe(papas)} pendientes`,
    );

    // ★ 6 y 7 · el reintento del pago que saldó la deuda se reconoce antes de mirar el pendiente
    const idSalda = idDePrueba();
    const salda = await pago(idSalda, papas, "120");
    const rSalda = await pagarDeuda(idSalda, salda);
    const pagada = await deudaPorId(papas);
    comprobar("2", "el último pago la deja pagada", "nueva" in rSalda && rSalda.nueva && pagada?.estado === "pagada");
    const reSalda = await pagarDeuda(idSalda, salda);
    comprobar(
      "6",
      'el reintento del pago que la saldó es "ya estaba", no "no alcanza"',
      "nueva" in reSalda && !reSalda.nueva && resolverReintento(reSalda.guardadas, [salda], new Date()) === "ya-estaba",
    );

    // ★ 8 · el check de forma
    const sinDeuda = await codigoDe(() =>
      db.insert(movimientos).values({ ...salda, deudaId: null, referenciaExterna: `${REFERENCIA}-sin-deuda` }),
    );
    const gastoConDeuda = await codigoDe(() =>
      db
        .insert(movimientos)
        .values({ ...salda, tipo: "gasto", categoriaId: null, referenciaExterna: `${REFERENCIA}-gasto-deuda` }),
    );
    comprobar(
      "8",
      "la base rechaza un pago_deuda sin deuda y un gasto con deuda (23514)",
      sinDeuda === "23514" && gastoConDeuda === "23514",
      `${sinDeuda}, ${gastoConDeuda}`,
    );

    // ★ 16 · editar sin romper el pendiente, y borrar solo sin movimientos
    const bajo = await editarDeuda(papas, { ...fila, montoInicialCentavos: 51_999 });
    comprobar(
      "16",
      "bajar el monto inicial por debajo de lo pagado se rechaza",
      "minimoCentavos" in bajo && bajo.minimoCentavos === 52_000,
    );
    const igual = await editarDeuda(papas, {
      ...fila,
      persona: "Papá y mamá (comprobar-005)",
      montoInicialCentavos: 52_000,
    });
    comprobar(
      "16",
      "editar la persona con el monto en lo pagado se guarda y sigue pagada",
      "ok" in igual && (await deudaPorId(papas))?.estado === "pagada",
    );
    // Lo que llegue de más no se escribe: ni el sentido ni la referencia (guardian-datos, T7).
    const referenciaAntes = (await db.select({ r: deudas.referencia }).from(deudas).where(eq(deudas.id, papas)))[0]?.r;
    const deMas = { ...fila, sentido: "me_deben", referencia: `${REFERENCIA}-pisada`, montoInicialCentavos: 52_000 };
    await editarDeuda(papas, deMas as Parameters<typeof editarDeuda>[1]);
    const [trasDeMas] = await db
      .select({ sentido: deudas.sentido, referencia: deudas.referencia })
      .from(deudas)
      .where(eq(deudas.id, papas));
    comprobar(
      "16",
      "editar no cambia el sentido ni la referencia aunque lleguen",
      trasDeMas?.sentido === "debo" && trasDeMas.referencia === referenciaAntes,
    );
    const idNoUnoAUno = idDePrueba();
    const noUnoAUno = await lanza(() =>
      pagarDeuda(idNoUnoAUno, {
        ...salda,
        montoUsdCentavos: salda.montoCentavos - 1,
        referenciaExterna: referenciaDeCaptura(idNoUnoAUno, "pago"),
      }),
    );
    comprobar("3", "un pago que no vale 1 a 1 en USD lo frena la escritura", noUnoAUno);
    const conMovimientos = await borrarDeuda(papas);
    comprobar("16", "una deuda con movimientos no se borra", "conMovimientos" in conMovimientos);
    const suelta = await registrarDeuda(idDePrueba(), deuda({ persona: "Suelta (comprobar-005)" }));
    const borrada = suelta.nueva ? await borrarDeuda(suelta.id) : null;
    comprobar("16", "una deuda sin movimientos se borra", borrada !== null && "ok" in borrada);

    // El escritor frena un pago a algo que me deben (guardian-datos, T5)
    const meDeben = await registrarDeuda(
      idDePrueba(),
      deuda({ sentido: "me_deben", persona: "Luis (comprobar-005)", monto: "140" }),
    );
    if (!meDeben.nueva) throw new Error("No se registró lo que me deben");
    const idMal = idDePrueba();
    const aMeDeben = await lanza(() =>
      pagarDeuda(idMal, {
        ...pago1,
        deudaId: meDeben.id,
        montoCentavos: 100,
        montoUsdCentavos: 100,
        referenciaExterna: referenciaDeCaptura(idMal, "pago"),
      }),
    );
    comprobar("3", "un pago a algo que me deben lo frena la escritura", aMeDeben);

    // ★ 11 y 12 · con deudas con fecha, Deudas entra en el reparto como la primera fija, con su cuota calculada
    const enDosMeses = inicioDeMes(hoy, 2).replace(/01$/, "15");
    await registrarDeuda(idDePrueba(), deuda({ persona: "Amigo (comprobar-005)", monto: "250", fechaPrevista: hoy }));
    await registrarDeuda(idDePrueba(), deuda({ fechaPrevista: enDosMeses }));
    const cuota = await cuotaDelMes();
    const reparto = await datosDelReparto();
    const [primera, ...resto] = reparto.reglas;
    comprobar(
      "12",
      "la regla de Deudas va primero, fija, con la cuota del mes y su pista",
      !!cuota &&
        cuota.cuotaCentavos > 0 &&
        primera?.sobreId === deudasSobre.id &&
        primera.tipo === "fijo" &&
        primera.valor === cuota.cuotaCentavos &&
        primera.cuota?.vencimiento === hoy &&
        resto.every((r) => r.orden > primera.orden),
      `cuota ${cuota?.cuotaCentavos}`,
    );
    const [{ filasDeDeudas }] = await db
      .select({ filasDeDeudas: count() })
      .from(reglasReparto)
      .where(eq(reglasReparto.sobreId, deudasSobre.id));
    comprobar("12", "Deudas no tiene fila en reglas_reparto", filasDeDeudas === 0);
    const propuesta = proponerReparto({
      monto: 120_000,
      reglas: reparto.reglas,
      recibidoEnElMes: reparto.recibidoPorMes[hoy.slice(0, 7)] ?? {},
      saldos: Object.fromEntries(reparto.reglas.map((r) => [r.sobreId, r.saldoCentavos])),
    });
    const aDeudas = propuesta.asignaciones.find((a) => a.sobreId === deudasSobre.id)?.centavos ?? 0;
    const recibidoDeudas = reparto.recibidoPorMes[hoy.slice(0, 7)]?.[deudasSobre.id] ?? 0;
    comprobar(
      "12",
      "un cobro de 1.200,00 propone a Deudas su cuota menos lo recibido en el mes",
      !!cuota && aDeudas === Math.min(120_000, Math.max(0, cuota.cuotaCentavos - recibidoDeudas)),
      `${aDeudas}`,
    );

    // ★ 9 · las sumas de SQL son las de saldosTras, con todos los tipos en la base
    comprobar("9", "las sumas de SQL son iguales a saldosTras sobre todas las filas", await sqlIgualASaldosTras());
    const final = await estado();
    comprobar("9", "tras registrar, apartar y pagar, sigue en Cuadra", final.cuadra, cuadra(final));
  } finally {
    await limpiar();
    const final = await estado();
    comprobar(
      "—",
      "la base queda como estaba: mismos saldos, movimientos y deudas",
      huella(final) === huella(inicial) &&
        final.filas === inicial.filas &&
        final.cuantasDeudas === inicial.cuantasDeudas,
      `${final.filas} movimientos, ${final.cuantasDeudas} deudas`,
    );
  }
}

main()
  .then(() => {
    console.log(fallos === 0 ? "✓ comprobar-005: todo en verde" : `✗ comprobar-005: ${fallos} comprobaciones fallaron`);
    process.exit(fallos === 0 ? 0 : 1);
  })
  .catch((error) => {
    console.error("✗ comprobar-005:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
