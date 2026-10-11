import { and, desc, eq, gte, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "./index";
import { categorias, cuentas, movimientos, partidasSobre, reglasReparto, sobres } from "./schema";

/** Saldo de cada sobre activo, en centavos de dólar. */
export async function saldosPorSobre() {
  return db
    .select({
      id: sobres.id,
      nombre: sobres.nombre,
      tipo: sobres.tipo,
      topeCentavos: sobres.topeCentavos,
      fechaObjetivo: sobres.fechaObjetivo,
      nota: sobres.nota,
      saldoCentavos: sql<number>`coalesce(sum(case
        when ${movimientos.tipo} = 'ingreso' and ${movimientos.sobreDestinoId} = ${sobres.id} then ${movimientos.montoUsdCentavos}
        when ${movimientos.tipo} = 'gasto' and ${movimientos.sobreOrigenId} = ${sobres.id} then -${movimientos.montoUsdCentavos}
        when ${movimientos.tipo} = 'reasignacion' and ${movimientos.sobreDestinoId} = ${sobres.id} then ${movimientos.montoUsdCentavos}
        when ${movimientos.tipo} = 'reasignacion' and ${movimientos.sobreOrigenId} = ${sobres.id} then -${movimientos.montoUsdCentavos}
        else 0 end), 0)::bigint`.mapWith(Number),
    })
    .from(sobres)
    .leftJoin(movimientos, or(eq(movimientos.sobreOrigenId, sobres.id), eq(movimientos.sobreDestinoId, sobres.id)))
    .where(eq(sobres.activo, true))
    .groupBy(sobres.id)
    .orderBy(sobres.orden, sobres.id);
}

/** Saldo de cada cuenta activa: en su propia moneda y en centavos de dólar. */
export async function saldosPorCuenta() {
  return db
    .select({
      id: cuentas.id,
      nombre: cuentas.nombre,
      moneda: cuentas.moneda,
      tipo: cuentas.tipo,
      esPropia: cuentas.esPropia,
      saldoCentavos: sql<number>`coalesce(sum(case
        when ${movimientos.tipo} = 'ingreso' and ${movimientos.cuentaDestinoId} = ${cuentas.id} then ${movimientos.montoCentavos}
        when ${movimientos.tipo} = 'gasto' and ${movimientos.cuentaOrigenId} = ${cuentas.id} then -${movimientos.montoCentavos}
        when ${movimientos.tipo} = 'transferencia' and ${movimientos.cuentaOrigenId} = ${cuentas.id} then -${movimientos.montoCentavos}
        when ${movimientos.tipo} = 'transferencia' and ${movimientos.cuentaDestinoId} = ${cuentas.id}
          then coalesce(${movimientos.montoDestinoCentavos}, ${movimientos.montoCentavos})
        else 0 end), 0)::bigint`.mapWith(Number),
      saldoUsdCentavos: sql<number>`coalesce(sum(case
        when ${movimientos.tipo} = 'ingreso' and ${movimientos.cuentaDestinoId} = ${cuentas.id} then ${movimientos.montoUsdCentavos}
        when ${movimientos.tipo} = 'gasto' and ${movimientos.cuentaOrigenId} = ${cuentas.id} then -${movimientos.montoUsdCentavos}
        when ${movimientos.tipo} = 'transferencia' and ${movimientos.cuentaOrigenId} = ${cuentas.id} then -${movimientos.montoUsdCentavos}
        when ${movimientos.tipo} = 'transferencia' and ${movimientos.cuentaDestinoId} = ${cuentas.id} then ${movimientos.montoUsdCentavos}
        else 0 end), 0)::bigint`.mapWith(Number),
    })
    .from(cuentas)
    .leftJoin(movimientos, or(eq(movimientos.cuentaOrigenId, cuentas.id), eq(movimientos.cuentaDestinoId, cuentas.id)))
    .where(eq(cuentas.activa, true))
    .groupBy(cuentas.id)
    .orderBy(cuentas.orden, cuentas.id);
}

function claveMes(fecha: Date) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
}

/** Primer día del mes actual en formato ISO (fecha local del servidor). */
function inicioDelMes(desplazamiento = 0) {
  const hoy = new Date();
  const d = new Date(hoy.getFullYear(), hoy.getMonth() + desplazamiento, 1);
  return `${claveMes(d)}-01`;
}

export type ResumenMes = { mes: string; ingresosCentavos: number; gastosCentavos: number };

/** Ingresos y gastos por mes, en USD, de los últimos `meses` meses incluyendo el actual. Meses sin datos en cero. */
export async function resumenMensual(meses = 6): Promise<ResumenMes[]> {
  const desde = inicioDelMes(-(meses - 1));
  const filas = await db
    .select({
      mes: sql<string>`to_char(date_trunc('month', ${movimientos.fecha}), 'YYYY-MM')`,
      ingresosCentavos:
        sql<number>`coalesce(sum(case when ${movimientos.tipo} = 'ingreso' then ${movimientos.montoUsdCentavos} else 0 end), 0)::bigint`.mapWith(
          Number,
        ),
      gastosCentavos:
        sql<number>`coalesce(sum(case when ${movimientos.tipo} = 'gasto' then ${movimientos.montoUsdCentavos} else 0 end), 0)::bigint`.mapWith(
          Number,
        ),
    })
    .from(movimientos)
    .where(gte(movimientos.fecha, desde))
    .groupBy(sql`1`)
    .orderBy(sql`1`);

  const porMes = new Map(filas.map((f) => [f.mes, f]));
  const hoy = new Date();
  const resultado: ResumenMes[] = [];
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    const clave = claveMes(d);
    const f = porMes.get(clave);
    resultado.push({
      mes: clave,
      ingresosCentavos: f?.ingresosCentavos ?? 0,
      gastosCentavos: f?.gastosCentavos ?? 0,
    });
  }
  return resultado;
}

/** Total gastado en USD en el mes actual. */
export async function gastadoEsteMes(): Promise<number> {
  const [fila] = await db
    .select({
      total: sql<number>`coalesce(sum(${movimientos.montoUsdCentavos}), 0)::bigint`.mapWith(Number),
    })
    .from(movimientos)
    .where(and(eq(movimientos.tipo, "gasto"), gte(movimientos.fecha, inicioDelMes())));
  return fila?.total ?? 0;
}

const cuentaOrigen = alias(cuentas, "cuenta_origen");
const cuentaDestino = alias(cuentas, "cuenta_destino");
const sobreOrigen = alias(sobres, "sobre_origen");
const sobreDestino = alias(sobres, "sobre_destino");

/** Un sobre con su saldo, o null si no existe o está inactivo. */
export async function sobrePorId(id: number) {
  if (!Number.isInteger(id)) return null;
  return (await saldosPorSobre()).find((s) => s.id === id) ?? null;
}

/** Desglose anual de un sobre de tipo fondo. */
export async function partidasDeSobre(sobreId: number) {
  return db
    .select()
    .from(partidasSobre)
    .where(and(eq(partidasSobre.sobreId, sobreId), eq(partidasSobre.activa, true)))
    .orderBy(partidasSobre.orden, partidasSobre.id);
}

/** Regla de reparto del sobre, si tiene. */
export async function reglaDeSobre(sobreId: number) {
  const [regla] = await db.select().from(reglasReparto).where(eq(reglasReparto.sobreId, sobreId));
  return regla ?? null;
}

/** Selección base de movimientos con los nombres de cuenta, sobre y categoría ya resueltos. */
function baseMovimientos() {
  return db
    .select({
      id: movimientos.id,
      fecha: movimientos.fecha,
      tipo: movimientos.tipo,
      montoCentavos: movimientos.montoCentavos,
      moneda: movimientos.moneda,
      montoUsdCentavos: movimientos.montoUsdCentavos,
      tasa: movimientos.tasa,
      nota: movimientos.nota,
      categoria: categorias.nombre,
      cuentaOrigen: cuentaOrigen.nombre,
      cuentaDestino: cuentaDestino.nombre,
      sobreOrigen: sobreOrigen.nombre,
      sobreDestino: sobreDestino.nombre,
    })
    .from(movimientos)
    .leftJoin(categorias, eq(movimientos.categoriaId, categorias.id))
    .leftJoin(cuentaOrigen, eq(movimientos.cuentaOrigenId, cuentaOrigen.id))
    .leftJoin(cuentaDestino, eq(movimientos.cuentaDestinoId, cuentaDestino.id))
    .leftJoin(sobreOrigen, eq(movimientos.sobreOrigenId, sobreOrigen.id))
    .leftJoin(sobreDestino, eq(movimientos.sobreDestinoId, sobreDestino.id));
}

/** Últimos movimientos de toda la app. */
export async function movimientosRecientes(limite = 80) {
  return baseMovimientos().orderBy(desc(movimientos.fecha), desc(movimientos.id)).limit(limite);
}

/** Movimientos que tocan un sobre, como origen o destino. */
export async function movimientosDeSobre(sobreId: number, limite = 50) {
  return baseMovimientos()
    .where(or(eq(movimientos.sobreOrigenId, sobreId), eq(movimientos.sobreDestinoId, sobreId)))
    .orderBy(desc(movimientos.fecha), desc(movimientos.id))
    .limit(limite);
}

export type MovimientoReciente = Awaited<ReturnType<typeof movimientosRecientes>>[number];
