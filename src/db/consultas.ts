import { and, desc, eq, gte, ne, not, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "./index";
import { clavesDeMeses, hoyEnCaracas, inicioDeMes } from "@/lib/fechas";
import { sobreAceptaPago } from "@/lib/deudas";
import { sobreAceptaGasto } from "@/lib/gastos";
import { categorias, cuentas, deudas, etiquetas, movimientos, partidasSobre, reglasReparto, sobres } from "./schema";
import { cuentaComoGasto, efectoEnCuenta, efectoEnCuentaUsd, efectoEnSobre, esHistorial } from "./sumas-de-saldo";

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
      saldoCentavos: sql<number>`coalesce(sum(${efectoEnSobre(sobres.id)}), 0)::bigint`.mapWith(Number),
    })
    .from(sobres)
    .leftJoin(movimientos, or(eq(movimientos.sobreOrigenId, sobres.id), eq(movimientos.sobreDestinoId, sobres.id)))
    .where(eq(sobres.activo, true))
    .groupBy(sobres.id)
    .orderBy(sobres.orden, sobres.id);
}

const saldoEnSuMoneda = () => sql<number>`coalesce(sum(${efectoEnCuenta(cuentas.id)}), 0)::bigint`;
const saldoEnUsd = () => sql<number>`coalesce(sum(${efectoEnCuentaUsd(cuentas.id)}), 0)::bigint`;

/** Cada cuenta con su saldo en su moneda y en centavos de dólar, para las dos listas de abajo. */
function consultarSaldosDeCuentas() {
  return db
    .select({
      id: cuentas.id,
      nombre: cuentas.nombre,
      moneda: cuentas.moneda,
      tipo: cuentas.tipo,
      esPropia: cuentas.esPropia,
      icono: cuentas.icono,
      color: cuentas.color,
      activa: cuentas.activa,
      saldoCentavos: saldoEnSuMoneda().mapWith(Number),
      saldoUsdCentavos: saldoEnUsd().mapWith(Number),
    })
    .from(cuentas)
    .leftJoin(movimientos, or(eq(movimientos.cuentaOrigenId, cuentas.id), eq(movimientos.cuentaDestinoId, cuentas.id)))
    .$dynamic();
}

/**
 * Saldo de cada cuenta activa: en su propia moneda y en centavos de dólar. Es la lista para registrar y elegir: una
 * archivada no se ofrece, tampoco si su saldo dejó de ser 0 (spec 013, del guardián: la de bolívares se elige sola).
 */
export async function saldosPorCuenta() {
  return consultarSaldosDeCuentas()
    .where(eq(cuentas.activa, true))
    .groupBy(cuentas.id)
    .orderBy(cuentas.orden, cuentas.id);
}

/**
 * Las de saldosPorCuenta y también la archivada cuyo saldo dejó de ser 0, por editar o deshacer un movimiento viejo
 * (spec 013, criterio 10): el cuadre de /cuentas nunca esconde dinero. Para volver a usarla, se restaura.
 */
export async function cuentasDelCuadre() {
  return consultarSaldosDeCuentas()
    .groupBy(cuentas.id)
    .having(or(eq(cuentas.activa, true), sql`${saldoEnSuMoneda()} <> 0`, sql`${saldoEnUsd()} <> 0`))
    .orderBy(cuentas.orden, cuentas.id);
}

/** Primer día del mes de Caracas, movido `desplazamiento` meses: el servidor (Vercel) corre en UTC. */
function inicioDelMes(desplazamiento = 0) {
  return inicioDeMes(hoyEnCaracas(new Date()), desplazamiento);
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
        sql<number>`coalesce(sum(case when ${cuentaComoGasto} then ${movimientos.montoUsdCentavos} else 0 end), 0)::bigint`.mapWith(
          Number,
        ),
    })
    .from(movimientos)
    .where(gte(movimientos.fecha, desde))
    .groupBy(sql`1`)
    .orderBy(sql`1`);

  const porMes = new Map(filas.map((f) => [f.mes, f]));
  return clavesDeMeses(hoyEnCaracas(new Date()), meses).map((clave) => ({
    mes: clave,
    ingresosCentavos: porMes.get(clave)?.ingresosCentavos ?? 0,
    gastosCentavos: porMes.get(clave)?.gastosCentavos ?? 0,
  }));
}

/** Total gastado en USD en el mes actual. */
export async function gastadoEsteMes(): Promise<number> {
  const [fila] = await db
    .select({
      total: sql<number>`coalesce(sum(${movimientos.montoUsdCentavos}), 0)::bigint`.mapWith(Number),
    })
    .from(movimientos)
    .where(and(cuentaComoGasto, gte(movimientos.fecha, inicioDelMes())));
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

/** Selección base de movimientos con los nombres de cuenta, sobre, categoría y persona de la deuda ya resueltos. */
export function baseMovimientos() {
  return db
    .select({
      id: movimientos.id,
      fecha: movimientos.fecha,
      tipo: movimientos.tipo,
      montoCentavos: movimientos.montoCentavos,
      moneda: movimientos.moneda,
      montoUsdCentavos: movimientos.montoUsdCentavos,
      montoDestinoCentavos: movimientos.montoDestinoCentavos,
      monedaDestino: movimientos.monedaDestino,
      tasa: movimientos.tasa,
      nota: movimientos.nota,
      categoria: categorias.nombre,
      categoriaIcono: categorias.icono,
      categoriaColor: categorias.color,
      cuentaOrigen: cuentaOrigen.nombre,
      cuentaDestino: cuentaDestino.nombre,
      sobreOrigen: sobreOrigen.nombre,
      sobreDestino: sobreDestino.nombre,
      sobreOrigenId: movimientos.sobreOrigenId,
      sobreDestinoId: movimientos.sobreDestinoId,
      deudaId: movimientos.deudaId,
      persona: deudas.persona,
      etiquetaId: movimientos.etiquetaId,
      etiqueta: etiquetas.nombre,
      // Una transferencia entre cuentas (spec 011), que se deshace; no la venta de USDT de un gasto en bolívares.
      entreCuentas: sql<boolean>`(${movimientos.tipo}::text = 'transferencia' and ${movimientos.origen}::text = 'manual'
        and coalesce(${movimientos.referenciaExterna}, '') like 'captura-%-envio')`,
      // Historial de la app vieja (spec 012): se ve, pero no se abre.
      historial: sql<boolean>`${esHistorial}`,
    })
    .from(movimientos)
    .leftJoin(categorias, eq(movimientos.categoriaId, categorias.id))
    .leftJoin(cuentaOrigen, eq(movimientos.cuentaOrigenId, cuentaOrigen.id))
    .leftJoin(cuentaDestino, eq(movimientos.cuentaDestinoId, cuentaDestino.id))
    .leftJoin(sobreOrigen, eq(movimientos.sobreOrigenId, sobreOrigen.id))
    .leftJoin(sobreDestino, eq(movimientos.sobreDestinoId, sobreDestino.id))
    .leftJoin(deudas, eq(movimientos.deudaId, deudas.id))
    .leftJoin(etiquetas, eq(movimientos.etiquetaId, etiquetas.id));
}

/** Últimos movimientos de toda la app. */
export async function movimientosRecientes(limite = 80) {
  return baseMovimientos().orderBy(desc(movimientos.fecha), desc(movimientos.id)).limit(limite);
}

/** Movimientos que tocan un sobre, como origen o destino. Sin el historial de la app vieja (spec 012): no fue su dinero. */
export async function movimientosDeSobre(sobreId: number, limite = 50) {
  return baseMovimientos()
    .where(and(or(eq(movimientos.sobreOrigenId, sobreId), eq(movimientos.sobreDestinoId, sobreId)), not(esHistorial)))
    .orderBy(desc(movimientos.fecha), desc(movimientos.id))
    .limit(limite);
}

export type MovimientoReciente = Awaited<ReturnType<typeof movimientosRecientes>>[number];

// ---------- Captura de gasto (spec 001) ----------

/** Categorías de gasto activas, las más usadas en los últimos 90 días primero. */
export async function categoriasDeGastoPorUso() {
  const usos = sql<number>`count(${movimientos.id})::int`.mapWith(Number);
  return db
    .select({ id: categorias.id, nombre: categorias.nombre, icono: categorias.icono, color: categorias.color, usos })
    .from(categorias)
    .leftJoin(
      movimientos,
      and(eq(movimientos.categoriaId, categorias.id), cuentaComoGasto, gte(movimientos.fecha, sql`current_date - 90`)),
    )
    .where(and(eq(categorias.tipo, "gasto"), eq(categorias.activa, true)))
    .groupBy(categorias.id)
    .orderBy(desc(usos), categorias.orden, categorias.id);
}

/** Sobres desde los que se paga una deuda, con su saldo: los activos menos "Por asignar" (spec 014). */
export async function sobresParaPagar() {
  return (await saldosPorSobre()).filter((s) => sobreAceptaPago(s.tipo));
}

/** Sobres a los que se les puede cargar un gasto, con su saldo: los activos menos "Por asignar" y Deudas. */
export async function sobresParaGasto() {
  return (await saldosPorSobre()).filter((s) => sobreAceptaGasto(s.tipo));
}

/** Cuentas que se pueden preseleccionar: propias, activas y en dólares. Nunca la de la prima. */
const enDolaresPropia = and(eq(cuentas.esPropia, true), eq(cuentas.activa, true), ne(cuentas.moneda, "VES"));

/**
 * Cuenta que se preselecciona al pagar en dólares: la cuenta propia en dólares del último gasto manual;
 * sin historial, la de la venta. La de la prima nunca se preselecciona, para no cargarle un gasto por descuido.
 */
export async function cuentaPorDefectoParaGasto(): Promise<number | null> {
  const [ultima] = await db
    .select({ id: cuentas.id })
    .from(movimientos)
    .innerJoin(cuentas, eq(movimientos.cuentaOrigenId, cuentas.id))
    .where(and(eq(movimientos.tipo, "gasto"), eq(movimientos.origen, "manual"), enDolaresPropia))
    .orderBy(desc(movimientos.id))
    .limit(1);
  return ultima?.id ?? (await cuentaPorDefectoParaVenta());
}

/**
 * Cuenta de donde salen los dólares que se venden para pagar en bolívares: Binance, sin importar el
 * último gasto; si alguien la renombra, la primera cuenta propia en dólares por orden.
 */
export async function cuentaPorDefectoParaVenta(): Promise<number | null> {
  const [binance] = await db
    .select({ id: cuentas.id })
    .from(cuentas)
    .where(enDolaresPropia)
    .orderBy(desc(eq(cuentas.nombre, "Binance")), cuentas.orden, cuentas.id)
    .limit(1);
  return binance?.id ?? null;
}
