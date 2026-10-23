/**
 * Los criterios de la spec 010 contra la base, escritos desde su texto:
 *   ★ 1 · corregir un pendiente cambia categoría, descripción, fecha, monto y moneda, con las reglas de anotar, en su
 *         misma fila (ni su referencia ni su fecha de creación) y sin mover dinero; también quitarle el monto;
 *   ★ 2 · si ya no existe, no se guarda nada;
 *   3   · su categoría archivada se puede dejar.
 * Con --url, además, contra un servidor en marcha con esta misma base y el usuario de prueba, como un navegador sin
 * JavaScript:
 *   ★ 1 · la lista enlaza cada uno a su edición; la edición viene llena y "Guardar cambios" vuelve con "Cambios
 *         guardados"; una fecha de mañana se rechaza junto al campo;
 *   ★ 2 · guardar uno que se descartó después de abrirlo vuelve con "Ese gasto ya se completó o se descartó", y un id
 *         que no existe responde 404;
 *   3   · la categoría archivada sale marcada y se guarda;
 *   4   · "Por completar" está en el menú y "Ver por completar" en la captura de gasto; "Mover" del inicio va a
 *         /nuevo/mover;
 *   6   · el "+" flotante no sale en la edición.
 * La sesión y conFallas del ★ 5 los miran src/app/sesion.criterios.test.ts y src/app/fallas.criterios.test.ts.
 *   pnpm exec tsx scripts/comprobar-010.ts [--url http://localhost:3000]
 * Lo suyo son pendientes cuya referencia empieza por "captura-0c100010" y categorías que empiezan por "demo-c010", que
 * se borran al terminar y, si una corrida se cortó, al empezar la siguiente. Se niega ante datos que no sean de demo.
 */
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { count, eq, isNull, like, not, or } from "drizzle-orm";
import { referenciaDeCaptura } from "../src/lib/captura";
import { exigirBaseLocal } from "../src/lib/destino-base";
import { centavosATexto } from "../src/lib/dinero";
import { fechaDesdeAtajo, hoyEnCaracas } from "../src/lib/fechas";
import { validarPorCompletar } from "../src/lib/por-completar";
import { abrirSesion, texto } from "./comprobar-003-paginas";

const MARCA = "0c100010";
const PREFIJO = "demo-c010";
let fallos = 0;

function comprobar(criterio: string, descripcion: string, ok: boolean, detalle = "") {
  if (!ok) fallos++;
  console.log(`${ok ? "✓" : "✗"} ${criterio} · ${descripcion}${detalle ? ` (${detalle})` : ""}`);
}

const idDePrueba = () => `${MARCA}${randomUUID().slice(8)}`;

async function main() {
  config({ path: ".env.local" });
  // Escribe filas: solo en la base local (spec 002, criterio 10).
  exigirBaseLocal(process.env.DATABASE_URL, "comprobar-010");
  const posicionUrl = process.argv.indexOf("--url");
  const origen = posicionUrl >= 0 ? process.argv[posicionUrl + 1] : null;
  const { db, categorias, gastosPorCompletar, movimientos } = await import("../src/db/index");
  const { categoriasDeGastoPorUso, saldosPorCuenta, saldosPorSobre } = await import("../src/db/consultas");
  const { anotarPorCompletar, descartarPorCompletar, editarPorCompletar, porCompletarPorId } =
    await import("../src/db/por-completar");
  const { crearCategoria, eliminarCategoria } = await import("../src/db/categorias");

  async function limpiar() {
    await db.delete(gastosPorCompletar).where(like(gastosPorCompletar.referencia, `captura-${MARCA}-%`));
    await db.delete(categorias).where(like(categorias.nombre, `${PREFIJO}%`));
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
    const huella = JSON.stringify([c.map((x) => [x.id, x.saldoCentavos]), s.map((x) => [x.id, x.saldoCentavos])]);
    return { filas, pendientes, huella };
  }
  const inicial = await estado();
  const hoy = hoyEnCaracas(new Date());
  const ayer = fechaDesdeAtajo("ayer", hoy);
  const manana = new Date(Date.parse(`${hoy}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  const activas = await categoriasDeGastoPorUso();
  const [catA, catB] = activas;
  if (!catB) throw new Error("Faltan categorías: corre pnpm db:seed");
  console.log(`Base local · hoy en Caracas ${hoy} · ${inicial.filas} movimientos · ${inicial.pendientes} pendientes`);

  /** Un pendiente anotado como en /nuevo/por-completar. */
  async function anotar(e: {
    nota: string;
    monto?: string;
    moneda?: "VES" | "USD";
    fecha?: string;
    categoriaId?: number;
  }) {
    const captura = idDePrueba();
    const v = validarPorCompletar(
      {
        categoriaId: e.categoriaId ?? catA.id,
        nota: e.nota,
        fecha: e.fecha ?? hoy,
        monto: e.monto ?? "",
        moneda: e.moneda ?? "",
      },
      [...activas.map((c) => c.id), e.categoriaId ?? catA.id],
      hoy,
    );
    if (!v.ok) throw new Error(`validarPorCompletar rechazó: ${JSON.stringify(v.errores)}`);
    await anotarPorCompletar({ ...v.fila, referencia: referenciaDeCaptura(captura, "pendiente") });
    const [fila] = await db
      .select()
      .from(gastosPorCompletar)
      .where(eq(gastosPorCompletar.referencia, referenciaDeCaptura(captura, "pendiente")));
    if (!fila) throw new Error("El pendiente no se anotó");
    return fila;
  }
  const validar = (e: { nota: string; monto: string; moneda: string; fecha: string; categoriaId: number }) => {
    const v = validarPorCompletar(
      e,
      activas.map((c) => c.id),
      hoy,
    );
    if (!v.ok) throw new Error(`validarPorCompletar rechazó: ${JSON.stringify(v.errores)}`);
    return v.fila;
  };

  try {
    // ★ 1 · corregir en su misma fila, sin mover dinero
    const pan = await anotar({ nota: "comprobar-010 pan", monto: "3650", moneda: "VES" });
    const antes = await estado();
    const cambiado = await editarPorCompletar(
      pan.id,
      validar({ nota: "comprobar-010 panadería", monto: "12,5", moneda: "USD", fecha: ayer, categoriaId: catB.id }),
    );
    const despues = await porCompletarPorId(pan.id);
    comprobar(
      "1",
      "corregir cambia categoría, descripción, fecha, monto y moneda en su misma fila",
      cambiado &&
        despues?.categoriaId === catB.id &&
        despues.nota === "comprobar-010 panadería" &&
        despues.fecha === ayer &&
        despues.montoCentavos === 1250 &&
        despues.moneda === "USD",
    );
    comprobar(
      "1",
      "su referencia y su fecha de creación no cambian, y no mueve dinero",
      despues?.referencia === pan.referencia &&
        despues.creadoEn.getTime() === pan.creadoEn.getTime() &&
        (await estado()).huella === antes.huella &&
        (await estado()).filas === antes.filas,
    );
    const sinMonto = await editarPorCompletar(
      pan.id,
      validar({ nota: "comprobar-010 panadería", monto: "", moneda: "USD", fecha: ayer, categoriaId: catB.id }),
    );
    const sinMontoFila = await porCompletarPorId(pan.id);
    comprobar(
      "1",
      "quitarle el monto deja monto y moneda vacíos",
      sinMonto && sinMontoFila?.montoCentavos === null && sinMontoFila.moneda === null,
    );

    // ★ 2 · si ya no existe, no se guarda nada
    const ido = await anotar({ nota: "comprobar-010 descartado" });
    await descartarPorCompletar(ido.id);
    const tarde = await editarPorCompletar(
      ido.id,
      validar({ nota: "x", monto: "", moneda: "", fecha: hoy, categoriaId: catA.id }),
    );
    let raros = 0;
    for (const id of [0, -2, 1.5, 2 ** 31]) {
      if (await editarPorCompletar(id, validar({ nota: "x", monto: "", moneda: "", fecha: hoy, categoriaId: catA.id })))
        raros++;
    }
    comprobar(
      "2",
      "corregir uno descartado, o un id imposible, no guarda ni crea nada",
      !tarde && raros === 0 && (await porCompletarPorId(ido.id)) === null,
    );

    if (origen) {
      console.log(`— páginas, contra ${origen}`);
      const sesion = await abrirSesion(origen);
      try {
        const formularioDe = (html: string) =>
          [...html.matchAll(/<form[\s\S]*?<\/form>/g)].map((m) => m[0]).find((f) => f.includes('name="nota"')) ?? "";
        const entrada = (form: string, nombre: string, valor: string) =>
          [...form.matchAll(/<input[^>]*>/g)]
            .map((m) => m[0])
            .find((i) => i.includes(`name="${nombre}"`) && i.includes(`value="${valor}"`));
        const marcada = (form: string, nombre: string, valor: string) =>
          entrada(form, nombre, valor)?.includes("checked") ?? false;
        /** Envía la corrección como un navegador sin JavaScript, con los ocultos del formulario que se abrió. */
        function enviar(id: number, form: string, campos: Record<string, string>) {
          const datos = new FormData();
          for (const m of form.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
            const nombre = /name="([^"]*)"/.exec(m[0])?.[1];
            if (nombre && nombre !== "fecha") datos.set(nombre, texto(/value="([^"]*)"/.exec(m[0])?.[1] ?? ""));
          }
          for (const [k, v] of Object.entries(campos)) datos.set(k, v);
          return sesion.enviar(`/por-completar/${id}`, datos);
        }

        // ★ 1 · la lista enlaza a la edición, que viene llena
        const taxi = await anotar({ nota: "comprobar-010 taxi", monto: "12", moneda: "USD", fecha: ayer });
        const lista = (await sesion.pagina("/por-completar")).html;
        const enlace = new RegExp(`<a[^>]*href="/por-completar/${taxi.id}"[\\s\\S]*?</a>`).exec(lista)?.[0] ?? "";
        comprobar(
          "1",
          "en la lista, el pendiente lleva a su edición",
          texto(enlace).includes("comprobar-010 taxi") && texto(enlace).includes(", editar"),
        );
        const pagina = await sesion.pagina(`/por-completar/${taxi.id}`);
        const form = formularioDe(pagina.html);
        comprobar(
          "1",
          "la edición viene llena: categoría, descripción, fecha, monto y moneda",
          pagina.estado === 200 &&
            texto(pagina.html).includes("Editar por completar") &&
            Boolean(entrada(form, "id", String(taxi.id))) &&
            Boolean(entrada(form, "nota", "comprobar-010 taxi")) &&
            Boolean(entrada(form, "monto", centavosATexto(1200))) &&
            Boolean(entrada(form, "fecha", ayer)) &&
            marcada(form, "categoriaId", String(catA.id)) &&
            marcada(form, "moneda", "USD"),
        );
        comprobar(
          "6",
          'el "+" flotante no sale en la edición',
          !pagina.html.includes('aria-label="Registrar movimiento"'),
        );
        const campos = { categoriaId: String(catA.id), nota: "comprobar-010 taxi", monto: "12", moneda: "USD" };
        const malo = await enviar(taxi.id, form, { ...campos, fecha: manana });
        comprobar(
          "1",
          "una fecha de mañana se rechaza junto al campo y no cambia nada",
          malo.estado === 200 &&
            texto(malo.html).includes("Elige hoy o un día anterior") &&
            (await porCompletarPorId(taxi.id))?.fecha === ayer,
          `${malo.estado}`,
        );
        const bueno = await enviar(taxi.id, form, { ...campos, fecha: hoy });
        const vuelta = await sesion.pagina(bueno.ubicacion ?? "/por-completar");
        comprobar(
          "1",
          'guardar la fecha corregida vuelve a la lista con "Cambios guardados"',
          bueno.estado === 303 &&
            bueno.ubicacion === "/por-completar?editado=1" &&
            (await porCompletarPorId(taxi.id))?.fecha === hoy &&
            texto(vuelta.html).includes("Cambios guardados"),
          `${bueno.estado} ${bueno.ubicacion}`,
        );

        // ★ 2 · descartado después de abrirlo, y un id que no existe
        const vela = await anotar({ nota: "comprobar-010 vela" });
        const formVela = formularioDe((await sesion.pagina(`/por-completar/${vela.id}`)).html);
        await descartarPorCompletar(vela.id);
        const rVela = await enviar(vela.id, formVela, {
          categoriaId: String(catA.id),
          nota: "otra",
          monto: "",
          moneda: "VES",
          fecha: hoy,
        });
        const avisoVela = await sesion.pagina(rVela.ubicacion ?? "/por-completar");
        comprobar(
          "2",
          'guardar uno descartado después de abrirlo vuelve con "Ese gasto ya se completó o se descartó"',
          rVela.estado === 303 &&
            rVela.ubicacion === "/por-completar?yano=1" &&
            texto(avisoVela.html).includes("Ese gasto ya se completó o se descartó") &&
            (await porCompletarPorId(vela.id)) === null,
          `${rVela.estado} ${rVela.ubicacion}`,
        );
        const noHay = await sesion.crudo("/por-completar/999999");
        comprobar(
          "2",
          "un id que no existe responde 404",
          noHay.estado === 404 && noHay.html.includes("No está"),
          `${noHay.estado}`,
        );

        // 3 · su categoría archivada
        const archivadaId = await crearCategoria({
          nombre: `${PREFIJO} archivada`,
          tipo: "gasto",
          icono: catA.icono,
          color: catA.color,
        });
        const conArchivada = await anotar({ nota: "comprobar-010 archivada", categoriaId: archivadaId });
        const archivo = await eliminarCategoria(archivadaId);
        const formArchivada = formularioDe((await sesion.pagina(`/por-completar/${conArchivada.id}`)).html);
        const rArchivada = await enviar(conArchivada.id, formArchivada, {
          categoriaId: String(archivadaId),
          nota: "comprobar-010 corregida",
          monto: "",
          moneda: "VES",
          fecha: hoy,
        });
        const corregida = await porCompletarPorId(conArchivada.id);
        comprobar(
          "3",
          "la categoría archivada sale marcada y se puede dejar al corregir",
          archivo === "archivada" &&
            marcada(formArchivada, "categoriaId", String(archivadaId)) &&
            rArchivada.estado === 303 &&
            corregida?.categoriaId === archivadaId &&
            corregida.nota === "comprobar-010 corregida",
        );

        // 4 · se llega siempre a la lista, y "Mover" del inicio va directo
        const [inicio, captura] = [(await sesion.pagina("/")).html, (await sesion.pagina("/nuevo/gasto")).html];
        const menu = /<nav aria-label="Principal"[\s\S]*?<\/nav>/.exec(inicio)?.[0] ?? "";
        comprobar(
          "4",
          '"Por completar" en el menú, "Ver por completar" en la captura, y "Mover" del inicio a /nuevo/mover',
          /href="\/por-completar"[^>]*>[\s\S]*?Por completar/.test(menu) &&
            /href="\/por-completar"[^>]*>Ver por completar/.test(captura) &&
            inicio.includes('href="/nuevo/mover"') &&
            !inicio.includes('href="/nuevo?tipo=mover"'),
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
  console.log(fallos === 0 ? "\n✓ comprobar-010: todo en verde" : `\n✗ comprobar-010: ${fallos} fallos`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
