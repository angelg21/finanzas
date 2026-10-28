/**
 * El criterio 11 de la spec 007 contra la base: deshacer un cobro o borrar un ingreso ya repartidos quita su lote de
 * Por asignar con lo que se repartió con ese dinero (primero en entrar, primero en salir), lo muestra antes y solo se
 * aplica con la firma de esa vista previa. Lo que importa es que quede todo como si no hubiera pasado: los saldos de
 * cuentas y sobres, lo que el reparto cuenta como recibido en cada mes y la cuota de Deudas. Escenarios:
 *   · uno: sin firma no se toca nada; la vista previa es lo que queda; una firma vieja no se aplica;
 *   · lo movido con su dinero se retira; ir y volver con Mover no deja nada; lo prestado impide deshacer y se dice;
 *   · el reparto propio de otro ingreso no se retira, y ese ingreso se sigue borrando entero (guardian-datos);
 *   · dos cobros (con un Mover en medio), y dos ingresos, deshechos en el orden de registro y al revés: los dos
 *     órdenes, neutros (sexta revisión, hallazgo 1; guardian-datos, N1);
 *   · un saldo que cambia entre la vista previa y la confirmación, con retiro o sin él (guardian, hallazgo 2; sexta
 *     revisión, hallazgo 3), y la carrera con un Mover desde el sobre retirado;
 *   · Por asignar con dinero de antes del cobro: se retira solo lo que se repartió con el del cobro.
 * Corre sobre la base local con los datos de demostración y la deja como estaba:
 *   pnpm exec tsx scripts/comprobar-007-retiro.ts
 * Lo suyo son capturas cuyo id empieza por 0c070011, que se borran al terminar y, si una corrida se cortó, al
 * empezar la siguiente. Se niega ante movimientos o deudas que no sean de demostración.
 */
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { count, eq, isNull, like, not, or } from "drizzle-orm";
import { referenciaDeCaptura, referenciaDeMover, referenciaDeReasignacion } from "../src/lib/captura";
import { exigirBaseLocal } from "../src/lib/destino-base";
import { centavosATexto } from "../src/lib/dinero";
import { hoyEnCaracas } from "../src/lib/fechas";
import { prepararIngreso } from "../src/lib/ingresos";
import { prepararMover } from "../src/lib/mover";
import { prepararCobro, prepararPrestamo } from "../src/lib/prestamos";

const MARCA = "0c070011";
let fallos = 0;

function comprobar(descripcion: string, ok: boolean, detalle = "") {
  if (!ok) fallos++;
  console.log(`${ok ? "✓" : "✗"} 11 · ${descripcion}${detalle ? ` (${detalle})` : ""}`);
}

const idDePrueba = () => `${MARCA}${randomUUID().slice(8)}`;

async function main() {
  config({ path: ".env.local" });
  // Escribe filas: solo en la base local (spec 002, criterio 10).
  exigirBaseLocal(process.env.DATABASE_URL, "comprobar-007-retiro");
  const { db, deudas, movimientos } = await import("../src/db/index");
  const { saldosPorCuenta, saldosPorSobre } = await import("../src/db/consultas");
  const { categoriasDeIngresoPorUso, cuotaDelMes, recibidoDesdePorAsignarPorMes } = await import("../src/db/reparto");
  const { registrarCaptura, repartirPorAsignar } = await import("../src/db/movimientos");
  const { moverEntreSobres } = await import("../src/db/mover");
  const { deudaPorId } = await import("../src/db/deudas");
  const { cobrarPrestamo, prestar } = await import("../src/db/guardar-deudas");
  const { deshacerPagoOCobro, pagoOCobroParaDeshacer } = await import("../src/db/deshacer-pago");
  const { borrarIngreso, vistaPreviaDeBorrado } = await import("../src/db/borrar-ingreso");
  const { movimientoParaEditar } = await import("../src/db/editar-movimientos");

  async function limpiar() {
    await db.delete(movimientos).where(like(movimientos.referenciaExterna, `captura-${MARCA}-%`));
    await db.delete(deudas).where(like(deudas.referencia, `captura-${MARCA}-%`));
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
    const cuadra = c.reduce((a, x) => a + x.saldoUsdCentavos, 0) === s.reduce((a, x) => a + x.saldoCentavos, 0);
    const huella = JSON.stringify([c.map((x) => [x.id, x.saldoCentavos]), s.map((x) => [x.id, x.saldoCentavos])]);
    return { cuentas: c, sobres: s, filas, cuadra, huella };
  }
  type Estado = Awaited<ReturnType<typeof estado>>;
  const enSobre = (e: Estado, id: number) => e.sobres.find((s) => s.id === id)?.saldoCentavos ?? NaN;
  /** Todo lo que deshacer debe dejar como estaba: saldos, lo recibido del reparto por mes y la cuota de Deudas. */
  async function comoQueda() {
    const [e, recibido, cuota] = await Promise.all([estado(), recibidoDesdePorAsignarPorMes(), cuotaDelMes()]);
    return JSON.stringify({ huella: e.huella, recibido, cuota: cuota?.cuotaCentavos ?? null, cuadra: e.cuadra });
  }

  const inicial = await estado();
  const inicio = await comoQueda();
  const hoy = hoyEnCaracas(new Date());
  const binance = inicial.cuentas.find((c) => c.nombre === "Binance");
  const prima = inicial.cuentas.find((c) => c.nombre === "Cuenta prima");
  const porAsignar = inicial.sobres.find((s) => s.tipo === "por_asignar");
  const gastosDelMes = inicial.sobres.find((s) => s.tipo === "gastos");
  const planes = inicial.sobres.find((s) => s.nombre === "Planes");
  const familia = inicial.sobres.find((s) => s.nombre === "Familia");
  const ocasiones = inicial.sobres.find((s) => s.nombre === "Ocasiones");
  const deudasSobre = inicial.sobres.find((s) => s.tipo === "deudas");
  const [sueldo] = await categoriasDeIngresoPorUso();
  if (!binance || !prima || !porAsignar || !gastosDelMes || !planes || !familia || !ocasiones || !deudasSobre) {
    throw new Error("Faltan datos base: corre pnpm db:seed y pnpm db:demo");
  }
  if (!sueldo) throw new Error("Falta una categoría de ingreso: corre pnpm db:seed");
  const cuentaBinance = { id: binance.id, moneda: binance.moneda };
  const validos = inicial.sobres.filter((s) => s.tipo !== "por_asignar").map((s) => s.id);
  console.log(`Base local · hoy en Caracas ${hoy} · ${inicial.filas} movimientos`);

  const idDeReferencia = async (referencia: string) =>
    (await db.select({ id: movimientos.id }).from(movimientos).where(eq(movimientos.referenciaExterna, referencia)))[0]
      ?.id ?? null;
  async function prestamo(monto: string, origenId = gastosDelMes!.id) {
    const captura = idDePrueba();
    const p = prepararPrestamo(
      {
        persona: "Préstamo (comprobar-007-retiro)",
        monto,
        fecha: "hoy",
        fechaPrevista: "",
        nota: "",
        cuenta: cuentaBinance,
        sobreOrigenId: origenId,
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
  /** Un ingreso a Por asignar, con su reparto si se le da, con las referencias de /nuevo/ingreso. */
  async function ingreso(centavos: number, asignaciones: { sobreId: number; monto: string }[] = []) {
    const captura = idDePrueba();
    const p = prepararIngreso(
      {
        monto: centavosATexto(centavos),
        fecha: hoy,
        nota: "comprobar-007-retiro",
        categoriaId: sueldo.id,
        porAsignarId: porAsignar!.id,
        sobresValidos: validos,
        asignaciones,
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
            : referenciaDeReasignacion(captura, f.sobreDestinoId!),
      })),
    );
    const id = await idDeReferencia(referenciaDeCaptura(captura, "ingreso"));
    if (!id) throw new Error("El ingreso no se registró");
    return id;
  }
  /** Una reasignación como la prepara Mover; con la referencia de Mover, o con la del reparto para Repartir. */
  function fila(captura: string, origen: number, destino: number, centavos: number, comoReparto: boolean) {
    const sinTope = inicial.sobres.map((s) => ({ ...s, saldoCentavos: Number.MAX_SAFE_INTEGER }));
    const p = prepararMover(
      { monto: centavosATexto(centavos), origenId: origen, destinoId: destino, nota: "", confirmaInversion: true },
      sinTope,
      hoy,
    );
    if (p.estado !== "ok") throw new Error(`prepararMover no dio una fila: ${JSON.stringify(p)}`);
    const referenciaExterna = comoReparto
      ? referenciaDeReasignacion(captura, destino)
      : referenciaDeMover(captura, destino);
    return { ...p.fila, referenciaExterna };
  }
  const mover = (origen: number, destino: number, centavos: number) => {
    const captura = idDePrueba();
    return moverEntreSobres(captura, fila(captura, origen, destino, centavos, false));
  };
  const repartir = (centavos: number, destino: number) => {
    const captura = idDePrueba();
    return repartirPorAsignar(captura, porAsignar!.id, [fila(captura, porAsignar!.id, destino, centavos, true)]);
  };
  /** Deja Por asignar en exactamente `centavos`: reparte lo que sobra a Planes, o registra un ingreso por lo que falta. */
  async function porAsignarEn(centavos: number) {
    const ahora = enSobre(await estado(), porAsignar!.id);
    if (ahora > centavos) await repartir(ahora - centavos, planes!.id);
    if (ahora < centavos) await ingreso(centavos - ahora);
    if (enSobre(await estado(), porAsignar!.id) !== centavos) throw new Error("Por asignar no quedó donde debía");
  }
  const firmaDeCobro = async (id: number) => (await pagoOCobroParaDeshacer(id))?.previa?.firma ?? "";
  const vistaDeIngreso = async (id: number) => (await vistaPreviaDeBorrado((await movimientoParaEditar(id))!))?.previa;
  const deshacer = async (id: number) => deshacerPagoOCobro(id, await firmaDeCobro(id));
  const borrar = async (id: number) => borrarIngreso(id, (await vistaDeIngreso(id))?.firma ?? "");
  const hecho = (r: object) => "ok" in r && r.ok === true;
  const ganoUno = (r: object) => ("nueva" in r && r.nueva === true) || hecho(r);

  try {
    const p = await prestamo("2000");
    await porAsignarEn(0);

    // Uno: sin firma no se toca nada; la vista previa es lo que queda; una firma vieja no se aplica
    let base = await comoQueda();
    const a = await cobrar(p, "20");
    await repartir(500, planes.id);
    const antesSinFirma = (await estado()).huella;
    comprobar(
      "sin la firma de la vista previa no se deshace, y no toca nada",
      "cambio" in (await deshacerPagoOCobro(a)) && (await estado()).huella === antesSinFirma,
    );
    const vista1 = (await pagoOCobroParaDeshacer(a))?.previa;
    comprobar(
      "la vista previa retira los 5,00 que se repartieron a Planes con su dinero, y deja Por asignar en 0,00",
      JSON.stringify(vista1?.retirado) === JSON.stringify([{ sobreId: planes.id, nombre: "Planes", centavos: 500 }]) &&
        vista1?.saldos.find((x) => x.nombre === "Por asignar")?.despues === 0,
      JSON.stringify(vista1?.retirado),
    );
    await repartir(100, gastosDelMes.id);
    const antesDeLaVieja = (await estado()).huella;
    comprobar(
      "con la firma de una vista previa que ya no vale, no se aplica",
      "cambio" in (await deshacerPagoOCobro(a, vista1?.firma ?? "")) && (await estado()).huella === antesDeLaVieja,
    );
    const vista2 = (await pagoOCobroParaDeshacer(a))?.previa;
    const r2 = await deshacerPagoOCobro(a, vista2?.firma ?? "");
    const tras2 = await estado();
    const comoSeVio = (vista2?.saldos ?? []).every(
      (x) => [...tras2.cuentas, ...tras2.sobres].find((y) => y.nombre === x.nombre)?.saldoCentavos === x.despues,
    );
    comprobar("con la de ahora se deshace, y todo queda como ella mostró", hecho(r2) && comoSeVio);
    comprobar("y queda como antes del cobro: saldos, lo recibido y la cuota", (await comoQueda()) === base);

    // Lo movido con su dinero también se retira: vuelve del sobre adonde fue, y queda como antes
    base = await comoQueda();
    const b = await cobrar(p, "20");
    await mover(porAsignar.id, familia.id, 500);
    const vistaB = (await pagoOCobroParaDeshacer(b))?.previa;
    comprobar(
      "si parte se movió con Mover, la vista previa lo retira de Familia, y deshacer deja todo como antes",
      JSON.stringify(vistaB?.retirado) ===
        JSON.stringify([{ sobreId: familia.id, nombre: "Familia", centavos: 500 }]) &&
        hecho(await deshacerPagoOCobro(b, vistaB?.firma ?? "")) &&
        (await comoQueda()) === base,
      JSON.stringify(vistaB?.retirado),
    );
    // Ir y volver con Mover antes de deshacer: no queda nada que retirar de Familia
    const b2 = await cobrar(p, "20");
    await mover(porAsignar.id, familia.id, 500);
    await mover(familia.id, porAsignar.id, 500);
    const vistaB2 = (await pagoOCobroParaDeshacer(b2))?.previa;
    comprobar(
      "si lo movido ya volvió, no se retira nada, y deshacer deja todo como antes",
      vistaB2?.retirado.length === 0 &&
        hecho(await deshacerPagoOCobro(b2, vistaB2.firma)) &&
        (await comoQueda()) === base,
    );
    // Lo prestado no se retira: no se deshace, ni un cobro ni un ingreso, y lo dice
    const b3 = await cobrar(p, "20");
    await prestamo("5", porAsignar.id);
    const antesDeNegar = (await estado()).huella;
    const rNo = await deshacer(b3);
    const mensaje = "De este dinero, 5,00 se prestaron. Eso no se puede retirar, así que no se deshace.";
    comprobar(
      "si parte se prestó, no se deshace, y lo dice antes",
      "ok" in rNo &&
        !rNo.ok &&
        rNo.error === mensaje &&
        (await pagoOCobroParaDeshacer(b3))?.impedido === mensaje &&
        (await estado()).huella === antesDeNegar,
      "error" in rNo ? rNo.error : "",
    );
    await porAsignarEn(0);
    const i3 = await ingreso(2_000);
    await prestamo("5", porAsignar.id);
    const rNoIngreso = await borrar(i3);
    comprobar(
      "lo mismo al borrar un ingreso (criterio 7 de la 006): no se borra y lo dice",
      "ok" in rNoIngreso && !rNoIngreso.ok && rNoIngreso.error === mensaje,
      "error" in rNoIngreso ? rNoIngreso.error : "",
    );
    await porAsignarEn(0);

    // El reparto propio de otro ingreso no se retira, y ese ingreso se sigue borrando entero
    base = await comoQueda();
    const c = await cobrar(p, "10");
    await repartir(1000, familia.id);
    const otro = await ingreso(4500, [{ sobreId: gastosDelMes.id, monto: "45" }]);
    const vistaC = (await pagoOCobroParaDeshacer(c))?.previa;
    comprobar(
      "deshacer el cobro retira el Repartir que usó su dinero, no el reparto propio del ingreso que llegó luego",
      JSON.stringify(vistaC?.retirado) === JSON.stringify([{ sobreId: familia.id, nombre: "Familia", centavos: 1000 }]),
      JSON.stringify(vistaC?.retirado),
    );
    const rC = await deshacerPagoOCobro(c, vistaC?.firma ?? "");
    const rOtro = await borrarIngreso(otro);
    comprobar(
      "y ese ingreso se borra entero, sin retiro; todo queda como antes",
      hecho(rC) && hecho(rOtro) && (await comoQueda()) === base,
      "error" in rOtro ? rOtro.error : "",
    );

    // Dos cobros, en el orden de registro y al revés (sexta revisión, hallazgo 1)
    for (const orden of ["de registro", "inverso"]) {
      base = await comoQueda();
      const d1 = await cobrar(p, "30");
      await repartir(2000, gastosDelMes.id);
      // Con un Mover desde Por asignar en medio (guardian-datos, N1).
      await mover(porAsignar.id, planes.id, 1000);
      const d2 = await cobrar(p, "30");
      await repartir(500, ocasiones.id);
      await repartir(2500, familia.id);
      const [primero, segundo] = orden === "de registro" ? [d1, d2] : [d2, d1];
      const r1 = await deshacer(primero);
      const rSegundo = await deshacer(segundo);
      comprobar(
        `dos cobros repartidos, con un Mover en medio, deshechos en orden ${orden}: los dos se ofrecen y todo queda como antes`,
        hecho(r1) && hecho(rSegundo) && (await comoQueda()) === base,
        "error" in rSegundo ? rSegundo.error : "",
      );
    }
    // Dos ingresos sin reparto propio, repartidos con Repartir (criterio 7 de la 006)
    for (const orden of ["de registro", "inverso"]) {
      base = await comoQueda();
      const i1 = await ingreso(10_000);
      await repartir(10_000, gastosDelMes.id);
      const i2 = await ingreso(10_000);
      await repartir(4_000, planes.id);
      await repartir(6_000, deudasSobre.id);
      const [primero, segundo] = orden === "de registro" ? [i1, i2] : [i2, i1];
      const r1 = await borrar(primero);
      const rSegundo = await borrar(segundo);
      comprobar(
        `dos ingresos repartidos, borrados en orden ${orden}: todo queda como antes, también la cuota`,
        hecho(r1) && hecho(rSegundo) && (await comoQueda()) === base,
        "error" in rSegundo ? rSegundo.error : "",
      );
    }

    // Un saldo que cambia entre la vista previa y la confirmación, con retiro y sin él
    const e = await cobrar(p, "10");
    await repartir(1000, planes.id);
    const firmaE = await firmaDeCobro(e);
    await mover(planes.id, gastosDelMes.id, 100);
    comprobar(
      "con retiro: un Mover desde el sobre retirado en medio, y la confirmación vieja no se aplica",
      "cambio" in (await deshacerPagoOCobro(e, firmaE)) && hecho(await deshacer(e)),
    );
    await porAsignarEn(3000);
    const f = await cobrar(p, "50");
    const firmaF = await firmaDeCobro(f);
    await mover(porAsignar.id, familia.id, 1000);
    const rF = await deshacerPagoOCobro(f, firmaF);
    comprobar(
      "sin retiro: un Mover desde Por asignar en medio cambia lo que mostraba «Así queda», y no se aplica",
      "cambio" in rF && hecho(await deshacer(f)) && enSobre(await estado(), porAsignar.id) === 2000,
    );
    await porAsignarEn(0);

    // Por asignar con dinero de antes del cobro: se retira solo lo que se repartió con el del cobro
    await porAsignarEn(3000);
    const g = await cobrar(p, "200");
    await repartir(20_000, deudasSobre.id);
    const vistaG = (await pagoOCobroParaDeshacer(g))?.previa;
    comprobar(
      "con 30 en Por asignar de antes y 200 repartidos, deshacer el cobro de 200 retira 170: los 30 de antes se fueron primero",
      vistaG?.retirado.reduce((a2, r) => a2 + r.centavos, 0) === 17_000 && hecho(await deshacer(g)),
      JSON.stringify(vistaG?.retirado),
    );

    // La carrera con un Mover desde el sobre retirado: gana uno y nunca queda en negativo
    let malCandado = 0;
    for (let ronda = 0; ronda < 4; ronda++) {
      await porAsignarEn(0);
      const enOcasiones = enSobre(await estado(), ocasiones.id);
      const h = await cobrar(p, "10");
      await repartir(1000, ocasiones.id);
      const firma = await firmaDeCobro(h);
      const [rD, rM] = await Promise.all([
        deshacerPagoOCobro(h, firma),
        mover(ocasiones.id, gastosDelMes.id, enOcasiones + 1000),
      ]);
      if (ganoUno(rD) === ganoUno(rM) || enSobre(await estado(), ocasiones.id) < 0) malCandado++;
    }
    comprobar(
      "cuatro carreras de deshacer con retiro contra un Mover de todo el sobre retirado: gana uno, nunca en negativo",
      malCandado === 0,
      `${malCandado} mal`,
    );
  } finally {
    await limpiar();
  }

  const final = await comoQueda();
  comprobar("al terminar, la base queda como estaba", final === inicio && (await estado()).filas === inicial.filas);
  console.log(fallos === 0 ? "\n✓ comprobar-007-retiro: todo en verde" : `\n✗ comprobar-007-retiro: ${fallos} fallos`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
