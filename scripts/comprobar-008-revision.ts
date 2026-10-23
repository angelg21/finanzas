/**
 * Lo que encontró la revisión de la spec 008 (2026-10-22) en /movimientos, contra un servidor en marcha con esta misma
 * base y el usuario de prueba, como un navegador sin JavaScript:
 *   2 · la pestaña Mover no se lleva el filtro de etiqueta, y en Mover la etiqueta no filtra;
 *   3 · la etiqueta activa conserva su píldora para quitarla aunque no tenga movimientos en el periodo o la categoría;
 *   4 · el campo de fecha sin JavaScript conserva la etiqueta.
 * Lo del selector (tocar una píldora filtrada, cerrar con la X) es del navegador con JavaScript: se mira en Edge.
 *   pnpm exec tsx scripts/comprobar-008-revision.ts --url http://localhost:3000
 * Lo suyo son capturas cuyo id empieza por 0c080018 y etiquetas que empiezan por "demo-c008r", que se borran al terminar
 * y, si una corrida se cortó, al empezar la siguiente. Se niega ante movimientos que no sean de demostración.
 */
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { count, isNull, like, not, or } from "drizzle-orm";
import { referenciaDeCaptura } from "../src/lib/captura";
import { exigirBaseLocal } from "../src/lib/destino-base";
import { nombreDeEtiqueta } from "../src/lib/etiquetas";
import { hoyEnCaracas } from "../src/lib/fechas";
import { prepararGasto } from "../src/lib/gastos";
import { abrirSesion, texto } from "./comprobar-003-paginas";

const MARCA = "0c080018";
const PREFIJO = "demo-c008r";
let fallos = 0;

function comprobar(hallazgo: string, descripcion: string, ok: boolean, detalle = "") {
  if (!ok) fallos++;
  console.log(`${ok ? "✓" : "✗"} ${hallazgo} · ${descripcion}${detalle ? ` (${detalle})` : ""}`);
}

async function main() {
  config({ path: ".env.local" });
  // Escribe filas: solo en la base local (spec 002, criterio 10).
  exigirBaseLocal(process.env.DATABASE_URL, "comprobar-008-revision");
  const posicionUrl = process.argv.indexOf("--url");
  const origen = posicionUrl >= 0 ? process.argv[posicionUrl + 1] : null;
  if (!origen) throw new Error("Esta comprobación mira las páginas: pásale --url <origen>");
  const { db, etiquetas, movimientos } = await import("../src/db/index");
  const { categoriasDeGastoPorUso, saldosPorCuenta, sobresParaGasto } = await import("../src/db/consultas");
  const { registrarCaptura } = await import("../src/db/movimientos");
  const { buscarOCrearEtiqueta } = await import("../src/db/etiquetas");

  const clave = nombreDeEtiqueta(PREFIJO);
  if (!clave.ok) throw new Error("Prefijo inválido");
  async function limpiar() {
    await db.delete(movimientos).where(like(movimientos.referenciaExterna, `captura-${MARCA}-%`));
    await db.delete(etiquetas).where(like(etiquetas.clave, `${clave.ok ? clave.clave : ""}%`));
  }
  await limpiar();
  const [{ reales }] = await db
    .select({ reales: count() })
    .from(movimientos)
    .where(or(isNull(movimientos.referenciaExterna), not(like(movimientos.referenciaExterna, "demo-%"))));
  if (reales > 0) throw new Error(`Hay ${reales} movimientos que no son de demostración. No se toca esta base.`);

  const hoy = hoyEnCaracas(new Date());
  const [catA, catB] = await categoriasDeGastoPorUso();
  const prima = (await saldosPorCuenta()).find((c) => c.nombre === "Cuenta prima");
  const gastos = (await sobresParaGasto()).find((s) => s.tipo === "gastos");
  if (!catB || !prima || !gastos) throw new Error("Faltan datos base: corre pnpm db:seed y pnpm db:demo");

  const sesion = await abrirSesion(origen);
  try {
    // Una etiqueta con un gasto de hoy en la primera categoría
    const rielco = await buscarOCrearEtiqueta(`${PREFIJO} Rielco`);
    const captura = `${MARCA}${randomUUID().slice(8)}`;
    const p = prepararGasto(
      {
        forma: "dolares",
        monto: "9",
        tasa: "",
        vendido: "",
        cuentaOrigen: { id: prima.id, moneda: prima.moneda },
        cuentaBolivares: null,
        sobreId: gastos.id,
        categoriaId: catA.id,
        fecha: hoy,
        nota: "comprobar-008-revision",
      },
      hoy,
    );
    if (!p.ok) throw new Error("prepararGasto rechazó el gasto");
    await registrarCaptura(
      captura,
      p.filas.map((f) => ({ ...f, referenciaExterna: referenciaDeCaptura(captura, "gasto") })),
      { id: rielco.id },
    );

    // 2 · la pestaña Mover no se lleva la etiqueta, y ahí no filtra
    const conEtiqueta = await sesion.crudo(`/movimientos?etiqueta=${rielco.id}`);
    const aMover = /<a[^>]*href="([^"]*tipo=mover[^"]*)"/.exec(conEtiqueta.html)?.[1]?.replace(/&amp;/g, "&") ?? "";
    comprobar(
      "2",
      "desde Gastos con etiqueta, el enlace a Mover no la lleva",
      aMover !== "" && !aMover.includes("etiqueta="),
      aMover,
    );
    const [moverSin, moverCon] = [
      texto((await sesion.pagina("/movimientos?tipo=mover")).html),
      texto((await sesion.pagina(`/movimientos?tipo=mover&etiqueta=${rielco.id}`)).html),
    ];
    const filas = (t: string) => (t.match(/Movido|Reasignación|→/g) ?? []).length;
    comprobar(
      "2",
      "en Mover, una etiqueta en la dirección no filtra la lista",
      !moverCon.includes("No hay movimientos") && filas(moverCon) === filas(moverSin),
      `${filas(moverSin)} y ${filas(moverCon)}`,
    );

    // 3 · la píldora activa sigue para quitarla, sin movimientos en el periodo o en la categoría
    const pildoraParaQuitar = (html: string) =>
      [...html.matchAll(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].some(
        (m) =>
          texto(m[2]).includes(`${PREFIJO} Rielco`) && !m[1].replace(/&amp;/g, "&").includes(`etiqueta=${rielco.id}`),
      );
    const anioPasado = `${Number(hoy.slice(0, 4)) - 1}-01-15`;
    const sinMovimientos = await sesion.pagina(`/movimientos?fecha=${anioPasado}&periodo=dia&etiqueta=${rielco.id}`);
    const otraCategoria = await sesion.pagina(`/movimientos?categoria=${catB.id}&etiqueta=${rielco.id}`);
    comprobar(
      "3",
      "en un día sin movimientos y en otra categoría, la etiqueta activa conserva su píldora, que la quita",
      pildoraParaQuitar(sinMovimientos.html) && pildoraParaQuitar(otraCategoria.html),
    );

    // 4 · el campo de fecha sin JavaScript conserva la etiqueta
    const formFecha =
      [...conEtiqueta.html.matchAll(/<form[^>]*action="\/movimientos"[^>]*>[\s\S]*?<\/form>/g)]
        .map((m) => m[0])
        .find((f) => f.includes('name="fecha"')) ?? "";
    comprobar(
      "4",
      "el formulario de fecha sin JavaScript lleva la etiqueta",
      formFecha.includes(`name="etiqueta" value="${rielco.id}"`) ||
        formFecha.includes(`value="${rielco.id}" name="etiqueta"`),
    );
  } finally {
    await sesion.salir();
    await limpiar();
  }

  const [{ quedan }] = await db
    .select({ quedan: count() })
    .from(etiquetas)
    .where(like(etiquetas.clave, `${clave.ok ? clave.clave : ""}%`));
  comprobar("1", "al terminar, ni sus movimientos ni sus etiquetas quedan", quedan === 0);
  console.log(
    fallos === 0 ? "\n✓ comprobar-008-revision: todo en verde" : `\n✗ comprobar-008-revision: ${fallos} fallos`,
  );
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
