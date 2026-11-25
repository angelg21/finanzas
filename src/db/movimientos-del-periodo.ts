import { and, count, desc, eq, gte, inArray, lte, not, sql } from "drizzle-orm";
import type { PestanaMovimientos, Rango } from "@/lib/periodos";
import { baseMovimientos } from "./consultas";
import { db } from "./index";
import { categorias, etiquetas, movimientos } from "./schema";
import { cuentaComoGasto } from "./sumas-de-saldo";

/*
  Lecturas de /movimientos (spec 003): tres consultas por página, todas sobre `movimientos_fecha_idx`, y con filtro
  una cuarta por la clave de la categoría. Los rangos y
  la categoría llegan ya validados por `leerFiltros`. Gastos e Ingresos cuentan solo su tipo; las transferencias y
  las reasignaciones van solo a Mover, porque contarlas sería contar dos veces el mismo dinero (criterio 3). Pagos,
  préstamos y cobros de deudas también van a Mover: no son gasto ni ingreso (spec 005, criterio 18). Salvo el pago al
  que se le puso categoría (spec 014): ese cuenta como gasto y va solo a Gastos, para no verse dos veces.
*/

const tiposDe = {
  ingresos: ["ingreso"],
  mover: ["transferencia", "reasignacion", "pago_deuda", "prestamo", "cobro_prestamo"],
} as const satisfies Record<Exclude<PestanaMovimientos, "gastos">, readonly (typeof movimientos.$inferSelect.tipo)[]>;

/** Qué movimientos son de cada pestaña. */
const deLaPestana = {
  gastos: cuentaComoGasto,
  ingresos: inArray(movimientos.tipo, [...tiposDe.ingresos]),
  mover: and(inArray(movimientos.tipo, [...tiposDe.mover]), not(cuentaComoGasto)),
} satisfies Record<PestanaMovimientos, unknown>;

/** Los movimientos de la pestaña en el periodo; con categoría y con etiqueta (spec 008), solo los suyos. */
function delPeriodo(
  pestana: PestanaMovimientos,
  rango: Rango,
  categoriaId: number | null,
  etiquetaId: number | null = null,
) {
  return and(
    deLaPestana[pestana],
    gte(movimientos.fecha, rango.desde),
    lte(movimientos.fecha, rango.hasta),
    categoriaId === null ? undefined : eq(movimientos.categoriaId, categoriaId),
    etiquetaId === null ? undefined : eq(movimientos.etiquetaId, etiquetaId),
  );
}

const tipoDeCategoria = { gastos: "gasto", ingresos: "ingreso" } as const;

/**
 * La categoría del filtro si es del tipo de la pestaña, tenga o no movimientos en el periodo (criterio 6); null si es
 * de otro tipo o no existe. Las archivadas también: siguen teniendo su historial.
 */
export async function categoriaDeLaPestana(pestana: "gastos" | "ingresos", categoriaId: number) {
  const [categoria] = await db
    .select({ categoriaId: categorias.id, nombre: categorias.nombre })
    .from(categorias)
    .where(and(eq(categorias.id, categoriaId), eq(categorias.tipo, tipoDeCategoria[pestana])));
  return categoria ?? null;
}

/**
 * Total en USD de cada categoría con movimientos de la pestaña en el periodo, sin el corte de la lista. Con etiqueta,
 * solo lo de esa etiqueta: las píldoras de Ingresos.
 */
export async function totalesPorCategoria(
  pestana: "gastos" | "ingresos",
  rango: Rango,
  etiquetaId: number | null = null,
) {
  return (
    db
      .select({
        categoriaId: categorias.id,
        nombre: categorias.nombre,
        icono: categorias.icono,
        color: categorias.color,
        centavos: sql<number>`sum(${movimientos.montoUsdCentavos})::bigint`.mapWith(Number),
      })
      .from(movimientos)
      .innerJoin(categorias, eq(movimientos.categoriaId, categorias.id))
      .where(delPeriodo(pestana, rango, null, etiquetaId))
      .groupBy(categorias.id)
      // Orden fijo, también en los empates: el punto del mayor residuo va siempre a la misma categoría.
      .orderBy(desc(sql`sum(${movimientos.montoUsdCentavos})`), categorias.id)
  );
}

/**
 * El anillo de Ingresos: el total en USD de cada etiqueta en el periodo, y lo que no lleva etiqueta junto (id null), para
 * que el centro siga siendo el total de la pestaña. Mismo orden fijo que por categoría.
 */
export async function totalesPorEtiqueta(pestana: "gastos" | "ingresos", rango: Rango) {
  return db
    .select({
      id: etiquetas.id,
      nombre: etiquetas.nombre,
      centavos: sql<number>`sum(${movimientos.montoUsdCentavos})::bigint`.mapWith(Number),
    })
    .from(movimientos)
    .leftJoin(etiquetas, eq(movimientos.etiquetaId, etiquetas.id))
    .where(delPeriodo(pestana, rango, null))
    .groupBy(etiquetas.id)
    .orderBy(desc(sql`sum(${movimientos.montoUsdCentavos})`), sql`${etiquetas.id} nulls last`);
}

/** Los movimientos del periodo, del más reciente al más viejo, hasta `limite`. */
export async function movimientosDelPeriodo(
  pestana: PestanaMovimientos,
  rango: Rango,
  categoriaId: number | null,
  limite = 200,
  etiquetaId: number | null = null,
) {
  return baseMovimientos()
    .where(delPeriodo(pestana, rango, categoriaId, etiquetaId))
    .orderBy(desc(movimientos.fecha), desc(movimientos.id))
    .limit(limite);
}

export type MovimientoDelPeriodo = Awaited<ReturnType<typeof movimientosDelPeriodo>>[number];

/**
 * Cuántos movimientos y cuánto en USD hay cada día del periodo, con el mismo filtro que la lista: da el "200 de N"
 * y el total exacto de cada día aunque la lista esté cortada.
 */
export async function resumenPorDia(
  pestana: PestanaMovimientos,
  rango: Rango,
  categoriaId: number | null,
  etiquetaId: number | null = null,
) {
  return db
    .select({
      fecha: movimientos.fecha,
      cantidad: count(),
      centavos: sql<number>`sum(${movimientos.montoUsdCentavos})::bigint`.mapWith(Number),
    })
    .from(movimientos)
    .where(delPeriodo(pestana, rango, categoriaId, etiquetaId))
    .groupBy(movimientos.fecha);
}

/**
 * Las etiquetas con movimientos de la pestaña en el periodo, con su total en USD, de la que más suma a la que menos
 * (spec 008, criterio 5). Con categoría, solo lo de esa categoría.
 */
export async function etiquetasDelPeriodo(pestana: PestanaMovimientos, rango: Rango, categoriaId: number | null) {
  return db
    .select({
      id: etiquetas.id,
      nombre: etiquetas.nombre,
      centavos: sql<number>`sum(${movimientos.montoUsdCentavos})::bigint`.mapWith(Number),
    })
    .from(movimientos)
    .innerJoin(etiquetas, eq(movimientos.etiquetaId, etiquetas.id))
    .where(delPeriodo(pestana, rango, categoriaId))
    .groupBy(etiquetas.id)
    .orderBy(desc(sql`sum(${movimientos.montoUsdCentavos})`), etiquetas.id);
}
