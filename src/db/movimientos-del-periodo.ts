import { and, count, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type { PestanaMovimientos, Rango } from "@/lib/periodos";
import { baseMovimientos } from "./consultas";
import { db } from "./index";
import { categorias, movimientos } from "./schema";

/*
  Lecturas de /movimientos (spec 003): tres consultas por página, todas sobre `movimientos_fecha_idx`. Los rangos y
  la categoría llegan ya validados por `leerFiltros`. Gastos e Ingresos cuentan solo su tipo; las transferencias y
  las reasignaciones van solo a Mover, porque contarlas sería contar dos veces el mismo dinero (criterio 3).
*/

const tiposDe = {
  gastos: ["gasto"],
  ingresos: ["ingreso"],
  mover: ["transferencia", "reasignacion"],
} as const satisfies Record<PestanaMovimientos, readonly (typeof movimientos.$inferSelect.tipo)[]>;

function delPeriodo(pestana: PestanaMovimientos, rango: Rango, categoriaId: number | null) {
  return and(
    inArray(movimientos.tipo, [...tiposDe[pestana]]),
    gte(movimientos.fecha, rango.desde),
    lte(movimientos.fecha, rango.hasta),
    categoriaId === null ? undefined : eq(movimientos.categoriaId, categoriaId),
  );
}

/** Total en USD de cada categoría con movimientos de la pestaña en el periodo, sin el corte de la lista. */
export async function totalesPorCategoria(pestana: "gastos" | "ingresos", rango: Rango) {
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
      .where(delPeriodo(pestana, rango, null))
      .groupBy(categorias.id)
      // Orden fijo, también en los empates: el punto del mayor residuo va siempre a la misma categoría.
      .orderBy(desc(sql`sum(${movimientos.montoUsdCentavos})`), categorias.id)
  );
}

/** Los movimientos del periodo, del más reciente al más viejo, hasta `limite`. */
export async function movimientosDelPeriodo(
  pestana: PestanaMovimientos,
  rango: Rango,
  categoriaId: number | null,
  limite = 200,
) {
  return baseMovimientos()
    .where(delPeriodo(pestana, rango, categoriaId))
    .orderBy(desc(movimientos.fecha), desc(movimientos.id))
    .limit(limite);
}

export type MovimientoDelPeriodo = Awaited<ReturnType<typeof movimientosDelPeriodo>>[number];

/**
 * Cuántos movimientos y cuánto en USD hay cada día del periodo, con el mismo filtro que la lista: da el "200 de N"
 * y el total exacto de cada día aunque la lista esté cortada.
 */
export async function resumenPorDia(pestana: PestanaMovimientos, rango: Rango, categoriaId: number | null) {
  return db
    .select({
      fecha: movimientos.fecha,
      cantidad: count(),
      centavos: sql<number>`sum(${movimientos.montoUsdCentavos})::bigint`.mapWith(Number),
    })
    .from(movimientos)
    .where(delPeriodo(pestana, rango, categoriaId))
    .groupBy(movimientos.fecha);
}
