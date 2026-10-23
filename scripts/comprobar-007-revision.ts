/**
 * Lo que encontraron las revisiones de la spec 007 (2026-10-22) y la auditoría de guardian-datos, contra la base:
 *   10 · lo recibido de Por asignar en el mes es neto, con el piso de cero al final, y la cuota de Deudas lee esa misma
 *        cifra: ir y volver, en cualquier orden, no cambia lo recibido ni la cuota; devolver a Por asignar deshace
 *        primero lo recibido en el mes (se vuelve a pedir, la cuota no cambia); lo de más, o lo que va de Deudas a otro
 *        sobre, suelta lo apartado (sube la cuota); lo soltado de más se vuelve a pedir. Con lo recibido en 0 y con un
 *        reparto del mes ya dentro;
 *   7  · un pago toma el candado de Deudas: Mover desde Deudas a la vez no saca lo que el pago ya usó.
 * Con --url, además, contra un servidor en marcha con esta misma base y el usuario de prueba, como un navegador sin
 * JavaScript: Mover no trae origen elegido; desde Inversión, sin confirmar no guarda, la confirmación vale para ese
 * monto y no otro, y el reintento no duplica; deshacer un cobro ya repartido lo dice antes.
 *   pnpm exec tsx scripts/comprobar-007-revision.ts [--url http://localhost:3000]
 * Corre sobre la base local con los datos de demostración y la deja como estaba. Lo suyo son capturas cuyo id empieza
 * por 0c070017, que se borran al terminar y, si una corrida se cortó, al empezar la siguiente. Se niega ante
 * movimientos o deudas que no sean de demostración.
 */
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { count, eq, isNull, like, not, or } from "drizzle-orm";
import { referenciaDeCaptura, referenciaDeReasignacion } from "../src/lib/captura";
import { exigirBaseLocal } from "../src/lib/destino-base";
import { centavosATexto } from "../src/lib/dinero";
import { type DeudaParaSaldar, prepararPago, validarDeuda } from "../src/lib/deudas";
import { hoyEnCaracas } from "../src/lib/fechas";
import { prepararIngreso } from "../src/lib/ingresos";
import { prepararMover } from "../src/lib/mover";
import { prepararCobro, prepararPrestamo } from "../src/lib/prestamos";
import { abrirSesion, texto } from "./comprobar-003-paginas";

const MARCA = "0c070017";
let fallos = 0;

function comprobar(criterio: string, descripcion: string, ok: boolean, detalle = "") {
  if (!ok) fallos++;
  console.log(`${ok ? "✓" : "✗"} ${criterio} · ${descripcion}${detalle ? ` (${detalle})` : ""}`);
}

const idDePrueba = () => `${MARCA}${randomUUID().slice(8)}`;

async function main() {
  config({ path: ".env.local" });
  // Escribe filas: solo en la base local (spec 002, criterio 10).
  exigirBaseLocal(process.env.DATABASE_URL, "comprobar-007-revision");
  const posicionUrl = process.argv.indexOf("--url");
  const origen = posicionUrl >= 0 ? process.argv[posicionUrl + 1] : null;
  const { db, deudas, movimientos } = await import("../src/db/index");
  const { saldosPorCuenta, saldosPorSobre } = await import("../src/db/consultas");
  const { categoriasDeIngresoPorUso } = await import("../src/db/reparto");
  const { registrarCaptura, repartirPorAsignar } = await import("../src/db/movimientos");
  const { moverEntreSobres } = await import("../src/db/mover");
  const { deudaPorId, sobreDeudas } = await import("../src/db/deudas");
  const { cobrarPrestamo, pagarDeuda, prestar, registrarDeuda } = await import("../src/db/guardar-deudas");
  const { cuotaDelMes, recibidoDesdePorAsignarPorMes } = await import("../src/db/reparto");

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
        nota: "comprobar-007-revision",
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
  function filaDeMover(captura: string, origen: number, destino: number, centavos: number) {
    const sinTope = inicial.sobres.map((s) => ({ ...s, saldoCentavos: Number.MAX_SAFE_INTEGER }));
    const p = prepararMover(
      {
        monto: centavosATexto(centavos),
        origenId: origen,
        destinoId: destino,
        nota: "comprobar-007-revision",
        confirmaInversion: true,
      },
      sinTope,
      hoy,
    );
    if (p.estado !== "ok") throw new Error(`prepararMover no dio una fila: ${JSON.stringify(p)}`);
    return { ...p.fila, referenciaExterna: referenciaDeReasignacion(captura, destino) };
  }
  const mover = (origen: number, destino: number, centavos: number, captura = idDePrueba()) =>
    moverEntreSobres(captura, filaDeMover(captura, origen, destino, centavos));
  const repartir = (centavos: number, destino: number) => {
    const captura = idDePrueba();
    return repartirPorAsignar(captura, porAsignar!.id, [
      { ...filaDeMover(captura, porAsignar!.id, destino, centavos) },
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
    // Criterio 10: lo recibido de Por asignar en el mes es neto, con el piso de cero al final, y la cuota de Deudas lee
    // esa misma cifra. Primero Deudas, con la base recién cargada: la demo no le manda nada este mes.
    const familia = inicial.sobres.find((s) => s.nombre === "Familia");
    const emergencia = inicial.sobres.find((s) => s.tipo === "emergencia");
    if (!familia || !emergencia) throw new Error("Faltan Familia o Emergencia: corre pnpm db:seed");
    const recibido = async (id: number) => (await recibidoDesdePorAsignarPorMes())[hoy.slice(0, 7)]?.[id] ?? 0;
    const cuota = async () => (await cuotaDelMes())?.cuotaCentavos ?? NaN;
    /** Le da saldo a un sobre desde Emergencia, que no es Por asignar: no cuenta como recibido. */
    async function desdeEmergencia(id: number, centavos: number) {
      await sobreEn(emergencia!.id, enSobre(await estado(), emergencia!.id) + centavos);
      const r = await mover(emergencia!.id, id, centavos);
      if (!ganoUno(r)) throw new Error("No se pudo dar saldo desde Emergencia");
    }
    const hecho = (r: object) => {
      if (!ganoUno(r)) throw new Error("Un movimiento de la comprobación no se guardó");
    };
    await sobreEn(porAsignar.id, 10000);
    const deudasDelMes = await recibido(deudasSobre.id);
    const c0 = await cuota();
    comprobar(
      "10",
      "al empezar, Deudas no recibió nada de Por asignar este mes y hay cuota",
      deudasDelMes === 0 && c0 > 0,
      `${c0}`,
    );

    hecho(await mover(porAsignar.id, deudasSobre.id, 1000));
    hecho(await mover(deudasSobre.id, porAsignar.id, 1000));
    comprobar(
      "10",
      "Por asignar → Deudas → Por asignar: ni lo recibido ni la cuota cambian",
      (await recibido(deudasSobre.id)) === 0 && (await cuota()) === c0,
    );
    hecho(await mover(deudasSobre.id, porAsignar.id, 1000));
    hecho(await mover(porAsignar.id, deudasSobre.id, 1000));
    comprobar(
      "10",
      "al revés, Deudas → Por asignar → Deudas: ni lo recibido ni la cuota cambian (segunda vuelta, hallazgo 1)",
      (await recibido(deudasSobre.id)) === 0 && (await cuota()) === c0,
      `recibido ${await recibido(deudasSobre.id)}, cuota ${c0}→${await cuota()}`,
    );
    hecho(await mover(deudasSobre.id, porAsignar.id, 3000));
    const porPorAsignar = await cuota();
    hecho(await mover(porAsignar.id, deudasSobre.id, 3000));
    hecho(await mover(deudasSobre.id, familia.id, 3000));
    const porOtroSobre = await cuota();
    hecho(await mover(familia.id, deudasSobre.id, 3000));
    comprobar(
      "10",
      "sin nada recibido este mes, soltar 30 de lo apartado a Por asignar sube la cuota igual que soltarlos a Familia (segunda vuelta, hallazgo 2)",
      porPorAsignar === porOtroSobre && porPorAsignar > c0 && (await cuota()) === c0,
      `${c0} → ${porPorAsignar} y ${porOtroSobre}`,
    );

    // Con lo recibido del mes > 0, el estado normal tras el sueldo (tercera vuelta, hallazgo 1)
    hecho(await mover(porAsignar.id, deudasSobre.id, 2000));
    const [cConSueldo, rConSueldo] = [await cuota(), await recibido(deudasSobre.id)];
    comprobar(
      "10",
      "el reparto del mes le da 20 a Deudas: cuentan como recibidos y la cuota no cambia",
      rConSueldo === 2000 && cConSueldo === c0,
    );
    hecho(await mover(deudasSobre.id, porAsignar.id, 500));
    comprobar(
      "10",
      "devolver 5 de Deudas a Por asignar deshace ese reparto: lo recibido baja a 15, se vuelve a pedir este mes, y la cuota no cambia",
      (await recibido(deudasSobre.id)) === 1500 && (await cuota()) === c0,
      `${await recibido(deudasSobre.id)} · ${await cuota()}`,
    );
    hecho(await mover(porAsignar.id, deudasSobre.id, 500));
    hecho(await mover(deudasSobre.id, familia.id, 500));
    comprobar(
      "10",
      "mandar 5 de Deudas a Familia suelta lo apartado: lo recibido no cambia y la cuota sube",
      (await recibido(deudasSobre.id)) === 2000 && (await cuota()) > c0,
      `${await recibido(deudasSobre.id)} · ${await cuota()}`,
    );
    hecho(await mover(familia.id, deudasSobre.id, 500));
    hecho(await mover(deudasSobre.id, porAsignar.id, 2000 + 3000));
    comprobar(
      "10",
      "devolver a Por asignar 30 más de lo recibido deshace el reparto y suelta 30 de lo apartado: la cuota queda como al soltar 30 a otro sobre",
      (await recibido(deudasSobre.id)) === 0 && (await cuota()) === porOtroSobre,
      `${await cuota()} y ${porOtroSobre}`,
    );
    hecho(await mover(porAsignar.id, deudasSobre.id, 3000));

    // Familia y Planes: lo que un fijo pide
    const familiaAntes = await recibido(familia.id);
    await desdeEmergencia(familia.id, 1000);
    hecho(await mover(porAsignar.id, familia.id, 1000));
    hecho(await mover(familia.id, porAsignar.id, 1000));
    hecho(await mover(familia.id, porAsignar.id, 1000));
    hecho(await mover(porAsignar.id, familia.id, 1000));
    comprobar(
      "10",
      "Familia, ida y vuelta en los dos sentidos: lo recibido no cambia",
      (await recibido(familia.id)) === familiaAntes,
      `${familiaAntes}→${await recibido(familia.id)}`,
    );
    hecho(await mover(porAsignar.id, familia.id, 1500));
    hecho(await mover(familia.id, porAsignar.id, 500));
    comprobar(
      "10",
      "mandar 15 a Familia y devolver 5 cuenta 10 recibidos",
      (await recibido(familia.id)) === familiaAntes + 1000,
    );
    const dePlanes = await recibido(planes.id);
    await desdeEmergencia(planes.id, dePlanes + 1000);
    hecho(await mover(planes.id, porAsignar.id, dePlanes + 1000));
    comprobar(
      "10",
      "devolver más de lo recibido en el mes deja lo recibido en cero, no en negativo",
      (await recibido(planes.id)) === 0,
      `${dePlanes} recibidos, devolvió ${dePlanes + 1000}: ${await recibido(planes.id)}`,
    );
    hecho(await mover(porAsignar.id, planes.id, 400));
    comprobar(
      "10",
      "lo soltado de más se vuelve a pedir: tras soltar 10 de más, recibir 4 sigue contando 0 (guardian-datos, decidido en la spec)",
      (await recibido(planes.id)) === 0,
      `${await recibido(planes.id)}`,
    );
    await cuadra("tras ir y volver con Por asignar");

    // guardian-datos, 007: un pago de 30 y mover 50 desde Deudas a la vez, con 50 en Deudas. El pago toma el candado
    // de Deudas: si entra primero, Mover lo ve y no saca de más. Si los dos quedan, Mover tuvo que ir antes.
    let moverTrasPago = 0;
    for (let ronda = 0; ronda < 6; ronda++) {
      const d4 = await deuda("100");
      await sobreEn(deudasSobre.id, 5000);
      const capturaPago = idDePrueba();
      const capturaMover = idDePrueba();
      const [rPago, rMover] = await Promise.all([
        pagarDeuda(capturaPago, await filaDePago(capturaPago, d4, "30")),
        mover(deudasSobre.id, gastosDelMes.id, 5000, capturaMover),
      ]);
      const pagoId = await idDeReferencia(referenciaDeCaptura(capturaPago, "pago"));
      const moverId = await idDeReferencia(referenciaDeReasignacion(capturaMover, gastosDelMes.id));
      if (ganoUno(rPago) && ganoUno(rMover) && pagoId !== null && moverId !== null && pagoId < moverId) moverTrasPago++;
    }
    comprobar(
      "7",
      "seis carreras de un pago contra mover desde Deudas: Mover nunca saca lo que el pago ya usó",
      moverTrasPago === 0,
      `${moverTrasPago} mal`,
    );

    if (origen) {
      console.log(`— páginas, contra ${origen}`);
      const sesion = await abrirSesion(origen);
      try {
        const formularioDe = (html: string) =>
          [...html.matchAll(/<form[\s\S]*?<\/form>/g)].map((m) => m[0]).find((f) => f.includes('name="origenId"')) ??
          "";
        const ocultos = (form: string) => {
          const datos = new FormData();
          for (const m of form.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
            const nombre = /name="([^"]*)"/.exec(m[0])?.[1];
            if (nombre) datos.set(nombre, texto(/value="([^"]*)"/.exec(m[0])?.[1] ?? ""));
          }
          return datos;
        };
        const filasDe = async (captura: string) =>
          (
            await db
              .select({ id: movimientos.id })
              .from(movimientos)
              .where(like(movimientos.referenciaExterna, `captura-${captura}-%`))
          ).length;

        // Hallazgo 2: ni origen ni destino elegidos
        const pagina = (await sesion.pagina("/nuevo/mover")).html;
        const form = formularioDe(pagina);
        const marcados = [...form.matchAll(/<input[^>]*name="(origenId|destinoId)"[^>]*>/g)].filter((m) =>
          m[0].includes("checked"),
        );
        comprobar(
          "7",
          "Mover no trae ningún sobre elegido",
          form !== "" && marcados.length === 0,
          `${marcados.length} marcados`,
        );

        // Hallazgo 6, ★ 8 y 9 por la acción: Inversión pide confirmar, y el reintento no duplica
        await sobreEn(inversion.id, 1000);
        const captura = idDePrueba();
        const campos = {
          idCaptura: captura,
          origenId: String(inversion.id),
          destinoId: String(gastosDelMes.id),
          monto: "3",
          nota: "comprobar-007 página",
        };
        const llenar = (extra: Record<string, string> = {}) => {
          const datos = ocultos(form);
          for (const [k, v] of Object.entries({ ...campos, ...extra })) datos.set(k, v);
          return datos;
        };
        const sinConfirmar = await sesion.enviar("/nuevo/mover", llenar());
        comprobar(
          "8",
          "desde Inversión, sin confirmar: pide la confirmación y no guarda",
          sinConfirmar.estado === 200 &&
            texto(sinConfirmar.html).includes(
              "Inversión es intocable: lo que sale de aquí deja de crecer. ¿Mover igual?",
            ) &&
            (await filasDe(captura)) === 0,
          `${sinConfirmar.estado}`,
        );
        // La confirmación que trajo el aviso (el formulario que vuelve la lleva): vale para ese origen y ese monto.
        const confirmacion =
          /name="confirmarInversion" value="([^"]*)"/.exec(sinConfirmar.html)?.[1] ??
          /value="([^"]*)" name="confirmarInversion"/.exec(sinConfirmar.html)?.[1] ??
          "";
        const otroMonto = await sesion.enviar("/nuevo/mover", llenar({ monto: "7", confirmarInversion: confirmacion }));
        comprobar(
          "8",
          "confirmar el aviso de 3 y enviar 7 vuelve a pedir la confirmación, y no guarda (segunda vuelta, hallazgo 3)",
          confirmacion === `${inversion.id}:3` &&
            otroMonto.estado === 200 &&
            texto(otroMonto.html).includes("Inversión es intocable") &&
            (await filasDe(captura)) === 0,
          `${confirmacion} · ${otroMonto.estado}`,
        );
        const confirmado = await sesion.enviar("/nuevo/mover", llenar({ confirmarInversion: confirmacion }));
        const reintento = await sesion.enviar("/nuevo/mover", llenar({ confirmarInversion: confirmacion }));
        comprobar(
          "9",
          "con la confirmación guarda y vuelve a Sobres; reenviar lo mismo no duplica",
          confirmado.estado === 303 &&
            confirmado.ubicacion === "/sobres?movido=1" &&
            reintento.estado === 303 &&
            (await filasDe(captura)) === 1,
          `${confirmado.estado} ${confirmado.ubicacion} · ${reintento.estado}`,
        );

        // Hallazgo 4: deshacer un cobro ya repartido lo dice antes, y no ofrece "Sí, deshacer"
        const p5 = await prestamo("50");
        const cobroRepartido = await cobrar(p5, "20");
        await sobreEn(porAsignar.id, 1500);
        const vista = await sesion.pagina(`/movimientos/${cobroRepartido}?borrar=1`);
        comprobar(
          "2",
          'deshacer un cobro ya repartido lo dice antes, con el remedio, y no ofrece "Sí, deshacer"',
          texto(vista.html).includes(
            "Por asignar tiene 15,00; le faltan 5,00. Devuelve lo que falta a Por asignar con Mover",
          ) && !texto(vista.html).includes("Sí, deshacer"),
        );
      } finally {
        await sesion.salir();
      }
    }
  } finally {
    await limpiar();
  }

  const final = await estado();
  comprobar(
    "3",
    "al terminar, la base queda como estaba",
    final.huella === inicial.huella && final.filas === inicial.filas,
  );
  console.log(
    fallos === 0 ? "\n✓ comprobar-007-revision: todo en verde" : `\n✗ comprobar-007-revision: ${fallos} fallos`,
  );
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
