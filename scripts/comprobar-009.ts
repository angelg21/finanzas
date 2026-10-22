/**
 * Los criterios ★ de la spec 009 contra la base, escritos desde su texto al verificar:
 *   ★ 1  · anotar no mueve dinero: ni cuentas ni sobres, ni el gastado del mes, ni las gráficas, ni la lista;
 *   ★ 3  · un reintento con el mismo id de captura no anota dos veces;
 *   ★ 6  · completar uno registra el gasto, con su propia venta si vende USDT, y borra el pendiente, todo junto;
 *   ★ 7  · si el pendiente ya no existe (descartado o completado en otra pestaña), no se registra nada; completar y
 *          descartar a la vez, o completar dos veces a la vez, deja uno solo de los dos;
 *   ★ 8  · completar varios vendiendo USDT registra una sola venta por lo vendido y un gasto en Bs por pendiente;
 *          el resto va a Bolívares o es un gasto más, y Binance baja exactamente lo vendido;
 *   ★ 9  · todo en una transacción: si una fila falla, no se guarda ninguna y los pendientes siguen; el cuadre;
 *   ★ 10 · si alguno de los elegidos ya no existe, no se guarda nada;
 *   ★ 11 · sin ?pendiente=, la captura no cambia.
 * Con --url, además, contra un servidor en marcha con esta misma base y el usuario de prueba, como un navegador sin
 * JavaScript: "Completar" abre la captura llena (★ 6), sin ?pendiente= es la de siempre (★ 11), el inicio y
 * Registrar cuentan los pendientes (5), y guardar uno ya descartado dice "Este gasto ya se completó o se descartó"
 * (★ 7) mientras guardar uno vigente vuelve a la lista con "Completado" (★ 6).
 * Lo puro (validar, la venta única, el resto, las tres formas) lo prueba src/lib/por-completar.test.ts, y el sobre
 * sugerido, sobreSugerido en src/lib/gastos.test.ts. La sesión y conFallas del ★ 11, sobre todas las acciones,
 * src/app/sesion.criterios.test.ts, src/app/fallas.criterios.test.ts y scripts/comprobar-002-servidor.ts.
 *   pnpm exec tsx scripts/comprobar-009.ts [--url http://localhost:3000]
 * Lo suyo son capturas y pendientes cuya referencia empieza por "captura-0c090009", que se borran al terminar y, si
 * una corrida se cortó, al empezar la siguiente. Se niega ante movimientos o pendientes que no sean de demostración.
 */
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { count, eq, isNull, like, not, or } from "drizzle-orm";
import { prefijoDeCaptura, referenciaDeCaptura } from "../src/lib/captura";
import { exigirBaseLocal } from "../src/lib/destino-base";
import { centavosATexto } from "../src/lib/dinero";
import { fechaDesdeAtajo, hoyEnCaracas } from "../src/lib/fechas";
import { type EntradaGasto, type FilaMovimiento, prepararGasto } from "../src/lib/gastos";
import { rangoDePeriodo } from "../src/lib/periodos";
import {
  type EntradaVarios,
  type ItemVarios,
  prepararCompletarVarios,
  validarPorCompletar,
} from "../src/lib/por-completar";
import { abrirSesion, texto } from "./comprobar-003-paginas";

const MARCA = "0c090009";
let fallos = 0;

function comprobar(criterio: string, descripcion: string, ok: boolean, detalle = "") {
  if (!ok) fallos++;
  console.log(`${ok ? "✓" : "✗"} ${criterio} · ${descripcion}${detalle ? ` (${detalle})` : ""}`);
}

const idDePrueba = () => `${MARCA}${randomUUID().slice(8)}`;

async function main() {
  config({ path: ".env.local" });
  // Escribe filas: solo en la base local (spec 002, criterio 10).
  exigirBaseLocal(process.env.DATABASE_URL, "comprobar-009");
  const posicionUrl = process.argv.indexOf("--url");
  const origen = posicionUrl >= 0 ? process.argv[posicionUrl + 1] : null;
  const { db, gastosPorCompletar, movimientos } = await import("../src/db/index");
  const { categoriasDeGastoPorUso, gastadoEsteMes, resumenMensual, saldosPorCuenta, saldosPorSobre } =
    await import("../src/db/consultas");
  const { movimientosDelPeriodo, totalesPorCategoria } = await import("../src/db/movimientos-del-periodo");
  const { anotarPorCompletar, completarPorCompletar, contarPorCompletar, descartarPorCompletar, porCompletarPorId } =
    await import("../src/db/por-completar");
  const { movimientoParaEditar } = await import("../src/db/editar-movimientos");

  async function limpiar() {
    await db.delete(movimientos).where(like(movimientos.referenciaExterna, `captura-${MARCA}-%`));
    await db.delete(gastosPorCompletar).where(like(gastosPorCompletar.referencia, `captura-${MARCA}-%`));
  }
  await limpiar();
  const [{ reales }] = await db
    .select({ reales: count() })
    .from(movimientos)
    .where(or(isNull(movimientos.referenciaExterna), not(like(movimientos.referenciaExterna, "demo-%"))));
  const [{ pendientesReales }] = await db
    .select({ pendientesReales: count() })
    .from(gastosPorCompletar)
    .where(not(like(gastosPorCompletar.referencia, "demo-%")));
  if (reales + pendientesReales > 0) {
    throw new Error(
      `Hay ${reales} movimientos y ${pendientesReales} pendientes que no son de demostración. No se toca.`,
    );
  }

  async function estado() {
    const [c, s, [{ filas }], [{ pendientes }]] = await Promise.all([
      saldosPorCuenta(),
      saldosPorSobre(),
      db.select({ filas: count() }).from(movimientos),
      db.select({ pendientes: count() }).from(gastosPorCompletar),
    ]);
    const totalCuentas = c.reduce((a, x) => a + x.saldoUsdCentavos, 0);
    const totalSobres = s.reduce((a, x) => a + x.saldoCentavos, 0);
    const huella = JSON.stringify([c.map((x) => [x.id, x.saldoCentavos]), s.map((x) => [x.id, x.saldoCentavos])]);
    return { cuentas: c, sobres: s, filas, pendientes, cuadra: totalCuentas === totalSobres, huella };
  }
  type Estado = Awaited<ReturnType<typeof estado>>;
  const enCuenta = (e: Estado, id: number) => e.cuentas.find((c) => c.id === id)?.saldoCentavos ?? NaN;
  async function cuadra(paso: string) {
    const e = await estado();
    comprobar("9", `Cuadra ${paso}`, e.cuadra);
    return e;
  }

  const inicial = await estado();
  const hoy = hoyEnCaracas(new Date());
  const ayer = fechaDesdeAtajo("ayer", hoy);
  const mes = rangoDePeriodo("mes", hoy);
  const binance = inicial.cuentas.find((c) => c.nombre === "Binance");
  const prima = inicial.cuentas.find((c) => c.nombre === "Cuenta prima");
  const bolivares = inicial.cuentas.find((c) => c.moneda === "VES");
  const gastosDelMes = inicial.sobres.find((s) => s.tipo === "gastos");
  const categorias = await categoriasDeGastoPorUso();
  const [catA, catB] = categorias;
  const familia = categorias.find((c) => c.nombre === "Familia") ?? catB;
  if (!binance || !prima || !bolivares || !gastosDelMes || !catB) {
    throw new Error("Faltan datos base: corre pnpm db:seed y pnpm db:demo");
  }
  console.log(`Base local · hoy en Caracas ${hoy} · ${inicial.filas} movimientos · ${inicial.pendientes} pendientes`);

  /** Anota un pendiente como /nuevo/por-completar, con la referencia de su captura. */
  async function anotar(
    e: { nota: string; monto?: string; moneda?: "VES" | "USD"; fecha?: string; categoriaId?: number },
    captura = idDePrueba(),
  ) {
    const v = validarPorCompletar(
      {
        categoriaId: e.categoriaId ?? catA.id,
        nota: e.nota,
        fecha: e.fecha ?? hoy,
        monto: e.monto ?? "",
        moneda: e.moneda ?? "",
      },
      categorias.map((c) => c.id),
      hoy,
    );
    if (!v.ok) throw new Error(`validarPorCompletar rechazó: ${JSON.stringify(v.errores)}`);
    const r = await anotarPorCompletar({ ...v.fila, referencia: referenciaDeCaptura(captura, "pendiente") });
    const [fila] = await db
      .select({ id: gastosPorCompletar.id })
      .from(gastosPorCompletar)
      .where(eq(gastosPorCompletar.referencia, referenciaDeCaptura(captura, "pendiente")));
    return { id: fila?.id ?? 0, nueva: r.nueva, captura };
  }
  /** Las filas de completar un pendiente desde la captura, con sus referencias: el gasto y su propia venta. */
  function filasDeCaptura(captura: string, cambios: Partial<EntradaGasto>) {
    const p = prepararGasto(
      {
        forma: "dolares",
        monto: "12",
        tasa: "",
        vendido: "",
        cuentaOrigen: { id: prima!.id, moneda: prima!.moneda },
        cuentaBolivares: { id: bolivares!.id, moneda: "VES" },
        sobreId: gastosDelMes!.id,
        categoriaId: catA.id,
        fecha: hoy,
        nota: "comprobar-009",
        ...cambios,
      },
      hoy,
    );
    if (!p.ok) throw new Error(`prepararGasto rechazó: ${JSON.stringify(p.errores)}`);
    return p.filas.map((f) => ({
      ...f,
      referenciaExterna: referenciaDeCaptura(captura, f.tipo === "transferencia" ? "transferencia" : "gasto"),
    }));
  }
  /** Las filas de completar varios, con las referencias que pone /por-completar/varios. */
  function filasDeVarios(captura: string, filas: FilaMovimiento[], items: ItemVarios[]) {
    const prefijo = prefijoDeCaptura(captura);
    let siguiente = 0;
    return filas.map((f) => {
      if (f.tipo === "transferencia") return { ...f, referenciaExterna: `${prefijo}transferencia` };
      const item = items[siguiente++];
      return { ...f, referenciaExterna: item ? `${prefijo}gasto-${item.pendienteId}` : `${prefijo}gasto-resto` };
    });
  }
  const deCaptura = (captura: string) =>
    db
      .select()
      .from(movimientos)
      .where(like(movimientos.referenciaExterna, `captura-${captura}-%`));
  const existe = async (id: number) => (await porCompletarPorId(id)) !== null;
  const vista = async () =>
    JSON.stringify([
      await gastadoEsteMes(),
      await resumenMensual(6),
      await totalesPorCategoria("gastos", mes),
      (await movimientosDelPeriodo("gastos", mes, null)).map((m) => m.id),
    ]);

  try {
    // ★ 1 y 3 · anotar no mueve dinero, y no se anota dos veces
    const vistaAntes = await vista();
    const pan = await anotar({ nota: "comprobar-009 pan", monto: "3650", moneda: "VES", fecha: ayer });
    const taxi = await anotar({ nota: "comprobar-009 taxi", monto: "12", moneda: "USD" });
    const sinMonto = await anotar({ nota: "comprobar-009 sin monto" });
    const trasAnotar = await estado();
    comprobar(
      "1",
      "anotar tres (en Bs, en USD y sin monto) no cambia cuentas, sobres ni movimientos",
      trasAnotar.huella === inicial.huella &&
        trasAnotar.filas === inicial.filas &&
        trasAnotar.pendientes === inicial.pendientes + 3,
    );
    comprobar(
      "1",
      "ni el gastado del mes, ni la gráfica mensual, ni el anillo, ni la lista de Gastos",
      (await vista()) === vistaAntes,
    );
    const repetido = await anotar(
      { nota: "comprobar-009 pan", monto: "3650", moneda: "VES", fecha: ayer },
      pan.captura,
    );
    comprobar(
      "3",
      "anotar otra vez con el mismo id de captura no anota dos veces",
      pan.nueva && !repetido.nueva && repetido.id === pan.id && (await estado()).pendientes === trasAnotar.pendientes,
    );

    // ★ 6 · completar uno
    const capturaTaxi = idDePrueba();
    const rTaxi = await completarPorCompletar(
      capturaTaxi,
      [taxi.id],
      filasDeCaptura(capturaTaxi, { monto: "12", nota: "comprobar-009 taxi" }),
    );
    const filasTaxi = await deCaptura(capturaTaxi);
    comprobar(
      "6",
      "completar el de USD registra el gasto y el pendiente desaparece, juntos",
      "nueva" in rTaxi &&
        rTaxi.nueva &&
        filasTaxi.length === 1 &&
        filasTaxi[0].tipo === "gasto" &&
        !(await existe(taxi.id)),
    );
    const capturaPan = idDePrueba();
    const vendiendo = {
      forma: "vendiendo" as const,
      cuentaOrigen: { id: binance.id, moneda: binance.moneda },
      tasa: "40",
      vendido: "100",
    };
    await completarPorCompletar(
      capturaPan,
      [pan.id],
      filasDeCaptura(capturaPan, { ...vendiendo, monto: "3650", fecha: ayer, nota: "comprobar-009 pan" }),
    );
    const gastoPan = (await deCaptura(capturaPan)).find((f) => f.tipo === "gasto");
    const abierto = gastoPan ? await movimientoParaEditar(gastoPan.id) : null;
    comprobar(
      "6",
      "completar el de Bs vendiendo USDT deja el gasto con su propia venta, editable como cualquier otro",
      abierto?.venta?.tipo === "transferencia" && gastoPan?.fecha === ayer && !(await existe(pan.id)),
    );
    await cuadra("tras completar uno por uno");
    const reintento = await completarPorCompletar(
      capturaTaxi,
      [taxi.id],
      filasDeCaptura(capturaTaxi, { monto: "12", nota: "comprobar-009 taxi" }),
    );
    comprobar(
      "6",
      "un reintento de la misma captura devuelve lo guardado, sin otro gasto",
      "nueva" in reintento && !reintento.nueva && (await deCaptura(capturaTaxi)).length === 1,
    );
    const capturaUsada = idDePrueba();
    await completarPorCompletar(capturaUsada, [sinMonto.id], filasDeCaptura(capturaUsada, { monto: "5" }));
    const otroPendiente = await anotar({ nota: "comprobar-009 otro" });
    const reusada = await completarPorCompletar(
      capturaUsada,
      [otroPendiente.id],
      filasDeCaptura(capturaUsada, { monto: "6" }),
    );
    comprobar(
      "6",
      "el id de una captura ya usada, con otro pendiente vigente, no se toma por reintento: 'otra' y nada escrito",
      "otra" in reusada && (await existe(otroPendiente.id)) && (await deCaptura(capturaUsada)).length === 1,
    );

    // ★ 7 · el pendiente ya no existe
    const descartado = await anotar({ nota: "comprobar-009 descartado", monto: "8", moneda: "USD" });
    comprobar(
      "7",
      "descartarlo responde que estaba; otra vez, que ya no",
      (await descartarPorCompletar(descartado.id)) && !(await descartarPorCompletar(descartado.id)),
    );
    const capturaTarde = idDePrueba();
    const tarde = await completarPorCompletar(
      capturaTarde,
      [descartado.id],
      filasDeCaptura(capturaTarde, { monto: "8" }),
    );
    comprobar(
      "7",
      "completar uno descartado no registra nada",
      "faltan" in tarde && (await deCaptura(capturaTarde)).length === 0,
    );
    const capturaSegunda = idDePrueba();
    const segunda = await completarPorCompletar(
      capturaSegunda,
      [taxi.id],
      filasDeCaptura(capturaSegunda, { monto: "12" }),
    );
    comprobar(
      "7",
      "completar en otra pestaña uno ya completado no registra nada",
      "faltan" in segunda && (await deCaptura(capturaSegunda)).length === 0,
    );
    let malDescartar = 0;
    for (let ronda = 0; ronda < 5; ronda++) {
      const p = await anotar({ nota: `comprobar-009 carrera ${ronda}`, monto: "3", moneda: "USD" });
      const captura = idDePrueba();
      const [rC, rD] = await Promise.all([
        completarPorCompletar(captura, [p.id], filasDeCaptura(captura, { monto: "3" })),
        descartarPorCompletar(p.id),
      ]);
      const gastos = (await deCaptura(captura)).length;
      const completo = "nueva" in rC && rC.nueva;
      // Uno de los dos: o se completó (hay gasto y descartar no encontró nada) o se descartó (sin gasto).
      if (completo === rD || (completo ? gastos !== 1 : gastos !== 0) || (await existe(p.id))) malDescartar++;
    }
    comprobar(
      "7",
      "cinco carreras de completar contra descartar: siempre uno de los dos, nunca un gasto de uno descartado",
      malDescartar === 0,
      `${malDescartar} mal`,
    );
    let malDosVeces = 0;
    for (let ronda = 0; ronda < 5; ronda++) {
      const p = await anotar({ nota: `comprobar-009 dos veces ${ronda}`, monto: "4", moneda: "USD" });
      const [a, b] = [idDePrueba(), idDePrueba()];
      const [rA, rB] = await Promise.all([
        completarPorCompletar(a, [p.id], filasDeCaptura(a, { monto: "4" })),
        completarPorCompletar(b, [p.id], filasDeCaptura(b, { monto: "4" })),
      ]);
      const gastos = (await deCaptura(a)).length + (await deCaptura(b)).length;
      if (gastos !== 1 || !("faltan" in rA || "faltan" in rB)) malDosVeces++;
    }
    comprobar(
      "7",
      "cinco veces completar el mismo en dos pestañas a la vez: un solo gasto",
      malDosVeces === 0,
      `${malDosVeces} mal`,
    );
    await cuadra("tras las carreras");

    // ★ 8 · completar varios vendiendo USDT, con el resto a Bolívares o como gasto
    async function varios(montos: string[], resto: EntradaVarios["resto"]) {
      const pendientes = [];
      for (const [i, monto] of montos.entries())
        pendientes.push(await anotar({ nota: `comprobar-009 varios ${i}`, monto, moneda: "VES" }));
      const items: ItemVarios[] = pendientes.map((p, i) => ({
        pendienteId: p.id,
        monto: montos[i],
        sobreId: gastosDelMes!.id,
        categoriaId: catA.id,
        fecha: hoy,
        nota: `comprobar-009 varios ${i}`,
      }));
      const entrada: EntradaVarios = {
        forma: "vendiendo",
        cuentaOrigen: { id: binance!.id, moneda: binance!.moneda },
        cuentaBolivares: { id: bolivares!.id, moneda: "VES" },
        tasa: "40",
        vendido: "100",
        items,
        resto,
        restoCategoriaId: familia.id,
        restoSobreId: gastosDelMes!.id,
      };
      return { pendientes, items, preparado: prepararCompletarVarios(entrada, hoy) };
    }
    const pregunta = await varios(["1000", "1500", "500"], "");
    comprobar(
      "8",
      "con 4.000 Bs recibidos y 3.000 en gastos, sin decidir el resto, pregunta por 1.000 Bs",
      pregunta.preparado.estado === "resto" && pregunta.preparado.restoBs === 100000,
    );
    for (const p of pregunta.pendientes) await descartarPorCompletar(p.id);
    for (const destino of ["bolivares", "gasto"] as const) {
      const antes = await estado();
      const v = await varios(["1000", "1500", "500"], destino);
      if (v.preparado.estado !== "ok") throw new Error(`prepararCompletarVarios: ${JSON.stringify(v.preparado)}`);
      const captura = idDePrueba();
      const r = await completarPorCompletar(
        captura,
        v.preparado.pendientes,
        filasDeVarios(captura, v.preparado.filas, v.items),
      );
      const filas = await deCaptura(captura);
      const despues = await estado();
      const ventas = filas.filter((f) => f.tipo === "transferencia");
      const gastos = filas.filter((f) => f.tipo === "gasto");
      comprobar(
        "8",
        `resto a ${destino === "bolivares" ? "Bolívares" : "un gasto más"}: una sola venta de 100 USDT y ${destino === "gasto" ? "cuatro gastos, el último 'Resto de la venta'" : "tres gastos"}`,
        "nueva" in r &&
          r.nueva &&
          ventas.length === 1 &&
          ventas[0].montoCentavos === 10000 &&
          gastos.length === (destino === "gasto" ? 4 : 3) &&
          (destino === "bolivares" ||
            gastos.some(
              (g) => g.nota === "Resto de la venta" && g.categoriaId === familia.id && g.montoCentavos === 100000,
            )),
      );
      comprobar(
        "8",
        `Binance baja exactamente lo vendido, y Bolívares ${destino === "bolivares" ? "sube 1.000 Bs" : "queda igual"}`,
        enCuenta(despues, binance.id) === enCuenta(antes, binance.id) - 10000 &&
          enCuenta(despues, bolivares.id) === enCuenta(antes, bolivares.id) + (destino === "bolivares" ? 100000 : 0),
      );
      comprobar(
        "8",
        "y los pendientes desaparecen",
        !(await Promise.all(v.pendientes.map((p) => existe(p.id)))).some(Boolean),
      );
      await cuadra(`tras completar varios con el resto a ${destino}`);
    }

    // ★ 9 y 10 · todo o nada
    const malos = await varios(["1000", "3000"], "");
    if (malos.preparado.estado !== "ok") throw new Error("Sin resto debía preparar");
    const capturaMala = idDePrueba();
    const filasMalas = filasDeVarios(capturaMala, malos.preparado.filas, malos.items).map((f, i, todas) =>
      // La última fila con una categoría que no existe: la base la rechaza cuando las demás ya se escribieron.
      i === todas.length - 1 ? { ...f, categoriaId: 2_147_483_000 } : f,
    );
    const antesDeFallar = await estado();
    let lanzo = false;
    try {
      await completarPorCompletar(capturaMala, malos.preparado.pendientes, filasMalas);
    } catch {
      lanzo = true;
    }
    comprobar(
      "9",
      "si una fila falla, no se guarda ninguna (ni la venta ni los otros gastos) y los pendientes siguen",
      lanzo &&
        (await deCaptura(capturaMala)).length === 0 &&
        (await estado()).huella === antesDeFallar.huella &&
        (await Promise.all(malos.pendientes.map((p) => existe(p.id)))).every(Boolean),
    );
    await descartarPorCompletar(malos.pendientes[1].id);
    const capturaFalta = idDePrueba();
    const rFalta = await completarPorCompletar(
      capturaFalta,
      malos.preparado.pendientes,
      filasDeVarios(capturaFalta, malos.preparado.filas, malos.items),
    );
    comprobar(
      "10",
      "si uno de los elegidos ya no existe, no se guarda nada y el otro sigue",
      "faltan" in rFalta && (await deCaptura(capturaFalta)).length === 0 && (await existe(malos.pendientes[0].id)),
    );
    await cuadra("tras los intentos que no guardan");

    if (origen) {
      // Las páginas, como un navegador sin JavaScript, contra un servidor con esta misma base.
      console.log(`— páginas, contra ${origen}`);
      const sesion = await abrirSesion(origen);
      try {
        const formularioDe = (html: string) =>
          [...html.matchAll(/<form[\s\S]*?<\/form>/g)].map((m) => m[0]).find((f) => f.includes('name="monto"')) ?? "";
        const entrada = (form: string, nombre: string, valor?: string) =>
          [...form.matchAll(/<input[^>]*>/g)]
            .map((m) => m[0])
            .find((i) => i.includes(`name="${nombre}"`) && (valor === undefined || i.includes(`value="${valor}"`)));
        const marcada = (form: string, nombre: string, valor: string) =>
          entrada(form, nombre, valor)?.includes("checked") ?? false;

        const llenar = await anotar({
          nota: "comprobar-009 página",
          monto: "3650",
          moneda: "VES",
          fecha: ayer,
          categoriaId: catB.id,
        });
        const conPendiente = await sesion.pagina(`/nuevo/gasto?pendiente=${llenar.id}`);
        const form = formularioDe(conPendiente.html);
        comprobar(
          "6",
          "Completar abre la captura con su categoría, descripción, fecha y monto, y en Bs vendiendo USDT",
          conPendiente.estado === 200 &&
            texto(conPendiente.html).includes("Completar gasto") &&
            Boolean(entrada(form, "pendienteId", String(llenar.id))) &&
            Boolean(entrada(form, "monto", centavosATexto(365000))) &&
            Boolean(entrada(form, "nota", "comprobar-009 página")) &&
            Boolean(entrada(form, "fecha", ayer)) &&
            marcada(form, "categoriaId", String(catB.id)) &&
            marcada(form, "forma", "vendiendo"),
        );
        const normal = await sesion.pagina("/nuevo/gasto");
        comprobar(
          "11",
          "sin ?pendiente=, la captura de siempre: 'Nuevo gasto', sin pendiente y en dólares",
          normal.estado === 200 &&
            !normal.html.includes('name="pendienteId"') &&
            texto(normal.html).includes("Nuevo gasto") &&
            marcada(formularioDe(normal.html), "forma", "dolares"),
        );
        const n = await contarPorCompletar();
        const aviso = n === 1 ? "1 gasto por completar" : `${n} gastos por completar`;
        const [inicio, registrar] = [await sesion.pagina("/"), await sesion.pagina("/nuevo")];
        comprobar(
          "5",
          `el inicio y Registrar dicen "${aviso}"`,
          texto(inicio.html).includes(aviso) && texto(registrar.html).includes(aviso),
        );

        /**
         * Envía la captura de un pendiente como un navegador sin JavaScript: los ocultos de la página que se abrió
         * (`abierta`, si se abrió antes) y lo tecleado.
         */
        async function enviar(pendienteId: number, captura: string, abierta?: string) {
          const ruta = `/nuevo/gasto?pendiente=${pendienteId}`;
          const html = abierta ?? (await sesion.pagina(ruta)).html;
          const datos = new FormData();
          for (const oculto of formularioDe(html).matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
            const nombre = /name="([^"]*)"/.exec(oculto[0])?.[1];
            if (nombre && nombre !== "fecha") datos.set(nombre, texto(/value="([^"]*)"/.exec(oculto[0])?.[1] ?? ""));
          }
          const campos = {
            idCaptura: captura,
            forma: "dolares",
            monto: "12",
            cuentaId: String(prima!.id),
            cuentaVentaId: "",
            vendido: "",
            tasa: "",
            categoriaId: String(catA.id),
            sobreId: String(gastosDelMes!.id),
            etiquetaId: "",
            etiquetaNueva: "",
            fecha: hoy,
            nota: "comprobar-009 enviado",
          };
          for (const [k, v] of Object.entries(campos)) datos.set(k, v);
          return sesion.enviar(ruta, datos);
        }
        const yaNo = await anotar({ nota: "comprobar-009 ya no", monto: "12", moneda: "USD" });
        const capturaYaNo = idDePrueba();
        const { html: formularioYaNo } = await sesion.pagina(`/nuevo/gasto?pendiente=${yaNo.id}`);
        await descartarPorCompletar(yaNo.id);
        const rYaNo = await enviar(yaNo.id, capturaYaNo, formularioYaNo);
        comprobar(
          "7",
          'guardar uno descartado después de abrirlo: "Este gasto ya se completó o se descartó", sin gasto',
          formularioYaNo.includes('name="pendienteId"') &&
            rYaNo.estado === 200 &&
            texto(rYaNo.html).includes("Este gasto ya se completó o se descartó") &&
            (await deCaptura(capturaYaNo)).length === 0,
          `${rYaNo.estado}`,
        );
        const vigente = await anotar({ nota: "comprobar-009 vigente", monto: "12", moneda: "USD" });
        const capturaVigente = idDePrueba();
        const rVigente = await enviar(vigente.id, capturaVigente);
        const lista = await sesion.pagina(rVigente.ubicacion ?? "/por-completar");
        comprobar(
          "6",
          'guardar uno vigente lo registra, lo borra y vuelve a la lista con "Completado"',
          rVigente.estado === 303 &&
            rVigente.ubicacion === "/por-completar?completado=1" &&
            (await deCaptura(capturaVigente)).length === 1 &&
            !(await existe(vigente.id)) &&
            texto(lista.html).includes("Completado"),
          `${rVigente.estado} ${rVigente.ubicacion}`,
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
    "1",
    "al terminar, la base queda como estaba, también los pendientes",
    final.huella === inicial.huella && final.filas === inicial.filas && final.pendientes === inicial.pendientes,
  );
  console.log(fallos === 0 ? "\n✓ comprobar-009: todo en verde" : `\n✗ comprobar-009: ${fallos} fallos`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
