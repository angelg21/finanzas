/**
 * Importa el historial de Gestor de Gastos (spec 012) desde su .xlsx. Primero muestra todo lo que va a hacer y solo
 * escribe al confirmarlo. Es historial: no mueve ningún saldo, y los saldos de cuentas y sobres se comparan antes y
 * después en la misma transacción; si alguno cambia, no queda nada. Correrlo otra vez no duplica: cada fila tiene su
 * referencia y la base no la acepta dos veces.
 *   pnpm db:importar <archivo.xlsx>              → la base local: muestra y pregunta (sin terminal, solo muestra)
 *   pnpm db:importar <archivo.xlsx> --aplicar    → la base local, sin preguntar
 *   pnpm db:importar:produccion <archivo.xlsx>   → producción: la cadena y las confirmaciones en la terminal
 */
import { and, eq, inArray, not, or, sql } from "drizzle-orm";
import { claveDeNombre } from "../lib/categorias";
import { formatearCentavos, type Moneda } from "../lib/dinero";
import { nombreDeEtiqueta } from "../lib/etiquetas";
import { hoyEnCaracas } from "../lib/fechas";
import { type ContextoDeImportacion, type PlanDeImportacion, planDeImportacion } from "../lib/importacion";
import { leerExportacion } from "../lib/leer-exportacion";
import { mapeoGestorDeGastos } from "../lib/mapeo-gestor-de-gastos";
import { conectar, preguntar, terminarConError, urlLocal, urlProduccion } from "./conexion-script";
import { leerXlsx } from "./leer-xlsx";
import { type NuevoMovimiento, categorias, cuentas, etiquetas, movimientos, sobres } from "./schema";
import { efectoEnCuenta, efectoEnSobre, esHistorial } from "./sumas-de-saldo";

type Base = ReturnType<typeof conectar>["db"];
type Ejecutor = Base | Parameters<Parameters<Base["transaction"]>[0]>[0];

async function contextoDe(db: Base): Promise<ContextoDeImportacion> {
  const anotados = await db
    .select({
      fecha: movimientos.fecha,
      tipo: movimientos.tipo,
      centavosUsd: movimientos.montoUsdCentavos,
      nota: movimientos.nota,
    })
    .from(movimientos)
    .where(and(inArray(movimientos.tipo, ["gasto", "ingreso"]), not(esHistorial)));
  return {
    cuentas: await db.select({ nombre: cuentas.nombre, moneda: cuentas.moneda }).from(cuentas),
    categorias: await db.select({ nombre: categorias.nombre, tipo: categorias.tipo }).from(categorias),
    etiquetas: await db.select({ nombre: etiquetas.nombre }).from(etiquetas),
    yaAnotados: anotados.map((a) => ({ ...a, tipo: a.tipo === "gasto" ? "gasto" : "ingreso" })),
  };
}

/** Cada saldo de cuenta (en su moneda) y de sobre, con las mismas sumas que la app. */
async function saldos(tx: Ejecutor): Promise<Map<string, number>> {
  const deSobres = await tx
    .select({
      id: sobres.id,
      saldo: sql<number>`coalesce(sum(${efectoEnSobre(sobres.id)}), 0)::bigint`.mapWith(Number),
    })
    .from(sobres)
    .leftJoin(movimientos, or(eq(movimientos.sobreOrigenId, sobres.id), eq(movimientos.sobreDestinoId, sobres.id)))
    .groupBy(sobres.id);
  const deCuentas = await tx
    .select({
      id: cuentas.id,
      saldo: sql<number>`coalesce(sum(${efectoEnCuenta(cuentas.id)}), 0)::bigint`.mapWith(Number),
    })
    .from(cuentas)
    .leftJoin(movimientos, or(eq(movimientos.cuentaOrigenId, cuentas.id), eq(movimientos.cuentaDestinoId, cuentas.id)))
    .groupBy(cuentas.id);
  return new Map([
    ...deSobres.map((s) => [`sobre ${s.id}`, s.saldo] as const),
    ...deCuentas.map((c) => [`cuenta ${c.id}`, c.saldo] as const),
  ]);
}

/** Crea lo que falta, inserta lo que no estaba y comprueba que ningún saldo cambió; si cambió, no queda nada. */
async function aplicar(db: Base, plan: PlanDeImportacion) {
  return db.transaction(async (tx) => {
    const antes = await saldos(tx);
    for (const c of plan.crear.cuentas) {
      const [{ orden }] = await tx.select({ orden: sql<number>`coalesce(max(${cuentas.orden}), 0) + 1` }).from(cuentas);
      await tx
        .insert(cuentas)
        .values({ ...c, orden })
        .onConflictDoNothing();
    }
    for (const c of plan.crear.categorias) {
      const [{ orden }] = await tx
        .select({ orden: sql<number>`coalesce(max(${categorias.orden}), 0) + 1` })
        .from(categorias)
        .where(eq(categorias.tipo, c.tipo));
      await tx
        .insert(categorias)
        .values({ ...c, orden })
        .onConflictDoNothing();
    }
    for (const nombre of plan.crear.etiquetas) {
      const leida = nombreDeEtiqueta(nombre);
      if (leida.ok)
        await tx.insert(etiquetas).values({ nombre: leida.nombre, clave: leida.clave }).onConflictDoNothing();
    }

    const idCuenta = new Map((await tx.select().from(cuentas)).map((c) => [claveDeNombre(c.nombre), c.id]));
    const idCategoria = new Map(
      (await tx.select().from(categorias)).map((c) => [`${c.tipo}|${claveDeNombre(c.nombre)}`, c.id]),
    );
    const idEtiqueta = new Map((await tx.select().from(etiquetas)).map((e) => [e.clave, e.id]));
    const sobreDe = async (tipo: "por_asignar" | "gastos") =>
      (await tx.select({ id: sobres.id }).from(sobres).where(eq(sobres.tipo, tipo)).orderBy(sobres.orden, sobres.id))[0]
        ?.id;
    const porAsignar = await sobreDe("por_asignar");
    const gastosDelMes = await sobreDe("gastos");
    if (!porAsignar || !gastosDelMes)
      throw new Error("Faltan los sobres Por asignar o Gastos del mes: corre pnpm db:seed.");
    const id = (mapa: Map<string, number>, clave: string) => {
      const encontrado = mapa.get(clave);
      if (encontrado === undefined) throw new Error(`No se encontró «${clave}» después de crearlo.`);
      return encontrado;
    };

    const filas: NuevoMovimiento[] = plan.movimientos.map((m) => {
      const cuenta = id(idCuenta, claveDeNombre(m.cuenta));
      return {
        fecha: m.fecha,
        tipo: m.tipo,
        montoCentavos: m.montoCentavos,
        moneda: m.moneda as Moneda,
        montoUsdCentavos: m.montoUsdCentavos,
        montoDestinoCentavos: m.montoDestinoCentavos,
        monedaDestino: m.monedaDestino as Moneda | null,
        cuentaOrigenId: m.tipo === "ingreso" ? null : cuenta,
        cuentaDestinoId: m.tipo === "ingreso" ? cuenta : m.destino ? id(idCuenta, claveDeNombre(m.destino)) : null,
        sobreOrigenId: m.tipo === "gasto" ? gastosDelMes : null,
        sobreDestinoId: m.tipo === "ingreso" ? porAsignar : null,
        categoriaId: m.categoria ? id(idCategoria, `${m.tipo}|${claveDeNombre(m.categoria)}`) : null,
        etiquetaId: m.etiqueta ? id(idEtiqueta, claveDeNombre(m.etiqueta)) : null,
        nota: m.nota,
        origen: "importado",
        referenciaExterna: m.referencia,
      };
    });
    const insertadas = filas.length
      ? await tx.insert(movimientos).values(filas).onConflictDoNothing().returning({ id: movimientos.id })
      : [];

    const despues = await saldos(tx);
    const cambiados = [...despues].filter(([clave, saldo]) => (antes.get(clave) ?? 0) !== saldo);
    if (cambiados.length > 0) {
      throw new Error(
        `Cambiarían ${cambiados.length} saldos (${cambiados.map(([c]) => c).join(", ")}): no se importó nada.`,
      );
    }
    return { insertadas: insertadas.length, saldosComparados: despues.size };
  });
}

const usd = (centavos: number) => formatearCentavos(centavos, "USD");

function mostrar(archivo: string, plan: PlanDeImportacion, yaImportadas: Set<string>) {
  console.log(`\nHistorial de Gestor de Gastos · ${archivo}`);
  for (const tipo of ["gasto", "ingreso", "transferencia"] as const) {
    const de = plan.movimientos.filter((m) => m.tipo === tipo);
    if (de.length === 0) continue;
    const fechas = de.map((m) => m.fecha).sort();
    const nuevas = de.filter((m) => !yaImportadas.has(m.referencia)).length;
    const total = de.reduce((a, m) => a + m.montoUsdCentavos, 0);
    console.log(`  ${tipo}s: ${de.length} (${usd(total)}), del ${fechas[0]} al ${fechas.at(-1)} · nuevos: ${nuevas}`);
  }
  for (const tipo of ["cuenta", "gasto", "ingreso"] as const) {
    const porNueva = new Map<string, { viejas: string[]; existe: boolean }>();
    for (const e of plan.equivalencias.filter((x) => x.tipo === tipo)) {
      const grupo = porNueva.get(e.nueva) ?? { viejas: [], existe: e.existe };
      grupo.viejas.push(e.vieja);
      porNueva.set(e.nueva, grupo);
    }
    console.log(`\n  ${tipo === "cuenta" ? "Cuentas" : `Categorías de ${tipo}`}:`);
    for (const [nueva, g] of porNueva) {
      console.log(`    ${nueva}${g.existe ? "" : " (SE CREA)"} ← ${g.viejas.join(", ")}`);
    }
  }
  if (plan.crear.etiquetas.length) console.log(`\n  Etiquetas que se crean: ${plan.crear.etiquetas.join(", ")}`);
  if (plan.omitidas.length) {
    console.log("\n  Se saltan:");
    for (const o of plan.omitidas) {
      console.log(
        `    ${o.hoja}, fila ${o.fila} · ${o.fecha} · ${usd(o.centavosUsd)} · «${o.nota ?? ""}» → ${o.motivo}`,
      );
    }
  }
  if (plan.errores.length) {
    console.log("\n  ERRORES (no se importa nada):");
    for (const e of plan.errores) console.log(`    ${e}`);
  }
  console.log(
    "\n  Es historial: sale en Movimientos y en las gráficas, y no cambia ningún saldo de cuentas ni sobres.\n",
  );
}

async function main() {
  const archivo = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (!archivo) throw new Error("Falta el archivo: pnpm db:importar data/respaldos/<archivo>.xlsx");
  const produccion = process.argv.includes("--produccion");
  const leidas = leerExportacion(leerXlsx(archivo), hoyEnCaracas(new Date()));
  if (leidas.errores.length) throw new Error(`El archivo no se puede leer sin adivinar:\n${leidas.errores.join("\n")}`);

  const url = produccion
    ? await urlProduccion("importar el historial de Gestor de Gastos")
    : urlLocal("pnpm db:importar");
  const { db, conexion } = conectar(url);
  try {
    const plan = planDeImportacion(leidas.filas, await contextoDe(db), mapeoGestorDeGastos);
    const referencias = await db
      .select({ referencia: movimientos.referenciaExterna })
      .from(movimientos)
      .where(esHistorial);
    const yaImportadas = new Set(referencias.map((r) => r.referencia ?? ""));
    mostrar(archivo, plan, yaImportadas);
    if (plan.errores.length) throw new Error("Hay errores: no se importó nada.");

    const sinPreguntar = process.argv.includes("--aplicar") && !produccion;
    if (!sinPreguntar && !process.stdin.isTTY) return console.log("Sin terminal solo se muestra: no se importó nada.");
    if (!sinPreguntar && (await preguntar('Escribe "importar" para aplicarlo: ')).trim() !== "importar") {
      return console.log("Cancelado: no se importó nada.");
    }
    const { insertadas, saldosComparados } = await aplicar(db, plan);
    console.log(
      `Importados ${insertadas} movimientos. Los ${saldosComparados} saldos de cuentas y sobres quedaron iguales.`,
    );
  } finally {
    await conexion.end();
  }
}

main().catch(terminarConError);
