/**
 * Los criterios ★ de la spec 011 (transferir entre cuentas) contra la base:
 *   ★ 1 · salió 100 y llegó 99: la cuenta de origen baja 100, la de destino sube 99, el sobre de la comisión baja 1,
 *         la comisión es un gasto en "Comisiones", y el cuadre se mantiene;
 *   ★ 2 · un reintento con el mismo id no duplica;
 *   ★ 3 · deshacer borra la transferencia y su comisión, y todo vuelve a como estaba; dos veces, "no existe";
 *   ★ 4 · la comisión se edita y se borra como un gasto suelto, sin tocar la transferencia; la venta de USDT de un
 *         gasto en bolívares nunca se deshace como transferencia.
 * Con --url, además, contra un servidor en marcha con esta misma base y el usuario de prueba, como un navegador sin
 * JavaScript: la pantalla, guardar y volver a Cuentas con el aviso, la fila en Movimientos y su "Deshacer".
 *   pnpm exec tsx scripts/comprobar-011.ts [--url http://localhost:3000]
 * Corre sobre la base local con los datos de demostración y la deja como estaba. Lo suyo son capturas cuyo id empieza
 * por 0c011011, que se borran al terminar y, si una corrida se cortó, al empezar la siguiente; y la categoría
 * "Comisiones" si la creó ella. Se niega ante movimientos que no sean de demostración.
 */
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { and, count, eq, isNull, like, not, or } from "drizzle-orm";
import { referenciaDeCaptura } from "../src/lib/captura";
import { claveDeNombre } from "../src/lib/categorias";
import { exigirBaseLocal } from "../src/lib/destino-base";
import { hoyEnCaracas } from "../src/lib/fechas";
import { type EntradaTransferencia, categoriaDeComisiones, prepararTransferencia } from "../src/lib/transferencias";
import { abrirSesion, texto } from "./comprobar-003-paginas";

const MARCA = "0c011011";
let fallos = 0;

function comprobar(criterio: string, descripcion: string, ok: boolean, detalle = "") {
  if (!ok) fallos++;
  console.log(`${ok ? "✓" : "✗"} ${criterio} · ${descripcion}${detalle ? ` (${detalle})` : ""}`);
}

const idDePrueba = () => `${MARCA}${randomUUID().slice(8)}`;

async function main() {
  config({ path: ".env.local" });
  // Escribe filas: solo en la base local (spec 002, criterio 10).
  exigirBaseLocal(process.env.DATABASE_URL, "comprobar-011");
  const posicionUrl = process.argv.indexOf("--url");
  const origenUrl = posicionUrl >= 0 ? process.argv[posicionUrl + 1] : null;
  const { db, categorias, movimientos } = await import("../src/db/index");
  const { saldosPorCuenta, saldosPorSobre, sobresParaGasto } = await import("../src/db/consultas");
  const { registrarTransferencia, transferenciaParaDeshacer, deshacerTransferencia } =
    await import("../src/db/transferencias");
  const { borrarGasto, movimientoParaEditar } = await import("../src/db/editar-movimientos");

  const nuestros = like(movimientos.referenciaExterna, `captura-${MARCA}-%`);
  const comisiones = async () =>
    (await db.select().from(categorias).where(eq(categorias.tipo, "gasto"))).find(
      (c) => claveDeNombre(c.nombre) === claveDeNombre(categoriaDeComisiones),
    );
  await db.delete(movimientos).where(nuestros);
  const habiaComisiones = (await comisiones()) !== undefined;
  const [{ reales }] = await db
    .select({ reales: count() })
    .from(movimientos)
    .where(or(isNull(movimientos.referenciaExterna), not(like(movimientos.referenciaExterna, "demo-%"))));
  if (reales > 0) throw new Error(`Hay ${reales} movimientos que no son de demostración. No se toca esta base.`);

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
  const enCuenta = (e: Estado, id: number) => e.cuentas.find((c) => c.id === id)?.saldoCentavos ?? NaN;
  const enSobre = (e: Estado, id: number) => e.sobres.find((s) => s.id === id)?.saldoCentavos ?? NaN;

  const inicial = await estado();
  const hoy = hoyEnCaracas(new Date());
  const prima = inicial.cuentas.find((c) => c.nombre === "Cuenta prima");
  const binance = inicial.cuentas.find((c) => c.nombre === "Binance");
  const sobres = await sobresParaGasto();
  const gastosDelMes = sobres.find((s) => s.tipo === "gastos");
  if (!prima || !binance || !gastosDelMes) throw new Error("Faltan datos base: corre pnpm db:seed y pnpm db:demo");
  console.log(`Base local · hoy en Caracas ${hoy} · ${inicial.filas} movimientos`);
  comprobar("1", "al empezar, Cuadra", inicial.cuadra);

  const filaPorReferencia = async (referencia: string) =>
    (await db.select().from(movimientos).where(eq(movimientos.referenciaExterna, referencia)))[0] ?? null;
  async function transferir(cambios: Partial<EntradaTransferencia> = {}, captura = idDePrueba()) {
    const p = prepararTransferencia(
      {
        origenId: prima!.id,
        destinoId: binance!.id,
        salio: "100",
        llego: "99",
        sobreId: gastosDelMes!.id,
        fecha: "hoy",
        nota: "comprobar-011",
        ...cambios,
      },
      inicial.cuentas,
      sobres,
      hoy,
    );
    if (!p.ok) throw new Error(`prepararTransferencia rechazó: ${JSON.stringify(p.errores)}`);
    const r = await registrarTransferencia(captura, p.transferencia, p.comision);
    return {
      captura,
      r,
      p,
      envio: await filaPorReferencia(referenciaDeCaptura(captura, "envio")),
      comision: await filaPorReferencia(referenciaDeCaptura(captura, "comision")),
    };
  }

  try {
    // ★ 1 · con comisión
    const antes = await estado();
    const t = await transferir();
    const tras = await estado();
    const categoria = await comisiones();
    comprobar(
      "1",
      "salió 100 y llegó 99: Cuenta prima baja 100, Binance sube 99 y Gastos del mes baja 1",
      enCuenta(tras, prima.id) === enCuenta(antes, prima.id) - 10_000 &&
        enCuenta(tras, binance.id) === enCuenta(antes, binance.id) + 9_900 &&
        enSobre(tras, gastosDelMes.id) === enSobre(antes, gastosDelMes.id) - 100,
    );
    comprobar(
      "1",
      "la transferencia guarda lo que llegó y la moneda de destino; la comisión es un gasto en Comisiones",
      t.envio?.tipo === "transferencia" &&
        t.envio.montoCentavos === 9_900 &&
        t.envio.montoDestinoCentavos === 9_900 &&
        t.envio.monedaDestino === "USDT" &&
        t.comision?.tipo === "gasto" &&
        t.comision.montoCentavos === 100 &&
        t.comision.categoriaId === categoria?.id &&
        t.comision.sobreOrigenId === gastosDelMes.id,
      `categoría ${categoria?.nombre ?? "ninguna"}`,
    );
    comprobar("1", "Cuadra tras transferir con comisión", tras.cuadra);

    // ★ 2 · el reintento no duplica
    const otra = await registrarTransferencia(t.captura, t.p.transferencia, t.p.comision);
    comprobar(
      "2",
      "guardar otra vez con el mismo id no duplica: devuelve lo guardado",
      !otra.nueva && otra.guardadas.length === 2 && (await estado()).filas === tras.filas,
    );

    // ★ 4 · la comisión es un gasto suelto; la transferencia se abre para deshacer
    const comoGasto = t.comision ? await movimientoParaEditar(t.comision.id) : null;
    const comoTransferencia = t.envio ? await transferenciaParaDeshacer(t.envio.id) : null;
    comprobar(
      "4",
      "la comisión se abre como un gasto sin venta; la transferencia, para deshacerla, con su comisión",
      comoGasto !== null &&
        comoGasto.venta === null &&
        t.envio !== null &&
        (await movimientoParaEditar(t.envio.id)) === null &&
        comoTransferencia?.comision?.montoCentavos === 100 &&
        comoTransferencia.origen === "Cuenta prima" &&
        comoTransferencia.destino === "Binance",
    );
    const ventas = await db
      .select({ id: movimientos.id })
      .from(movimientos)
      .where(and(eq(movimientos.tipo, "transferencia"), not(like(movimientos.referenciaExterna, "%-envio"))))
      .limit(5);
    let abiertas = 0;
    for (const v of ventas) if ((await transferenciaParaDeshacer(v.id)) !== null) abiertas++;
    comprobar(
      "4",
      "ninguna venta de USDT de un gasto se abre ni se deshace como transferencia",
      ventas.length > 0 && abiertas === 0 && "noExiste" in (await deshacerTransferencia(ventas[0].id)),
      `${ventas.length} ventas`,
    );

    // ★ 3 · deshacer
    const rD = t.envio ? await deshacerTransferencia(t.envio.id) : { noExiste: true as const };
    comprobar(
      "3",
      "deshacer borra la transferencia y su comisión: todo vuelve a como estaba",
      "ok" in rD &&
        (await filaPorReferencia(referenciaDeCaptura(t.captura, "comision"))) === null &&
        (await estado()).huella === antes.huella,
    );
    comprobar(
      "3",
      "deshacer otra vez responde que no existe",
      "noExiste" in (await deshacerTransferencia(t.envio!.id)),
    );

    // Sin comisión
    const sin = await transferir({ llego: "", sobreId: null });
    comprobar(
      "1",
      "si llegó lo mismo, solo la transferencia: sin comisión ni gasto",
      sin.envio?.montoCentavos === 10_000 && sin.comision === null && (await estado()).cuadra,
    );
    await deshacerTransferencia(sin.envio!.id);

    // ★ 4 · borrar solo la comisión deja la transferencia
    const u = await transferir();
    const rG = u.comision ? await borrarGasto(u.comision.id) : { noExiste: true as const };
    comprobar(
      "4",
      "borrar la comisión como gasto deja la transferencia, y deshacerla después también funciona",
      "ok" in rG &&
        (await filaPorReferencia(referenciaDeCaptura(u.captura, "envio"))) !== null &&
        "ok" in (await deshacerTransferencia(u.envio!.id)) &&
        (await estado()).huella === antes.huella,
    );

    if (origenUrl) {
      console.log(`— páginas, contra ${origenUrl}`);
      const sesion = await abrirSesion(origenUrl);
      try {
        const pagina = await sesion.pagina("/nuevo/transferir");
        const form =
          [...pagina.html.matchAll(/<form[\s\S]*?<\/form>/g)]
            .map((m) => m[0])
            .find((f) => f.includes('name="salio"')) ?? "";
        comprobar(
          "1",
          "la pantalla tiene De, A, cuánto salió y cuánto llegó, y la comisión con Gastos del mes elegido",
          pagina.estado === 200 &&
            ["De", "Cuánto salió", "Cuánto llegó", "La comisión sale de"].every((t2) => texto(form).includes(t2)) &&
            new RegExp(`value="${gastosDelMes.id}"[^>]*checked|checked[^>]*value="${gastosDelMes.id}"`).test(form),
        );
        const datos = new FormData();
        for (const m of form.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
          const nombre = /name="([^"]*)"/.exec(m[0])?.[1];
          if (nombre) datos.set(nombre, texto(/value="([^"]*)"/.exec(m[0])?.[1] ?? ""));
        }
        const captura = idDePrueba();
        for (const [k, v] of Object.entries({
          idCaptura: captura,
          origenId: String(prima.id),
          destinoId: String(binance.id),
          salio: "50",
          llego: "49,50",
          sobreId: String(gastosDelMes.id),
          fecha: "hoy",
          nota: "comprobar-011 página",
        }))
          datos.set(k, v);
        const r = await sesion.enviar("/nuevo/transferir", datos);
        const envio = await filaPorReferencia(referenciaDeCaptura(captura, "envio"));
        comprobar(
          "1",
          "sin JavaScript, guardar vuelve a Cuentas con el aviso, y quedan la transferencia y la comisión de 0,50",
          r.estado === 303 &&
            r.ubicacion === "/cuentas?transferido=1" &&
            envio?.montoCentavos === 4_950 &&
            (await filaPorReferencia(referenciaDeCaptura(captura, "comision")))?.montoCentavos === 50,
          `${r.estado} ${r.ubicacion}`,
        );
        const reintento = await sesion.enviar("/nuevo/transferir", datos);
        comprobar(
          "2",
          "reenviar lo mismo no duplica",
          reintento.estado === 303 && (await db.select().from(movimientos).where(nuestros)).length === 2,
        );
        const mover = texto((await sesion.pagina("/movimientos?tipo=mover")).html);
        const detalle = texto((await sesion.pagina(`/movimientos/${envio?.id}?borrar=1`)).html);
        comprobar(
          "3",
          "aparece en Movimientos como Cuenta prima → Binance, y se abre con «Deshacer transferencia»",
          mover.includes("Cuenta prima → Binance") &&
            detalle.includes("Deshacer transferencia") &&
            detalle.includes("y su comisión de 0,50 USD") &&
            detalle.includes("Sí, deshacer"),
        );
      } finally {
        await sesion.salir();
      }
    }
  } finally {
    await db.delete(movimientos).where(nuestros);
    if (!habiaComisiones) {
      const creada = await comisiones();
      if (creada) {
        const [{ usos }] = await db
          .select({ usos: count() })
          .from(movimientos)
          .where(eq(movimientos.categoriaId, creada.id));
        if (usos === 0) await db.delete(categorias).where(eq(categorias.id, creada.id));
      }
    }
  }

  const final = await estado();
  comprobar(
    "1",
    "al terminar, la base queda como estaba",
    final.huella === inicial.huella &&
      final.filas === inicial.filas &&
      ((await comisiones()) !== undefined) === habiaComisiones,
  );
  console.log(fallos === 0 ? "\n✓ comprobar-011: todo en verde" : `\n✗ comprobar-011: ${fallos} fallos`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
