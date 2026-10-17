import { and, count, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { etiquetasDe, patronDeEtiqueta } from "@/lib/etiquetas";
import type { PestanaMovimientos, Rango } from "@/lib/periodos";
import { baseMovimientos } from "./consultas";
import { db } from "./index";
import { categorias, movimientos } from "./schema";

/*
  Lecturas de /movimientos (spec 003): tres consultas por página, todas sobre `movimientos_fecha_idx`, y con filtro
  una cuarta por la clave de la categoría. Los rangos y
  la categoría llegan ya validados por `leerFiltros`. Gastos e Ingresos cuentan solo su tipo; las transferencias y
  las reasignaciones van solo a Mover, porque contarlas sería contar dos veces el mismo dinero (criterio 3). Pagos,
  préstamos y cobros de deudas también van a Mover: no son gasto ni ingreso (spec 005, criterio 18).
*/

const tiposDe = {
  gastos: ["gasto"],
  ingresos: ["ingreso"],
  mover: ["transferencia", "reasignacion", "pago_deuda", "prestamo", "cobro_prestamo"],
} as const satisfies Record<PestanaMovimientos, readonly (typeof movimientos.$inferSelect.tipo)[]>;

/**
 * Los movimientos de la pestaña en el periodo; con categoría y con etiqueta, solo los suyos. La etiqueta llega ya
 * validada por leerEtiqueta y su patrón va como parámetro (spec 007, criterio 6).
 */
function delPeriodo(
  pestana: PestanaMovimientos,
  rango: Rango,
  categoriaId: number | null,
  etiqueta: string | null = null,
) {
  return and(
    inArray(movimientos.tipo, [...tiposDe[pestana]]),
    gte(movimientos.fecha, rango.desde),
    lte(movimientos.fecha, rango.hasta),
    categoriaId === null ? undefined : eq(movimientos.categoriaId, categoriaId),
    etiqueta === null ? undefined : sql`${movimientos.nota} ~* ${patronDeEtiqueta(etiqueta)}`,
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
  etiqueta: string | null = null,
) {
  return baseMovimientos()
    .where(delPeriodo(pestana, rango, categoriaId, etiqueta))
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
  etiqueta: string | null = null,
) {
  return db
    .select({
      fecha: movimientos.fecha,
      cantidad: count(),
      centavos: sql<number>`sum(${movimientos.montoUsdCentavos})::bigint`.mapWith(Number),
    })
    .from(movimientos)
    .where(delPeriodo(pestana, rango, categoriaId, etiqueta))
    .groupBy(movimientos.fecha);
}

/** Las etiquetas con # que aparecen en las notas de la pestaña en el periodo, las más usadas primero (spec 007). */
export async function etiquetasDelPeriodo(pestana: PestanaMovimientos, rango: Rango): Promise<string[]> {
  const notas = await db
    .select({ nota: movimientos.nota })
    .from(movimientos)
    .where(and(delPeriodo(pestana, rango, null), sql`${movimientos.nota} like '%#%'`));
  const usos = new Map<string, number>();
  for (const { nota } of notas) for (const e of etiquetasDe(nota)) usos.set(e, (usos.get(e) ?? 0) + 1);
  return [...usos.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([e]) => e);
}
