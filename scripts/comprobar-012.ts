/**
 * Los criterios ★ de la spec 012 (importar el historial de Gestor de Gastos) contra la base local:
 *   ★ 1 · entran todas las filas del archivo menos las omitidas, cada una con su cuenta, categoría y etiqueta;
 *   ★ 2 · ningún saldo de cuenta ni de sobre cambia, ni el cuadre, aunque las filas sí estén en la base;
 *   ★ 3 · correrlo otra vez no duplica;
 *   ★ 4 · lo importado sale en las gráficas y en el acumulado de su etiqueta, y no se abre ni se edita.
 * Con --url, además, contra un servidor en marcha con esta misma base y el usuario de prueba: /movimientos muestra lo
 * importado sin enlace, y /cuentas y /sobres se ven igual que antes.
 *   pnpm exec tsx scripts/comprobar-012.ts <archivo.xlsx> [--url http://localhost:3000]
 * Deja la base como estaba: borra lo importado y las cuentas, categorías y etiquetas que creó. Se niega si ya hay algo
 * importado.
 */
import { execSync } from "node:child_process";
import { config } from "dotenv";
import { and, count, eq, gte, lte, sql } from "drizzle-orm";
import { claveDeNombre } from "../src/lib/categorias";
import { exigirBaseLocal } from "../src/lib/destino-base";
import { hoyEnCaracas } from "../src/lib/fechas";
import { leerExportacion } from "../src/lib/leer-exportacion";
import { abrirSesion, texto } from "./comprobar-003-paginas";

let fallos = 0;
function comprobar(criterio: string, descripcion: string, ok: boolean, detalle = "") {
  if (!ok) fallos++;
  console.log(`${ok ? "✓" : "✗"} ${criterio} · ${descripcion}${detalle ? ` (${detalle})` : ""}`);
}

async function main() {
  config({ path: ".env.local" });
  // Escribe filas: solo en la base local (spec 002, criterio 10).
  exigirBaseLocal(process.env.DATABASE_URL, "comprobar-012");
  const archivo = process.argv.slice(2).find((a, i, todos) => !a.startsWith("--") && todos[i - 1] !== "--url");
  if (!archivo) throw new Error("Falta el archivo: pnpm exec tsx scripts/comprobar-012.ts <archivo.xlsx>");
  const posicionUrl = process.argv.indexOf("--url");
  const origenUrl = posicionUrl >= 0 ? process.argv[posicionUrl + 1] : null;
  const { db, categorias, cuentas, etiquetas, movimientos } = await import("../src/db/index");
  const { saldosPorCuenta, saldosPorSobre, baseMovimientos } = await import("../src/db/consultas");
  const { totalesPorCategoria, etiquetasDelPeriodo } = await import("../src/db/movimientos-del-periodo");
  const { movimientoParaEditar } = await import("../src/db/editar-movimientos");
  const { leerXlsx } = await import("../src/db/leer-xlsx");
  const { esHistorial } = await import("../src/db/sumas-de-saldo");

  const importados = esHistorial;
  const cuantos = async () => (await db.select({ n: count() }).from(movimientos).where(importados))[0].n;
  if ((await cuantos()) > 0) throw new Error("Ya hay movimientos importados en esta base: no se toca.");

  const nombres = async () => ({
    cuentas: (await db.select().from(cuentas)).map((c) => claveDeNombre(c.nombre)),
    categorias: (await db.select().from(categorias)).map((c) => `${c.tipo}|${claveDeNombre(c.nombre)}`),
    etiquetas: (await db.select().from(etiquetas)).map((e) => e.clave),
  });
  const habia = await nombres();
  /** Cada saldo de cuenta (en su moneda y en dólares) y de sobre, y la diferencia del cuadre, por nombre. */
  const saldos = async () => {
    const [deCuentas, deSobres] = await Promise.all([saldosPorCuenta(), saldosPorSobre()]);
    const cuadre =
      deSobres.reduce((a, s) => a + s.saldoCentavos, 0) - deCuentas.reduce((a, c) => a + c.saldoUsdCentavos, 0);
    return new Map<string, number>([
      ...deCuentas.flatMap((c) => [
        [`${c.nombre}`, c.saldoCentavos] as const,
        [`${c.nombre} en USD`, c.saldoUsdCentavos] as const,
      ]),
      ...deSobres.map((s) => [`sobre ${s.nombre}`, s.saldoCentavos] as const),
      ["cuadre", cuadre],
    ]);
  };
  /** Lo que cambió respecto de antes; una cuenta o un sobre que no estaba solo vale si queda en 0. */
  const cambios = (antes: Map<string, number>, despues: Map<string, number>) =>
    [...new Set([...antes.keys(), ...despues.keys()])]
      .filter((k) => (antes.get(k) ?? 0) !== (despues.get(k) ?? 0))
      .map((k) => `${k}: ${antes.get(k) ?? "no estaba"} → ${despues.get(k) ?? "no está"}`);
  const marzo = { desde: "2026-03-01", hasta: "2026-03-31" };
  const gastadoEnMarzo = async () => (await totalesPorCategoria("gastos", marzo)).reduce((a, c) => a + c.centavos, 0);
  const antes = { saldos: await saldos(), marzo: await gastadoEnMarzo() };
  const paginas = origenUrl ? await abrirSesion(origenUrl) : null;
  const verPagina = async (ruta: string) =>
    paginas ? texto((await paginas.pagina(ruta)).html).replace(/\s+/g, " ") : "";
  const paginasAntes = { cuentas: await verPagina("/cuentas"), sobres: await verPagina("/sobres") };

  const importar = () =>
    execSync(`pnpm --silent db:importar "${archivo}" --aplicar`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  try {
    const salida = importar();
    const filasDelArchivo = leerExportacion(leerXlsx(archivo), hoyEnCaracas(new Date())).filas.length;
    const omitidas = salida.split("\n").filter((l) => l.includes(" → ")).length;
    const insertadas = Number(/Importados (\d+)/.exec(salida)?.[1] ?? -1);

    comprobar(
      "★ 1",
      "entran todas las filas menos las omitidas",
      (await cuantos()) === filasDelArchivo - omitidas,
      `${await cuantos()} de ${filasDelArchivo}, ${omitidas} omitidas`,
    );
    comprobar("★ 1", "la salida cuenta lo mismo que la base", insertadas === (await cuantos()), `${insertadas}`);
    const fila = async (fecha: string, centavos: number) =>
      (
        await baseMovimientos().where(
          and(importados, eq(movimientos.fecha, fecha), eq(movimientos.montoUsdCentavos, centavos)),
        )
      )[0];
    const flores = await fila("2026-09-29", 6500);
    comprobar(
      "★ 1",
      "Ahorro Earn entra a Binance, en Daniela",
      flores?.cuentaOrigen === "Binance" && flores?.categoria === "Daniela",
      `${flores?.cuentaOrigen} · ${flores?.categoria}`,
    );
    const sax = await fila("2026-09-30", 121500);
    comprobar(
      "★ 1",
      "Zelle es la Cuenta prima, con su etiqueta",
      sax?.cuentaDestino === "Cuenta prima" && sax?.etiqueta === "SAX" && sax?.categoria === "Sueldo remoto",
      `${sax?.cuentaDestino} · ${sax?.etiqueta} · ${sax?.categoria}`,
    );
    const pizza = await fila("2025-09-07", 965);
    comprobar(
      "★ 1",
      "lo pagado en bolívares queda en Bolívares, con los dos montos",
      pizza?.cuentaOrigen === "Bolívares" && pizza?.montoCentavos === 148200 && pizza?.moneda === "VES",
      `${pizza?.montoCentavos} ${pizza?.moneda}`,
    );
    const curso = await fila("2025-11-12", 1000).then(
      async () => (await baseMovimientos().where(and(importados, eq(movimientos.tipo, "transferencia"))))[0],
    );
    comprobar(
      "★ 1",
      "la transferencia va de Binance a Zinli, que se creó en dólares",
      curso?.cuentaOrigen === "Binance" && curso?.cuentaDestino === "Zinli" && curso?.monedaDestino === "USD",
      `${curso?.cuentaOrigen} → ${curso?.cuentaDestino} ${curso?.monedaDestino}`,
    );
    const [zinli] = await db.select().from(cuentas).where(eq(cuentas.nombre, "Zinli"));
    comprobar("★ 1", "Zinli es una billetera en USD", zinli?.moneda === "USD" && zinli?.tipo === "billetera");
    const [dani] = await db
      .select({ n: count() })
      .from(movimientos)
      .where(and(importados, eq(movimientos.fecha, "2026-10-04"), eq(movimientos.montoUsdCentavos, 12500)));
    comprobar("★ 1", "el boleto de Dani no entra", dani.n === 0);

    const cambiaron = cambios(antes.saldos, await saldos());
    comprobar(
      "★ 2",
      "ningún saldo de cuenta ni de sobre cambia, ni el cuadre",
      cambiaron.length === 0,
      cambiaron.join(" · ") || `${antes.saldos.size} saldos iguales`,
    );
    const [crudo] = await db
      .select({ centavos: sql<number>`coalesce(sum(${movimientos.montoUsdCentavos}), 0)::bigint`.mapWith(Number) })
      .from(movimientos)
      .where(and(importados, eq(movimientos.tipo, "gasto")));
    comprobar("★ 2", "aunque los gastos importados sí están en la base", crudo.centavos > 0, `${crudo.centavos}`);

    const otraVez = importar();
    comprobar(
      "★ 3",
      "correrlo otra vez no duplica",
      /Importados 0 /.test(otraVez) && (await cuantos()) === insertadas,
      `${await cuantos()}`,
    );

    const [importadoMarzo] = await db
      .select({ centavos: sql<number>`coalesce(sum(${movimientos.montoUsdCentavos}), 0)::bigint`.mapWith(Number) })
      .from(movimientos)
      .where(
        and(
          importados,
          eq(movimientos.tipo, "gasto"),
          gte(movimientos.fecha, marzo.desde),
          lte(movimientos.fecha, marzo.hasta),
        ),
      );
    const marzoDespues = await gastadoEnMarzo();
    comprobar(
      "★ 4",
      "la gráfica por categoría de marzo de 2026 suma lo importado",
      marzoDespues - antes.marzo === importadoMarzo.centavos && importadoMarzo.centavos > 0,
      `${antes.marzo} → ${marzoDespues}`,
    );
    const kumia = (await etiquetasDelPeriodo("ingresos", { desde: "2025-01-01", hasta: "2026-12-31" }, null)).find(
      (e) => e.nombre === "KumIA",
    );
    comprobar(
      "★ 4",
      "el acumulado de KumIA es lo cobrado en la app vieja",
      kumia?.centavos === 482000,
      `${kumia?.centavos}`,
    );
    comprobar(
      "★ 4",
      "no se abre para editar",
      (await movimientoParaEditar(flores?.id ?? 0)) === null && flores?.historial === true,
    );

    if (paginas) {
      const octubre = await paginas.pagina("/movimientos?fecha=2026-10-13");
      const shawarma = (await fila("2026-10-13", 1800))?.id;
      comprobar("★ 4", "/movimientos de octubre muestra lo importado", texto(octubre.html).includes("Shawuarma Sweda"));
      comprobar(
        "★ 4",
        "y su fila no lleva a ninguna parte",
        !octubre.html.includes(`/movimientos/${shawarma}?`),
        `id ${shawarma}`,
      );
      // Zinli es nueva: la única diferencia admitida es su fila en 0 y una cuenta más en el conteo.
      const cuentasDespues = (await verPagina("/cuentas")).replace("ZinliBilletera · USD0,00USD", "");
      const conteo = (t: string) => Number(/(\d+) cuentas/.exec(t)?.[1]);
      comprobar(
        "★ 2",
        "/cuentas da los mismos totales, con Zinli en 0",
        cuentasDespues.replace(/\d+ cuentas/, "") === paginasAntes.cuentas.replace(/\d+ cuentas/, "") &&
          conteo(cuentasDespues) === conteo(paginasAntes.cuentas) + 1,
      );
      comprobar("★ 2", "/sobres se ve igual que antes", (await verPagina("/sobres")) === paginasAntes.sobres);
    }
  } finally {
    await db.delete(movimientos).where(importados);
    const hay = await nombres();
    for (const c of await db.select().from(cuentas)) {
      if (!habia.cuentas.includes(claveDeNombre(c.nombre))) await db.delete(cuentas).where(eq(cuentas.id, c.id));
    }
    for (const c of await db.select().from(categorias)) {
      if (!habia.categorias.includes(`${c.tipo}|${claveDeNombre(c.nombre)}`))
        await db.delete(categorias).where(eq(categorias.id, c.id));
    }
    for (const e of await db.select().from(etiquetas)) {
      if (!habia.etiquetas.includes(e.clave)) await db.delete(etiquetas).where(eq(etiquetas.id, e.id));
    }
    const quedo = await nombres();
    const igual = JSON.stringify(quedo) === JSON.stringify(habia) && cambios(antes.saldos, await saldos()).length === 0;
    comprobar(
      "—",
      "la base queda como estaba",
      igual,
      `${hay.categorias.length - quedo.categorias.length} categorías borradas`,
    );
    await db.$client.end();
  }
  if (fallos > 0) {
    console.log(`\n${fallos} fallaron.`);
    process.exit(1);
  }
  console.log("\nTodo en verde.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
