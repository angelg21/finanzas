/**
 * Lo que encontró la primera revisión de la spec 006 (2026-10-22), comprobado contra la base y, con --url, contra un
 * servidor en marcha con esta misma base, como un navegador sin JavaScript y con el usuario de prueba:
 *   1 · una edición que no se guarda (rechazada, de algo ya borrado, de un gasto sin captura que pasa a vendiendo) no
 *       deja creada la etiqueta nueva que traía; una que se guarda la crea y la pone en el gasto, no en su venta.
 *       Con --url, por la acción de verdad: bajar un ingreso más de lo que tiene Por asignar con una etiqueta nueva;
 *   2 · sin JavaScript, "Borrar" lleva a la confirmación sin perder a dónde volver, la confirmación trae "Cancelar",
 *       y al borrar se vuelve al inicio si de ahí se vino;
 *   3 · un gasto con su categoría archivada se corrige sin recategorizarlo: la suya sale marcada y se guarda;
 *   4 · el "+" flotante no sale en la edición de un movimiento;
 *   5 · un movimiento que ya no está responde 404 en español, con la navegación;
 *   6 · la fila de un pago dice "deshacer" al lector de pantalla, no "editar".
 *   pnpm exec tsx scripts/comprobar-006-revision.ts [--url http://localhost:3000]
 * Corre sobre la base local con los datos de demostración y la deja como estaba: lo suyo son capturas cuyo id empieza
 * por 0c060016, la fila "demo-c006r-sin-captura", y etiquetas y categorías que empiezan por "demo-c006r", que se
 * borran al terminar y, si una corrida se cortó, al empezar la siguiente. Se niega ante datos que no sean de demostración.
 */
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { count, eq, isNull, like, not, or } from "drizzle-orm";
import { referenciaDeCaptura } from "../src/lib/captura";
import { exigirBaseLocal } from "../src/lib/destino-base";
import { centavosATexto } from "../src/lib/dinero";
import { planDeEdicionDeGasto } from "../src/lib/editar-gasto";
import { planDeEdicionDeIngreso } from "../src/lib/editar-ingreso";
import { type EtiquetaPedida, nombreDeEtiqueta } from "../src/lib/etiquetas";
import { hoyEnCaracas } from "../src/lib/fechas";
import { type EntradaGasto, prepararGasto } from "../src/lib/gastos";
import { prepararIngreso } from "../src/lib/ingresos";
import { abrirSesion, texto } from "./comprobar-003-paginas";

const MARCA = "0c060016";
const PREFIJO = "demo-c006r";
const SIN_CAPTURA = `${PREFIJO}-sin-captura`;
let fallos = 0;

function comprobar(hallazgo: string, descripcion: string, ok: boolean, detalle = "") {
  if (!ok) fallos++;
  console.log(`${ok ? "✓" : "✗"} ${hallazgo} · ${descripcion}${detalle ? ` (${detalle})` : ""}`);
}

const idDePrueba = () => `${MARCA}${randomUUID().slice(8)}`;
const guardo = (r: object) => "ok" in r && r.ok === true;

function clave(nombre: string) {
  const n = nombreDeEtiqueta(nombre);
  if (!n.ok) throw new Error(`Nombre inválido: ${nombre}`);
  return n.clave;
}

async function main() {
  config({ path: ".env.local" });
  // Escribe filas: solo en la base local (spec 002, criterio 10).
  exigirBaseLocal(process.env.DATABASE_URL, "comprobar-006-revision");
  const posicionUrl = process.argv.indexOf("--url");
  const origen = posicionUrl >= 0 ? process.argv[posicionUrl + 1] : null;
  const { db, categorias, etiquetas, movimientos } = await import("../src/db/index");
  const { categoriasDeGastoPorUso, saldosPorCuenta, saldosPorSobre } = await import("../src/db/consultas");
  const { categoriasDeIngresoPorUso } = await import("../src/db/reparto");
  const { registrarCaptura, registrarMovimientos, repartirPorAsignar } = await import("../src/db/movimientos");
  const { borrarGasto, editarGasto, editarIngreso } = await import("../src/db/editar-movimientos");
  const { crearCategoria, eliminarCategoria } = await import("../src/db/categorias");

  async function limpiar() {
    await db
      .delete(movimientos)
      .where(
        or(like(movimientos.referenciaExterna, `captura-${MARCA}-%`), eq(movimientos.referenciaExterna, SIN_CAPTURA)),
      );
    await db.delete(etiquetas).where(like(etiquetas.clave, `${clave(PREFIJO)}%`));
    await db.delete(categorias).where(like(categorias.nombre, `${PREFIJO}%`));
  }
  await limpiar();
  const [{ reales }] = await db
    .select({ reales: count() })
    .from(movimientos)
    .where(or(isNull(movimientos.referenciaExterna), not(like(movimientos.referenciaExterna, "demo-%"))));
  if (reales > 0) throw new Error(`Hay ${reales} movimientos que no son de demostración. No se toca esta base.`);

  async function estado() {
    const [c, s, [{ filas }], [{ cuantas }]] = await Promise.all([
      saldosPorCuenta(),
      saldosPorSobre(),
      db.select({ filas: count() }).from(movimientos),
      db.select({ cuantas: count() }).from(etiquetas),
    ]);
    const huella = JSON.stringify([c.map((x) => [x.id, x.saldoCentavos]), s.map((x) => [x.id, x.saldoCentavos])]);
    return { cuentas: c, sobres: s, filas, cuantas, huella };
  }
  const inicial = await estado();
  const hoy = hoyEnCaracas(new Date());
  const binance = inicial.cuentas.find((c) => c.nombre === "Binance");
  const prima = inicial.cuentas.find((c) => c.nombre === "Cuenta prima");
  const bolivares = inicial.cuentas.find((c) => c.moneda === "VES");
  const porAsignar = inicial.sobres.find((s) => s.tipo === "por_asignar");
  const gastosDelMes = inicial.sobres.find((s) => s.tipo === "gastos");
  const planes = inicial.sobres.find((s) => s.nombre === "Planes");
  const [catA] = await categoriasDeGastoPorUso();
  const [sueldo] = await categoriasDeIngresoPorUso();
  if (!binance || !prima || !bolivares || !porAsignar || !gastosDelMes || !planes || !catA || !sueldo) {
    throw new Error("Faltan datos base: corre pnpm db:seed y pnpm db:demo");
  }
  const validos = inicial.sobres.filter((s) => s.tipo !== "por_asignar").map((s) => s.id);
  console.log(`Base local · hoy en Caracas ${hoy} · ${inicial.filas} movimientos · ${inicial.cuantas} etiquetas`);

  const fila = async (id: number) => (await db.select().from(movimientos).where(eq(movimientos.id, id)))[0] ?? null;
  const etiquetaLlamada = async (nombre: string) =>
    (
      await db
        .select()
        .from(etiquetas)
        .where(eq(etiquetas.clave, clave(nombre)))
    )[0] ?? null;
  const deCaptura = (captura: string) =>
    db
      .select()
      .from(movimientos)
      .where(like(movimientos.referenciaExterna, `captura-${captura}-%`));
  function entradaGasto(cambios: Partial<EntradaGasto> = {}): EntradaGasto {
    return {
      forma: "dolares",
      monto: "10",
      tasa: "",
      vendido: "",
      cuentaOrigen: { id: prima!.id, moneda: prima!.moneda },
      cuentaBolivares: { id: bolivares!.id, moneda: "VES" },
      sobreId: gastosDelMes!.id,
      categoriaId: catA.id,
      fecha: hoy,
      nota: "comprobar-006-revision",
      ...cambios,
    };
  }
  async function gasto(cambios: Partial<EntradaGasto> = {}) {
    const captura = idDePrueba();
    const p = prepararGasto(entradaGasto(cambios), hoy);
    if (!p.ok) throw new Error(`prepararGasto rechazó: ${JSON.stringify(p.errores)}`);
    const tipo = (t: string) => (t === "transferencia" ? "transferencia" : "gasto");
    await registrarCaptura(
      captura,
      p.filas.map((f) => ({ ...f, referenciaExterna: referenciaDeCaptura(captura, tipo(f.tipo)) })),
    );
    const filas = await deCaptura(captura);
    return { captura, id: filas.find((f) => f.tipo === "gasto")?.id ?? 0 };
  }
  function filasDeIngreso(captura: string, centavos: number, aPlanes = 0) {
    const p = prepararIngreso(
      {
        monto: centavosATexto(centavos),
        fecha: hoy,
        nota: "comprobar-006-revision",
        categoriaId: sueldo.id,
        porAsignarId: porAsignar!.id,
        sobresValidos: validos,
        asignaciones: aPlanes ? [{ sobreId: planes!.id, monto: centavosATexto(aPlanes) }] : [],
      },
      hoy,
      { id: prima!.id, moneda: prima!.moneda },
    );
    if (!p.ok) throw new Error(`prepararIngreso rechazó: ${JSON.stringify(p.errores)}`);
    return p.filas.map((f) => ({
      ...f,
      referenciaExterna:
        f.tipo === "ingreso"
          ? referenciaDeCaptura(captura, "ingreso")
          : `captura-${captura}-reasignacion-${planes!.id}`,
    }));
  }
  async function ingreso(centavos: number) {
    const captura = idDePrueba();
    await registrarCaptura(captura, filasDeIngreso(captura, centavos));
    return (await deCaptura(captura))[0]?.id ?? 0;
  }
  /** Deja Por asignar con exactamente `centavos`: reparte lo que sobra a Planes o registra un ingreso por lo que falta. */
  async function porAsignarEn(centavos: number) {
    const ahora = (await saldosPorSobre()).find((s) => s.id === porAsignar!.id)?.saldoCentavos ?? 0;
    if (ahora > centavos) {
      const captura = idDePrueba();
      const reparto = filasDeIngreso(captura, ahora - centavos, ahora - centavos).filter(
        (f) => f.tipo === "reasignacion",
      );
      await repartirPorAsignar(captura, porAsignar!.id, reparto);
    } else if (ahora < centavos) await ingreso(centavos - ahora);
  }
  const editar = (id: number, cambios: Partial<EntradaGasto>, etiqueta: EtiquetaPedida) =>
    editarGasto(id, (g) => planDeEdicionDeGasto(g, entradaGasto(cambios), hoy), etiqueta);
  const editarIng = (id: number, monto: string, etiqueta: EtiquetaPedida) =>
    editarIngreso(
      id,
      (g, saldo) =>
        planDeEdicionDeIngreso(
          g,
          { monto, fecha: hoy, nota: "comprobar-006-revision", categoriaId: sueldo.id },
          { id: prima!.id, moneda: prima!.moneda },
          saldo,
          hoy,
        ),
      etiqueta,
    );

  try {
    // 1 · contra la base: ninguna edición que no se guarda deja la etiqueta nueva
    const i = await ingreso(10000);
    await porAsignarEn(2000);
    const rBaja = await editarIng(i, "50", { nueva: `${PREFIJO} huérfana` });
    comprobar(
      "1",
      "bajar un ingreso más de lo que tiene Por asignar, con una etiqueta nueva: no se guarda ni la etiqueta",
      !guardo(rBaja) && (await etiquetaLlamada(`${PREFIJO} huérfana`)) === null,
    );
    const [sinId] = await registrarMovimientos(
      (prepararGasto(entradaGasto(), hoy) as { ok: true; filas: Parameters<typeof registrarMovimientos>[0] }).filas.map(
        (f) => ({ ...f, referenciaExterna: SIN_CAPTURA }),
      ),
    );
    const vendiendo = { forma: "vendiendo" as const, cuentaOrigen: { id: binance.id, moneda: binance.moneda } };
    const rSin = await editar(
      sinId,
      { ...vendiendo, monto: "4000", tasa: "40", vendido: "100" },
      { nueva: `${PREFIJO} sin venta` },
    );
    comprobar(
      "1",
      "pasar a vendiendo un gasto sin captura, con una etiqueta nueva: no se guarda ni la etiqueta",
      !guardo(rSin) && (await etiquetaLlamada(`${PREFIJO} sin venta`)) === null,
    );
    const borrado = await gasto();
    await borrarGasto(borrado.id);
    const rBorrado = await editar(borrado.id, { monto: "3" }, { nueva: `${PREFIJO} borrado` });
    comprobar(
      "1",
      "editar un gasto ya borrado, con una etiqueta nueva: no existe, y la etiqueta tampoco",
      "noExiste" in rBorrado && (await etiquetaLlamada(`${PREFIJO} borrado`)) === null,
    );
    const conVenta = await gasto({ ...vendiendo, monto: "4000", tasa: "40", vendido: "100" });
    const rNueva = await editar(
      conVenta.id,
      { ...vendiendo, monto: "3600", tasa: "40", vendido: "100" },
      { nueva: `${PREFIJO} SAX` },
    );
    const sax = await etiquetaLlamada(`${PREFIJO} sax`);
    const filasVenta = await deCaptura(conVenta.captura);
    comprobar(
      "1",
      "una edición que se guarda crea la etiqueta nueva y la pone en el gasto, no en su venta",
      guardo(rNueva) &&
        sax !== null &&
        filasVenta.find((f) => f.tipo === "gasto")?.etiquetaId === sax.id &&
        filasVenta.find((f) => f.tipo === "transferencia")?.etiquetaId === null,
    );

    if (origen) {
      console.log(`— páginas, contra ${origen}`);
      const sesion = await abrirSesion(origen);
      try {
        const formularios = (html: string) => [...html.matchAll(/<form[\s\S]*?<\/form>/g)].map((m) => m[0]);
        const ocultos = (form: string) => {
          const datos = new FormData();
          for (const m of form.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
            const nombre = /name="([^"]*)"/.exec(m[0])?.[1];
            if (nombre && nombre !== "fecha") datos.set(nombre, texto(/value="([^"]*)"/.exec(m[0])?.[1] ?? ""));
          }
          return datos;
        };
        const llenar = (datos: FormData, campos: Record<string, string>) => {
          for (const [k, v] of Object.entries(campos)) datos.set(k, v);
          return datos;
        };

        // 1 · por la acción: el rechazo del ★ 5 con una etiqueta nueva
        const i2 = await ingreso(10000);
        await porAsignarEn(2000);
        const edicion =
          formularios((await sesion.pagina(`/movimientos/${i2}`)).html).find((f) => f.includes('name="monto"')) ?? "";
        const rIngreso = await sesion.enviar(
          `/movimientos/${i2}`,
          llenar(ocultos(edicion), {
            monto: "50",
            cuentaId: String(prima.id),
            categoriaId: String(sueldo.id),
            fecha: hoy,
            nota: "comprobar-006-revision",
            etiquetaId: "",
            etiquetaNueva: `${PREFIJO} página`,
          }),
        );
        comprobar(
          "1",
          "por la acción: el rechazo de Por asignar con una etiqueta nueva lo dice y no deja la etiqueta",
          rIngreso.estado === 200 &&
            texto(rIngreso.html).includes("Por asignar tiene 20,00") &&
            (await etiquetaLlamada(`${PREFIJO} página`)) === null &&
            (await fila(i2))?.montoCentavos === 10000,
          `${rIngreso.estado}`,
        );

        // 2 · borrar sin JavaScript desde el inicio
        const g = await gasto({ monto: "7" });
        const editarDesdeInicio = (await sesion.pagina(`/movimientos/${g.id}?volver=%2F`)).html;
        const enlace = /<a[^>]*href="([^"]*borrar=1[^"]*)"/.exec(editarDesdeInicio)?.[1]?.replace(/&amp;/g, "&");
        const confirmacion = (await sesion.pagina(`/movimientos/${g.id}${enlace ?? ""}`)).html;
        const formBorrar = formularios(confirmacion).find((f) => f.includes('name="tipo"')) ?? "";
        const cancelar = /<a[^>]*href="([^"]*)"[^>]*>Cancelar<\/a>/.exec(confirmacion)?.[1]?.replace(/&amp;/g, "&");
        comprobar(
          "2",
          "el enlace a borrar conserva a dónde volver, la confirmación lo lleva y trae Cancelar",
          enlace === "?volver=%2F&borrar=1" &&
            formBorrar.includes('name="volver" value="/"') &&
            cancelar === "?volver=%2F",
          `${enlace} · ${cancelar}`,
        );
        const rBorrar = await sesion.enviar(`/movimientos/${g.id}${enlace ?? ""}`, ocultos(formBorrar));
        comprobar(
          "2",
          "al borrar se vuelve al inicio, de donde se vino",
          rBorrar.estado === 303 && rBorrar.ubicacion === "/?borrado=1" && (await fila(g.id)) === null,
          `${rBorrar.estado} ${rBorrar.ubicacion}`,
        );

        // 5 · lo que ya no está: 404 en español
        const ya = await sesion.crudo(`/movimientos/${g.id}`);
        comprobar(
          "5",
          "un movimiento borrado responde 404 con «No está» en español (Next lo manda por el stream de React)",
          ya.estado === 404 &&
            ya.html.includes("No está") &&
            ya.html.includes("Lo que buscas no existe, o ya se borró."),
          `${ya.estado}`,
        );

        // 3 y 4 · un gasto con su categoría archivada se corrige sin recategorizar; sin "+" flotante
        const archivadaId = await crearCategoria({
          nombre: `${PREFIJO} archivada`,
          tipo: "gasto",
          icono: catA.icono,
          color: catA.color,
        });
        const conArchivada = await gasto({ monto: "10", categoriaId: archivadaId });
        const archivo = await eliminarCategoria(archivadaId);
        const pagina = (await sesion.pagina(`/movimientos/${conArchivada.id}`)).html;
        const formGasto = formularios(pagina).find((f) => f.includes('name="monto"')) ?? "";
        const marcada = [...formGasto.matchAll(/<input[^>]*name="categoriaId"[^>]*>/g)].some(
          (m) => m[0].includes(`value="${archivadaId}"`) && m[0].includes("checked"),
        );
        comprobar(
          "3",
          "la categoría archivada del gasto sale entre las opciones, marcada",
          archivo === "archivada" && marcada,
        );
        const rArchivada = await sesion.enviar(
          `/movimientos/${conArchivada.id}`,
          llenar(ocultos(formGasto), {
            forma: "dolares",
            monto: "10",
            cuentaId: String(prima.id),
            cuentaVentaId: "",
            vendido: "",
            tasa: "",
            categoriaId: String(archivadaId),
            sobreId: String(gastosDelMes.id),
            fecha: hoy,
            nota: "nota corregida",
            etiquetaId: "",
            etiquetaNueva: "",
          }),
        );
        const corregido = await fila(conArchivada.id);
        comprobar(
          "3",
          "cambiar solo la nota se guarda y deja su categoría",
          rArchivada.estado === 303 && corregido?.nota === "nota corregida" && corregido.categoriaId === archivadaId,
          `${rArchivada.estado} ${rArchivada.ubicacion}`,
        );
        const lista = (await sesion.pagina("/movimientos")).html;
        comprobar(
          "4",
          'el "+" flotante no sale en la edición, y sí en Movimientos',
          !pagina.includes('aria-label="Registrar movimiento"') && lista.includes('aria-label="Registrar movimiento"'),
        );

        // 6 · la fila de un pago dice "deshacer"
        const [pago] = await db
          .select({ id: movimientos.id, deudaId: movimientos.deudaId })
          .from(movimientos)
          .where(eq(movimientos.tipo, "pago_deuda"))
          .limit(1);
        const deuda = pago?.deudaId ? (await sesion.pagina(`/deudas/${pago.deudaId}`)).html : "";
        const filaPago =
          new RegExp(`<a[^>]*href="/movimientos/${pago?.id}\\?[^"]*"[\\s\\S]*?</a>`).exec(deuda)?.[0] ?? "";
        comprobar(
          "6",
          'la fila de un pago, en su deuda, dice "deshacer" y no "editar"',
          texto(filaPago).includes(", deshacer") && !texto(filaPago).includes(", editar"),
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
    "al terminar, la base queda como estaba, también las etiquetas",
    final.huella === inicial.huella && final.filas === inicial.filas && final.cuantas === inicial.cuantas,
  );
  console.log(
    fallos === 0 ? "\n✓ comprobar-006-revision: todo en verde" : `\n✗ comprobar-006-revision: ${fallos} fallos`,
  );
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
