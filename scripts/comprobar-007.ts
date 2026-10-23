/**
 * Los criterios ★ de la spec 007 contra la base, escritos desde su texto al verificar:
 *   ★ 1 · un pago o un cobro se abre para deshacerlo, con lo que fue; nada más se abre así;
 *   ★ 2 · deshacer un pago devuelve el dinero a su cuenta y al sobre Deudas, y la deuda recupera ese pendiente; deshacer
 *         un cobro lo saca de la cuenta y de Por asignar; con el candado de la deuda y el de Por asignar, deshacer y
 *         pagar, o deshacer y repartir, a la vez, nunca dejan nada en negativo;
 *   ★ 11 · si Por asignar ya lo repartió, la vista previa dice qué se retira del reparto de después y cómo queda todo,
 *         y solo se aplica con su firma: sin ella o si algo cambió, no se toca nada; si lo que falta salió con Mover,
 *         no se deshace y dice cuánto devolver;
 *   ★ 3 · el cuadre se mantiene, y una deuda pagada o un préstamo cobrado vuelve a abierta;
 *   ★ 7 · mover guarda una reasignación de hoy entre dos sobres, de 0,01 al saldo del origen, y nunca lo deja en
 *         negativo, tampoco con dos movimientos a la vez ni con un reparto a la vez;
 *   ★ 9 · un reintento con el mismo id no duplica, aunque el primero haya vaciado el origen.
 * El ★ 6 (las etiquetas con # en la nota) lo reemplazó la spec 008; su ★ 5 lo verifica. El ★ 8 (la confirmación al
 * sacar de Inversión) lo prueba src/lib/mover.test.ts. La sesión y conFallas del ★ 9 los miran, sobre todas las
 * acciones, src/app/sesion.criterios.test.ts, src/app/fallas.criterios.test.ts y scripts/comprobar-002-servidor.ts.
 * Corre sobre la base local con los datos de demostración y la deja como estaba:
 *   pnpm exec tsx scripts/comprobar-007.ts
 * Lo de las revisiones (lo recibido neto, el candado del pago y las páginas sin JavaScript) está en
 * scripts/comprobar-007-revision.ts.
 * Lo suyo son capturas cuyo id empieza por 0c070007, que se borran al terminar y, si una corrida se cortó, al
 * empezar la siguiente. Se niega ante movimientos o deudas que no sean de demostración.
 */
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { count, eq, inArray, isNull, like, not, or } from "drizzle-orm";
import { referenciaDeCaptura, referenciaDeMover, referenciaDeReasignacion } from "../src/lib/captura";
import { exigirBaseLocal } from "../src/lib/destino-base";
import { centavosATexto } from "../src/lib/dinero";
import { type DeudaParaSaldar, prepararPago, validarDeuda } from "../src/lib/deudas";
import { hoyEnCaracas } from "../src/lib/fechas";
import { prepararIngreso } from "../src/lib/ingresos";
import { prepararMover } from "../src/lib/mover";
import { prepararCobro, prepararPrestamo } from "../src/lib/prestamos";

const MARCA = "0c070007";
let fallos = 0;

function comprobar(criterio: string, descripcion: string, ok: boolean, detalle = "") {
  if (!ok) fallos++;
  console.log(`${ok ? "✓" : "✗"} ${criterio} · ${descripcion}${detalle ? ` (${detalle})` : ""}`);
}

const idDePrueba = () => `${MARCA}${randomUUID().slice(8)}`;

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
  exigirBaseLocal(process.env.DATABASE_URL, "comprobar-007");
  const { db, deudas, movimientos } = await import("../src/db/index");
  const { saldosPorCuenta, saldosPorSobre } = await import("../src/db/consultas");
  const { categoriasDeIngresoPorUso } = await import("../src/db/reparto");
  const { registrarCaptura, repartirPorAsignar } = await import("../src/db/movimientos");
  const { moverEntreSobres } = await import("../src/db/mover");
  const { deudaPorId, sobreDeudas } = await import("../src/db/deudas");
  const { cobrarPrestamo, pagarDeuda, prestar, registrarDeuda } = await import("../src/db/guardar-deudas");
  const { deshacerPagoOCobro, pagoOCobroParaDeshacer } = await import("../src/db/deshacer-pago");

  const movimientosNuestros = like(movimientos.referenciaExterna, `captura-${MARCA}-%`);
  const deudasNuestras = like(deudas.referencia, `captura-${MARCA}-%`);
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
    const [c, s, [{ filas }]] = await Promise.all([
      saldosPorCuenta(),
      saldosPorSobre(),
      db.select({ filas: count() }).from(movimientos),
    ]);
    const totalCuentas = c.reduce((a, x) => a + x.saldoUsdCentavos, 0);
    const totalSobres = s.reduce((a, x) => a + x.saldoCentavos, 0);
    const huella = JSON.stringify([c.map((x) => [x.id, x.saldoCentavos]), s.map((x) => [x.id, x.saldoCentavos])]);
    return { cuentas: c, sobres: s, filas, cuadra: totalCuentas === totalSobres, huella, totalCuentas, totalSobres };
  }
  type Estado = Awaited<ReturnType<typeof estado>>;
  const enSobre = (e: Estado, id: number) => e.sobres.find((s) => s.id === id)?.saldoCentavos ?? NaN;
  async function cuadra(paso: string) {
    const e = await estado();
    comprobar("3", `Cuadra ${paso}`, e.cuadra, `sobres ${e.totalSobres}, cuentas ${e.totalCuentas}`);
    return e;
  }

  const inicial = await estado();
  const hoy = hoyEnCaracas(new Date());
  const binance = inicial.cuentas.find((c) => c.nombre === "Binance");
  const prima = inicial.cuentas.find((c) => c.nombre === "Cuenta prima");
  const porAsignar = inicial.sobres.find((s) => s.tipo === "por_asignar");
  const gastosDelMes = inicial.sobres.find((s) => s.tipo === "gastos");
  const planes = inicial.sobres.find((s) => s.nombre === "Planes");
  const inversion = inicial.sobres.find((s) => s.tipo === "inversion");
  const deudasSobre = await sobreDeudas();
  const [sueldo] = await categoriasDeIngresoPorUso();
  if (!binance || !prima || !porAsignar || !gastosDelMes || !planes || !inversion || !deudasSobre || !sueldo) {
    throw new Error("Faltan datos base: corre pnpm db:seed y pnpm db:demo");
  }
  const enDolares = inicial.cuentas.filter((c) => c.moneda !== "VES");
  const cuentaBinance = { id: binance.id, moneda: binance.moneda };
  const validos = inicial.sobres.filter((s) => s.tipo !== "por_asignar").map((s) => s.id);
  console.log(`Base local · hoy en Caracas ${hoy} · ${inicial.filas} movimientos`);
  comprobar("3", "al empezar, Cuadra", inicial.cuadra);

  const idDeReferencia = async (referencia: string) =>
    (await db.select({ id: movimientos.id }).from(movimientos).where(eq(movimientos.referenciaExterna, referencia)))[0]
      ?.id ?? null;
  const pendiente = async (deudaId: number) => (await deudaPorId(deudaId))?.pendienteCentavos ?? NaN;

  async function deuda(monto: string) {
    const r = validarDeuda(
      {
        sentido: "debo",
        persona: "Prueba (comprobar-007)",
        monto,
        fechaPrevista: "",
        cuentaPrevistaId: binance!.id,
        nota: "",
      },
      enDolares,
    );
    if (!r.ok) throw new Error(`validarDeuda rechazó: ${Object.keys(r.errores).join(", ")}`);
    const g = await registrarDeuda(idDePrueba(), r.deuda);
    if (!g.nueva) throw new Error("La deuda no se registró");
    return g.id;
  }
  /** La fila de un pago contra lo que la deuda debe hoy, o contra `comoSi` para probar el candado. */
  async function filaDePago(captura: string, deudaId: number, monto: string, comoSi?: Partial<DeudaParaSaldar>) {
    const actual = await deudaPorId(deudaId);
    if (!actual) throw new Error("La deuda no existe");
    const r = prepararPago(
      { monto, fecha: hoy, nota: "", cuenta: cuentaBinance },
      { ...actual, ...comoSi },
      deudasSobre!.id,
      hoy,
    );
    if (!r.ok) throw new Error(`prepararPago rechazó ${monto}: ${Object.keys(r.errores).join(", ")}`);
    return { ...r.fila, referenciaExterna: referenciaDeCaptura(captura, "pago") };
  }
  async function pagar(deudaId: number, monto: string) {
    const captura = idDePrueba();
    await pagarDeuda(captura, await filaDePago(captura, deudaId, monto));
    const id = await idDeReferencia(referenciaDeCaptura(captura, "pago"));
    if (!id) throw new Error("El pago no se registró");
    return id;
  }
  async function prestamo(monto: string) {
    const captura = idDePrueba();
    const p = prepararPrestamo(
      {
        persona: "Préstamo (comprobar-007)",
        monto,
        fecha: "hoy",
        fechaPrevista: "",
        nota: "",
        cuenta: cuentaBinance,
        sobreOrigenId: gastosDelMes!.id,
      },
      inicial.sobres,
      hoy,
    );
    if (!p.ok) throw new Error(`prepararPrestamo rechazó: ${Object.keys(p.errores).join(", ")}`);
    const r = await prestar(captura, p.deuda, {
      ...p.fila,
      referenciaExterna: referenciaDeCaptura(captura, "prestamo"),
    });
    if (!("deudaId" in r)) throw new Error("El préstamo no se registró");
    return r.deudaId;
  }
  async function cobrar(deudaId: number, monto: string) {
    const actual = await deudaPorId(deudaId);
    if (!actual) throw new Error("El préstamo no existe");
    const captura = idDePrueba();
    const c = prepararCobro({ monto, fecha: "hoy", nota: "", cuenta: cuentaBinance }, actual, porAsignar!.id, hoy);
    if (!c.ok) throw new Error(`prepararCobro rechazó ${monto}: ${Object.keys(c.errores).join(", ")}`);
    await cobrarPrestamo(captura, { ...c.fila, referenciaExterna: referenciaDeCaptura(captura, "cobro") });
    const id = await idDeReferencia(referenciaDeCaptura(captura, "cobro"));
    if (!id) throw new Error("El cobro no se registró");
    return id;
  }
  /** Un ingreso a Por asignar sin reparto, con su captura: así entra dinero para las pruebas. */
  async function ingreso(centavos: number) {
    const captura = idDePrueba();
    const p = prepararIngreso(
      {
        monto: centavosATexto(centavos),
        fecha: hoy,
        nota: "comprobar-007",
        categoriaId: sueldo.id,
        porAsignarId: porAsignar!.id,
        sobresValidos: validos,
        asignaciones: [],
      },
      hoy,
      { id: prima!.id, moneda: prima!.moneda },
    );
    if (!p.ok) throw new Error(`prepararIngreso rechazó: ${JSON.stringify(p.errores)}`);
    await registrarCaptura(
      captura,
      p.filas.map((f) => ({ ...f, referenciaExterna: referenciaDeCaptura(captura, "ingreso") })),
    );
  }
  /** La fila de mover, preparada como en /nuevo/mover contra un saldo sin tope: la base es la que vuelve a mirar. */
  /** La reasignación como la prepara Mover; con la referencia de Mover, o con la del reparto para Repartir. */
  function filaDeMover(captura: string, origen: number, destino: number, centavos: number, comoReparto = false) {
    const sinTope = inicial.sobres.map((s) => ({ ...s, saldoCentavos: Number.MAX_SAFE_INTEGER }));
    const p = prepararMover(
      {
        monto: centavosATexto(centavos),
        origenId: origen,
        destinoId: destino,
        nota: "comprobar-007",
        confirmaInversion: true,
      },
      sinTope,
      hoy,
    );
    if (p.estado !== "ok") throw new Error(`prepararMover no dio una fila: ${JSON.stringify(p)}`);
    const referenciaExterna = comoReparto
      ? referenciaDeReasignacion(captura, destino)
      : referenciaDeMover(captura, destino);
    return { ...p.fila, referenciaExterna };
  }
  const mover = (origen: number, destino: number, centavos: number, captura = idDePrueba()) =>
    moverEntreSobres(captura, filaDeMover(captura, origen, destino, centavos));
  const repartir = (centavos: number, destino: number) => {
    const captura = idDePrueba();
    return repartirPorAsignar(captura, porAsignar!.id, [
      { ...filaDeMover(captura, porAsignar!.id, destino, centavos, true) },
    ]);
  };
  /** Deja un sobre con exactamente `centavos`, moviendo desde o hacia Por asignar (con un ingreso si hace falta). */
  async function sobreEn(id: number, centavos: number) {
    const ahora = enSobre(await estado(), id);
    if (ahora > centavos) {
      if (id === porAsignar!.id) await repartir(ahora - centavos, planes!.id);
      else await mover(id, porAsignar!.id, ahora - centavos);
    } else if (ahora < centavos) {
      await ingreso(centavos - ahora);
      if (id !== porAsignar!.id) await mover(porAsignar!.id, id, centavos - ahora);
    }
    const despues = enSobre(await estado(), id);
    if (despues !== centavos) throw new Error(`El sobre ${id} quedó en ${despues}, no en ${centavos}`);
  }
  const ganoUno = (r: object) => ("nueva" in r && r.nueva === true) || ("ok" in r && r.ok === true);

  try {
    // ★ 1 · un pago o un cobro se abre para deshacerlo
    const p = await prestamo("50");
    const d = await deuda("100");
    const antesDelPago = await estado();
    const pagoId = await pagar(d, "40");
    const antesDelCobro = await estado();
    const cobroId = await cobrar(p, "20");
    const vistoPago = await pagoOCobroParaDeshacer(pagoId);
    const vistoCobro = await pagoOCobroParaDeshacer(cobroId);
    comprobar(
      "1",
      "el pago y el cobro se abren con lo que fueron: tipo, monto, persona y cuenta",
      vistoPago?.tipo === "pago_deuda" &&
        vistoPago.montoCentavos === 4000 &&
        vistoPago.persona === "Prueba (comprobar-007)" &&
        vistoPago.cuenta === "Binance" &&
        vistoCobro?.tipo === "cobro_prestamo" &&
        vistoCobro.montoCentavos === 2000,
    );
    const prestamoId = await idDeReferencia(
      (await db.select({ r: deudas.referencia }).from(deudas).where(eq(deudas.id, p)))[0]?.r?.replace(
        /deuda$/,
        "prestamo",
      ) ?? "",
    );
    const otros = await db
      .selectDistinctOn([movimientos.tipo], { id: movimientos.id })
      .from(movimientos)
      .where(not(inArray(movimientos.tipo, ["pago_deuda", "cobro_prestamo"])));
    let abiertos = 0;
    for (const o of [...otros, { id: prestamoId ?? 0 }]) if ((await pagoOCobroParaDeshacer(o.id)) !== null) abiertos++;
    comprobar("1", "ningún otro tipo se abre para deshacer, tampoco el préstamo", abiertos === 0 && otros.length >= 4);
    const otroPorId = await deshacerPagoOCobro(otros[0].id);
    comprobar("1", "deshacer por id algo que no es pago ni cobro responde que no existe", "noExiste" in otroPorId);

    // ★ 2 y 3 · deshacer el cobro y el pago, en orden inverso: cada uno deja todo como antes de registrarlo
    comprobar(
      "2",
      "con el cobro, el préstamo debe 30; con el pago, la deuda debe 60",
      (await pendiente(p)) === 3000 && (await pendiente(d)) === 6000,
    );
    const rCobro = await deshacerPagoOCobro(cobroId);
    const trasCobro = await cuadra("tras deshacer el cobro");
    comprobar(
      "2",
      "deshacer el cobro saca el dinero de la cuenta y de Por asignar: cuentas y sobres como antes del cobro",
      "ok" in rCobro && rCobro.ok && rCobro.deudaId === p && trasCobro.huella === antesDelCobro.huella,
    );
    comprobar("2", "y el préstamo vuelve a deber 50", (await pendiente(p)) === 5000);
    const rPago = await deshacerPagoOCobro(pagoId);
    const trasPago = await cuadra("tras deshacer el pago");
    comprobar(
      "2",
      "deshacer el pago devuelve el dinero a la cuenta y al sobre Deudas: cuentas y sobres como antes del pago",
      "ok" in rPago && rPago.ok && rPago.deudaId === d && trasPago.huella === antesDelPago.huella,
    );
    comprobar("2", "y la deuda vuelve a deber 100", (await pendiente(d)) === 10000);
    comprobar(
      "2",
      "deshacer otra vez responde que no existe, sin error",
      "noExiste" in (await deshacerPagoOCobro(cobroId)),
    );

    // ★ 11 · un cobro ya repartido: se ve antes lo que se retira, y solo se aplica con la firma de esa vista previa
    const cobro2 = await cobrar(p, "20");
    await sobreEn(porAsignar.id, 1500);
    const antesDeRetirar = await estado();
    const rSinFirma = await deshacerPagoOCobro(cobro2);
    comprobar(
      "11",
      "sin la firma de la vista previa no se deshace: pide volver a mirarla, y no toca nada",
      "cambio" in rSinFirma && (await estado()).huella === antesDeRetirar.huella,
    );
    const previa2 = (await pagoOCobroParaDeshacer(cobro2))?.previa;
    const despuesEn = (nombre: string) => previa2?.saldos.find((x) => x.nombre === nombre)?.despues;
    comprobar(
      "11",
      "la vista previa retira 5,00 de Planes, lo último repartido, y deja Por asignar en 0,00",
      previa2?.retirado.length === 1 &&
        previa2.retirado[0].sobreId === planes.id &&
        previa2.retirado[0].centavos === 500 &&
        despuesEn(porAsignar.nombre) === 0 &&
        despuesEn(planes.nombre) === enSobre(antesDeRetirar, planes.id) - 500,
      JSON.stringify(previa2?.saldos),
    );
    // Algo cambia entre mirar y confirmar: un reparto nuevo es ahora lo último repartido.
    await repartir(100, gastosDelMes.id);
    const antesDeCambio = (await estado()).huella;
    const rViejo = await deshacerPagoOCobro(cobro2, previa2?.firma ?? "");
    comprobar(
      "11",
      "con la firma de una vista previa que ya no vale, no se aplica",
      "cambio" in rViejo && (await estado()).huella === antesDeCambio,
    );
    const previa3 = (await pagoOCobroParaDeshacer(cobro2))?.previa;
    const rSi = await deshacerPagoOCobro(cobro2, previa3?.firma ?? "");
    const trasRetirar = await cuadra("tras deshacer un cobro ya repartido");
    const comoSeVio = (previa3?.saldos ?? []).every(
      (x) =>
        [...trasRetirar.cuentas, ...trasRetirar.sobres].find((y) => y.nombre === x.nombre)?.saldoCentavos === x.despues,
    );
    comprobar(
      "11",
      "con la firma de la vista previa de ahora se deshace, y todo queda como ella mostró",
      "ok" in rSi && rSi.ok && enSobre(trasRetirar, porAsignar.id) === 0 && comoSeVio,
      JSON.stringify(previa3?.saldos),
    );
    // Lo que falta salió con Mover, que no es reparto: no hay qué retirar.
    const cobro3 = await cobrar(p, "20");
    await mover(porAsignar.id, planes.id, 500);
    const antesDeNegar = (await estado()).huella;
    const rNo = await deshacerPagoOCobro(cobro3);
    const sinRetiro =
      "Por asignar tiene 15,00; le faltan 5,00, y lo repartido después solo cubre 0,00: lo demás salió con Mover o con un préstamo. Devuelve 5,00 a Por asignar con Mover y vuelve a intentarlo.";
    const visto3 = await pagoOCobroParaDeshacer(cobro3);
    comprobar(
      "11",
      "si lo que falta salió con Mover, no se deshace, lo dice antes y dice cuánto devolver",
      "ok" in rNo && !rNo.ok && rNo.error === sinRetiro && visto3?.impedido === sinRetiro && visto3.previa === null,
      "error" in rNo ? rNo.error : "",
    );
    comprobar("11", "y el cobro sigue ahí, sin cambios", visto3 !== null && (await estado()).huella === antesDeNegar);

    // ★ 3 · pagada o cobrada vuelve a abierta
    const d2 = await deuda("100");
    const pagoEntero = await pagar(d2, "100");
    const pagada = (await deudaPorId(d2))?.estado;
    await deshacerPagoOCobro(pagoEntero);
    const reabierta = await deudaPorId(d2);
    comprobar(
      "3",
      "una deuda pagada vuelve a abierta, con todo su pendiente",
      pagada === "pagada" && reabierta?.estado === "abierta" && reabierta.pendienteCentavos === 10000,
    );
    const p3 = await prestamo("30");
    const cobroEntero = await cobrar(p3, "30");
    const cobrada = (await deudaPorId(p3))?.estado;
    await deshacerPagoOCobro(cobroEntero);
    const reabierto = await deudaPorId(p3);
    comprobar(
      "3",
      "un préstamo cobrado vuelve a abierto, con todo su pendiente",
      cobrada === "pagada" && reabierto?.estado === "abierta" && reabierto.pendienteCentavos === 3000,
    );
    await cuadra("tras reabrir la deuda y el préstamo");

    // ★ 2 · carreras: deshacer un cobro contra repartir, y deshacer un pago contra otro pago
    const p4 = await prestamo("200");
    let malCobro = 0;
    for (let ronda = 0; ronda < 4; ronda++) {
      const c = await cobrar(p4, "20");
      await sobreEn(porAsignar.id, 2000);
      const [rD, rR] = await Promise.all([deshacerPagoOCobro(c), repartir(1000, planes.id)]);
      const saldo = enSobre(await estado(), porAsignar.id);
      if (ganoUno(rD) === ganoUno(rR) || saldo < 0) malCobro++;
    }
    comprobar(
      "2",
      "cuatro carreras de deshacer un cobro contra un reparto, con 20 en Por asignar: gana uno solo",
      malCobro === 0,
      `${malCobro} mal`,
    );
    let malPago = 0;
    for (let ronda = 0; ronda < 4; ronda++) {
      const d3 = await deuda("100");
      const pago40 = await pagar(d3, "40");
      const captura = idDePrueba();
      // Un pago de 70 preparado como si la deuda debiera 100: solo cabe si el deshacer va primero.
      const fila70 = await filaDePago(captura, d3, "70", { pendienteCentavos: 10000 });
      await Promise.all([deshacerPagoOCobro(pago40), pagarDeuda(captura, fila70)]);
      const queda = await deudaPorId(d3).catch(() => null);
      if (!queda || (queda.pendienteCentavos !== 10000 && queda.pendienteCentavos !== 3000)) malPago++;
    }
    comprobar(
      "2",
      "cuatro carreras de deshacer un pago contra otro pago: la deuda nunca queda pagada de más",
      malPago === 0,
      `${malPago} mal`,
    );
    await cuadra("tras las carreras de deshacer");

    // ★ 7 · mover entre sobres
    await sobreEn(planes.id, 10000);
    const antesDeMover = await estado();
    const captura = idDePrueba();
    const r1 = await mover(planes.id, gastosDelMes.id, 1000, captura);
    const [movida] = await db
      .select()
      .from(movimientos)
      .where(eq(movimientos.referenciaExterna, referenciaDeMover(captura, gastosDelMes.id)));
    const trasMover = await cuadra("tras mover 10 de Planes a Gastos del mes");
    comprobar(
      "7",
      "se guarda una reasignación de hoy de Planes a Gastos del mes por 10,00, con su nota",
      ganoUno(r1) &&
        movida?.tipo === "reasignacion" &&
        movida.fecha === hoy &&
        movida.sobreOrigenId === planes.id &&
        movida.sobreDestinoId === gastosDelMes.id &&
        movida.montoUsdCentavos === 1000 &&
        movida.nota === "comprobar-007",
    );
    comprobar(
      "7",
      "el origen baja 10 y el destino sube 10",
      enSobre(trasMover, planes.id) === enSobre(antesDeMover, planes.id) - 1000 &&
        enSobre(trasMover, gastosDelMes.id) === enSobre(antesDeMover, gastosDelMes.id) + 1000,
    );
    const rDeMas = await mover(planes.id, gastosDelMes.id, 9001);
    comprobar(
      "7",
      "más que el saldo del origen: la base vuelve a mirar y no guarda",
      "sinSaldo" in rDeMas && rDeMas.saldoCentavos === 9000 && (await estado()).huella === trasMover.huella,
    );
    const rTodo = await mover(planes.id, gastosDelMes.id, 9000);
    comprobar(
      "7",
      "justo el saldo sí, y el origen queda en 0",
      ganoUno(rTodo) && enSobre(await estado(), planes.id) === 0,
    );
    comprobar("7", "con el origen en 0, ni 0,01", "sinSaldo" in (await mover(planes.id, gastosDelMes.id, 1)));
    const capturaMal = idDePrueba();
    comprobar(
      "7",
      "al mismo sobre, o a un sobre que no existe, la base no lo acepta",
      (await lanza(() =>
        moverEntreSobres(capturaMal, {
          ...filaDeMover(capturaMal, gastosDelMes.id, planes.id, 100),
          sobreDestinoId: gastosDelMes.id,
        }),
      )) && (await lanza(() => mover(gastosDelMes.id, 2_147_483_000, 100))),
    );
    let malMover = 0;
    for (let ronda = 0; ronda < 4; ronda++) {
      await sobreEn(planes.id, 10000);
      const [a, b] = await Promise.all([mover(planes.id, gastosDelMes.id, 6000), mover(planes.id, inversion.id, 6000)]);
      if (ganoUno(a) === ganoUno(b) || enSobre(await estado(), planes.id) !== 4000) malMover++;
    }
    comprobar(
      "7",
      "cuatro pares de movimientos de 60 a la vez desde 100: solo cabe uno y el origen queda en 40",
      malMover === 0,
      `${malMover} mal`,
    );
    let malConReparto = 0;
    for (let ronda = 0; ronda < 4; ronda++) {
      await sobreEn(porAsignar.id, 2000);
      const [a, b] = await Promise.all([mover(porAsignar.id, gastosDelMes.id, 1500), repartir(1000, planes.id)]);
      if (ganoUno(a) === ganoUno(b) || enSobre(await estado(), porAsignar.id) < 0) malConReparto++;
    }
    comprobar(
      "7",
      "cuatro carreras de mover desde Por asignar contra un reparto: gana uno solo",
      malConReparto === 0,
      `${malConReparto} mal`,
    );
    await cuadra("tras mover");

    // ★ 9 · el mismo id no duplica, aunque el primero haya vaciado el origen
    await sobreEn(planes.id, 5000);
    const repetida = idDePrueba();
    const fila = filaDeMover(repetida, planes.id, gastosDelMes.id, 5000);
    const primera = await moverEntreSobres(repetida, fila);
    const segunda = await moverEntreSobres(repetida, fila);
    const filasDeLaCaptura = await db
      .select({ id: movimientos.id })
      .from(movimientos)
      .where(like(movimientos.referenciaExterna, `captura-${repetida}-%`));
    comprobar(
      "9",
      "reintentar con el mismo id devuelve lo guardado, no 'sin saldo', y hay una sola fila",
      ganoUno(primera) && "nueva" in segunda && segunda.nueva === false && filasDeLaCaptura.length === 1,
    );
    await cuadra("tras el reintento");
  } finally {
    await limpiar();
  }

  const final = await estado();
  comprobar(
    "3",
    "al terminar, la base queda como estaba",
    final.huella === inicial.huella && final.filas === inicial.filas,
  );
  console.log(fallos === 0 ? "\n✓ comprobar-007: todo en verde" : `\n✗ comprobar-007: ${fallos} fallos`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
