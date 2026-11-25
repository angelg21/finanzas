/**
 * Los criterios ★ de la spec 014 (pagar una deuda desde cualquier sobre, y como gasto si se quiere) contra la base:
 *   ★ 2 · un pago desde Gastos del mes baja ese sobre y la cuenta, no Deudas; el pendiente baja y el cuadre se mantiene;
 *   ★ 3 · desde Por asignar no se guarda;
 *   ★ 5 · con categoría es un solo movimiento y cuenta en los gastos (lista, anillo, gastado del mes, gráfica), no en
 *         Mover; sin ella, en Mover y fuera de los gastos;
 *   ★ 6 · con una categoría de ingreso no se guarda;
 *   ★ 7 · deshacer el pago con categoría devuelve todo y deja de contar en los gastos;
 *   ★ 8 · el reintento de la misma captura no duplica.
 * Con --url, además, contra un servidor en marcha con esta misma base y el usuario de prueba, como un navegador sin
 * JavaScript: el formulario con "Sale del sobre" y "¿También es un gasto?", pagar desde otro sobre con categoría, y el
 * error desde Por asignar.
 *   pnpm exec tsx scripts/comprobar-014.ts [--url http://localhost:3000]
 * Corre sobre la base local y la deja como estaba: su deuda es de "Prueba 014" y sus pagos llevan la referencia
 * captura-0c014014-…; se borran al terminar y, si una corrida se cortó, al empezar la siguiente.
 */
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { and, eq, like } from "drizzle-orm";
import { referenciaDeCaptura } from "../src/lib/captura";
import { prepararPago } from "../src/lib/deudas";
import { exigirBaseLocal } from "../src/lib/destino-base";
import { hoyEnCaracas } from "../src/lib/fechas";
import { rangoDePeriodo } from "../src/lib/periodos";
import { abrirSesion, texto } from "./comprobar-003-paginas";

const MARCA = "0c014014";
let fallos = 0;

function comprobar(criterio: string, descripcion: string, ok: boolean, detalle = "") {
  if (!ok) fallos++;
  console.log(`${ok ? "✓" : "✗"} ${criterio} · ${descripcion}${detalle ? ` (${detalle})` : ""}`);
}

const idDePrueba = () => `${MARCA}${randomUUID().slice(8)}`;

async function main() {
  config({ path: ".env.local" });
  // Escribe filas: solo en la base local (spec 002, criterio 10).
  exigirBaseLocal(process.env.DATABASE_URL, "comprobar-014");
  const posicionUrl = process.argv.indexOf("--url");
  const origenUrl = posicionUrl >= 0 ? process.argv[posicionUrl + 1] : null;
  const { db, categorias, deudas, movimientos } = await import("../src/db/index");
  const { gastadoEsteMes, resumenMensual, saldosPorCuenta, saldosPorSobre } = await import("../src/db/consultas");
  const { deudaPorId } = await import("../src/db/deudas");
  const { pagarDeuda } = await import("../src/db/guardar-deudas");
  const { deshacerPagoOCobro } = await import("../src/db/deshacer-pago");
  const { movimientosDelPeriodo, totalesPorCategoria } = await import("../src/db/movimientos-del-periodo");

  const nuestros = like(movimientos.referenciaExterna, `captura-${MARCA}%`);
  const limpiar = async () => {
    await db.delete(movimientos).where(nuestros);
    await db.delete(deudas).where(eq(deudas.persona, "Prueba 014"));
  };
  await limpiar();

  const hoy = hoyEnCaracas(new Date());
  const dia = rangoDePeriodo("dia", hoy);
  const estado = async () => {
    const [c, s, gastado, meses, gastos, mover, porCategoria] = await Promise.all([
      saldosPorCuenta(),
      saldosPorSobre(),
      gastadoEsteMes(),
      resumenMensual(1),
      movimientosDelPeriodo("gastos", dia, null),
      movimientosDelPeriodo("mover", dia, null),
      totalesPorCategoria("gastos", dia),
    ]);
    return {
      cuentas: c,
      sobres: s,
      cuadra: c.reduce((a, x) => a + x.saldoUsdCentavos, 0) === s.reduce((a, x) => a + x.saldoCentavos, 0),
      gastado,
      gastosDelMesGrafica: meses.at(-1)?.gastosCentavos ?? NaN,
      enGastos: new Set(gastos.map((m) => m.id)),
      enMover: new Set(mover.map((m) => m.id)),
      porCategoria: new Map(porCategoria.map((p) => [p.categoriaId, p.centavos])),
    };
  };
  type Estado = Awaited<ReturnType<typeof estado>>;
  const enSobre = (e: Estado, id: number) => e.sobres.find((s) => s.id === id)?.saldoCentavos ?? NaN;
  const enCuenta = (e: Estado, id: number) => e.cuentas.find((c) => c.id === id)?.saldoCentavos ?? NaN;

  try {
    const antes = await estado();
    const binance = antes.cuentas.find((c) => c.nombre === "Binance");
    const gastosDelMes = antes.sobres.find((s) => s.tipo === "gastos");
    const sobreDeudas = antes.sobres.find((s) => s.tipo === "deudas");
    const porAsignar = antes.sobres.find((s) => s.tipo === "por_asignar");
    const [comida] = await db
      .select()
      .from(categorias)
      .where(and(eq(categorias.tipo, "gasto"), eq(categorias.activa, true)))
      .limit(1);
    const [deIngreso] = await db.select().from(categorias).where(eq(categorias.tipo, "ingreso")).limit(1);
    if (!binance || !gastosDelMes || !sobreDeudas || !porAsignar || !comida || !deIngreso) {
      throw new Error("Faltan Binance, Gastos del mes, Deudas, Por asignar o una categoría: corre pnpm db:seed.");
    }
    const [deuda] = await db
      .insert(deudas)
      .values({ sentido: "debo", persona: "Prueba 014", montoInicialCentavos: 10_000 })
      .returning({ id: deudas.id });
    const pendiente = async () => (await deudaPorId(deuda.id))?.pendienteCentavos ?? NaN;

    /** Prepara y guarda un pago de `monto` desde `sobreId`, con categoría o no, con su propia captura. */
    const pagar = async (monto: string, sobreId: number, categoriaId: number | null, captura = idDePrueba()) => {
      const d = await deudaPorId(deuda.id);
      const r = prepararPago(
        { monto, fecha: hoy, nota: "comprobar-014", cuenta: { id: binance.id, moneda: binance.moneda }, categoriaId },
        { id: deuda.id, sentido: "debo", pendienteCentavos: d?.pendienteCentavos ?? 0 },
        sobreId,
        hoy,
      );
      if (!r.ok) throw new Error(JSON.stringify(r.errores));
      const fila = { ...r.fila, referenciaExterna: referenciaDeCaptura(captura, "pago") };
      return { captura, fila, resultado: await pagarDeuda(captura, fila) };
    };
    const filaDe = async (captura: string) =>
      (
        await db
          .select()
          .from(movimientos)
          .where(eq(movimientos.referenciaExterna, referenciaDeCaptura(captura, "pago")))
      )[0];

    // ★ 2: sin categoría, desde Gastos del mes.
    const simple = await pagar("30", gastosDelMes.id, null);
    const filaSimple = await filaDe(simple.captura);
    const tras2 = await estado();
    comprobar(
      "2",
      "desde Gastos del mes baja ese sobre y la cuenta 30,00, Deudas no cambia, el pendiente baja y el cuadre se mantiene",
      enSobre(tras2, gastosDelMes.id) === enSobre(antes, gastosDelMes.id) - 3_000 &&
        enSobre(tras2, sobreDeudas.id) === enSobre(antes, sobreDeudas.id) &&
        enCuenta(tras2, binance.id) === enCuenta(antes, binance.id) - 3_000 &&
        (await pendiente()) === 7_000 &&
        tras2.cuadra === antes.cuadra,
    );
    comprobar(
      "5",
      "sin categoría va a Mover y no cuenta como gasto",
      tras2.enMover.has(filaSimple.id) && !tras2.enGastos.has(filaSimple.id) && tras2.gastado === antes.gastado,
    );

    // ★ 5: con categoría.
    const conGasto = await pagar("20", gastosDelMes.id, comida.id);
    const filaGasto = await filaDe(conGasto.captura);
    const tras5 = await estado();
    comprobar(
      "5",
      "con categoría es un solo pago_deuda y el dinero sale una vez (cuenta y sobre bajan 20,00)",
      (await db.select().from(movimientos).where(nuestros)).length === 2 &&
        filaGasto.tipo === "pago_deuda" &&
        filaGasto.categoriaId === comida.id &&
        enCuenta(tras5, binance.id) === enCuenta(tras2, binance.id) - 2_000 &&
        enSobre(tras5, gastosDelMes.id) === enSobre(tras2, gastosDelMes.id) - 2_000 &&
        tras5.cuadra === antes.cuadra,
    );
    comprobar(
      "5",
      "con categoría cuenta en Gastos (lista y anillo), en gastado del mes y en la gráfica, y no en Mover",
      tras5.enGastos.has(filaGasto.id) &&
        !tras5.enMover.has(filaGasto.id) &&
        (tras5.porCategoria.get(comida.id) ?? 0) === (tras2.porCategoria.get(comida.id) ?? 0) + 2_000 &&
        tras5.gastado === tras2.gastado + 2_000 &&
        tras5.gastosDelMesGrafica === tras2.gastosDelMesGrafica + 2_000,
      `gastado ${tras2.gastado} → ${tras5.gastado}`,
    );

    // ★ 8: el reintento de la misma captura.
    const otraVez = await pagarDeuda(conGasto.captura, conGasto.fila);
    comprobar(
      "8",
      "reenviar el mismo pago con sobre y categoría no duplica",
      "nueva" in otraVez &&
        otraVez.nueva === false &&
        (await db.select().from(movimientos).where(nuestros)).length === 2,
    );

    // ★ 3 y 6: lo que no se guarda.
    const falla = async (f: () => Promise<unknown>) =>
      f().then(
        () => false,
        () => true,
      );
    comprobar(
      "3",
      "desde Por asignar no se guarda",
      (await falla(() => pagar("1", porAsignar.id, null))) &&
        (await db.select().from(movimientos).where(nuestros)).length === 2,
    );
    comprobar(
      "6",
      "con una categoría de ingreso, o que no existe, no se guarda",
      (await falla(() => pagar("1", gastosDelMes.id, deIngreso.id))) &&
        (await falla(() => pagar("1", gastosDelMes.id, 999_999))) &&
        (await db.select().from(movimientos).where(nuestros)).length === 2,
    );

    // ★ 7: deshacer el pago con categoría.
    const deshecho = await deshacerPagoOCobro(filaGasto.id);
    const tras7 = await estado();
    comprobar(
      "7",
      "deshacer el pago con categoría devuelve sobre, cuenta y pendiente, y deja de contar como gasto",
      "ok" in deshecho &&
        enSobre(tras7, gastosDelMes.id) === enSobre(tras2, gastosDelMes.id) &&
        enCuenta(tras7, binance.id) === enCuenta(tras2, binance.id) &&
        (await pendiente()) === 7_000 &&
        tras7.gastado === tras2.gastado &&
        !tras7.enGastos.has(filaGasto.id),
    );

    if (origenUrl) {
      console.log(`— páginas, contra ${origenUrl}`);
      const sesion = await abrirSesion(origenUrl);
      try {
        const pagina = await sesion.pagina(`/deudas/${deuda.id}`);
        const form =
          [...pagina.html.matchAll(/<form[\s\S]*?<\/form>/g)]
            .map((m) => m[0])
            .find((f) => f.includes('name="sobreId"')) ?? "";
        /** Los radios de `name`: su valor y si van marcados. */
        const radios = (name: string) =>
          [...form.matchAll(new RegExp(`<input[^>]*name="${name}"[^>]*>`, "g"))].map((m) => ({
            valor: /value="([^"]*)"/.exec(m[0])?.[1],
            marcado: /\bchecked\b/.test(m[0]),
          }));
        const sobresDelForm = radios("sobreId");
        const categoriasDelForm = radios("categoriaId");
        comprobar(
          "1",
          "el formulario trae «Sale del sobre» con Deudas elegido y «¿También es un gasto?» con «No» elegido",
          pagina.estado === 200 &&
            texto(form).includes("Sale del sobre") &&
            texto(form).includes("¿También es un gasto?") &&
            sobresDelForm.some((r) => r.valor === String(sobreDeudas.id) && r.marcado) &&
            sobresDelForm.some((r) => r.valor === String(gastosDelMes.id)) &&
            !sobresDelForm.some((r) => r.valor === String(porAsignar.id)) &&
            categoriasDelForm.some((r) => r.valor === "" && r.marcado) &&
            categoriasDelForm.some((r) => r.valor === String(comida.id)),
        );
        const datos = new FormData();
        for (const m of form.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
          const nombre = /name="([^"]*)"/.exec(m[0])?.[1];
          if (nombre) datos.set(nombre, texto(/value="([^"]*)"/.exec(m[0])?.[1] ?? ""));
        }
        const captura = idDePrueba();
        for (const [k, v] of Object.entries({
          idCaptura: captura,
          monto: "10",
          cuentaId: String(binance.id),
          sobreId: String(gastosDelMes.id),
          categoriaId: String(comida.id),
          fecha: "hoy",
          nota: "comprobar-014 página",
        }))
          datos.set(k, v);
        const r = await sesion.enviar(`/deudas/${deuda.id}`, datos);
        const guardada = await filaDe(captura);
        comprobar(
          "5",
          "sin JavaScript, pagar 10,00 desde Gastos del mes como gasto guarda un pago con ese sobre y esa categoría",
          r.estado === 303 &&
            r.ubicacion === `/deudas/${deuda.id}?guardado=pago` &&
            guardada?.sobreOrigenId === gastosDelMes.id &&
            guardada.categoriaId === comida.id,
          `${r.estado} ${r.ubicacion}`,
        );
        const gastos = texto((await sesion.pagina("/movimientos")).html);
        comprobar(
          "5",
          "el pago sale en Movimientos → Gastos como «Pago a Prueba 014»",
          gastos.includes("Pago a Prueba 014"),
        );
        // Del guardián: deshacer dice el sobre del que salió, no siempre Deudas.
        const deshacer = texto((await sesion.pagina(`/movimientos/${guardada?.id}?borrar=1`)).html);
        comprobar(
          "7",
          `deshacer ese pago dice que vuelve «al sobre ${gastosDelMes.nombre}»`,
          deshacer.includes(`vuelve a la cuenta y al sobre ${gastosDelMes.nombre}`),
        );
        datos.set("idCaptura", idDePrueba());
        datos.set("sobreId", String(porAsignar.id));
        const mal = await sesion.enviar(`/deudas/${deuda.id}`, datos);
        comprobar(
          "3",
          "sin JavaScript, desde Por asignar responde «Elige de qué sobre sale el pago» y no guarda",
          texto(mal.html).includes("Elige de qué sobre sale el pago") &&
            (await db.select().from(movimientos).where(nuestros)).length === 2,
        );
      } finally {
        await sesion.salir();
      }
    }
  } finally {
    await limpiar();
  }
  console.log(fallos === 0 ? "\nTodo en verde." : `\n${fallos} criterio(s) en rojo.`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
