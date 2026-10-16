import { type SQL, and, count, desc, eq, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { estadoDe, pendienteDe } from "../lib/deudas";
import { hoyEnCaracas } from "../lib/fechas";
import { baseMovimientos } from "./consultas";
import { db } from "./index";
import type { Ejecutor } from "./movimientos";
import { cuentas, deudas, movimientos, sobres } from "./schema";
import { efectoEnSobre } from "./sumas-de-saldo";

/*
  Lecturas de deudas y préstamos (spec 005). El pendiente nunca se guarda: aquí se suman los movimientos de cada deuda
  y src/lib/deudas.ts lo calcula. Lo prestado son los préstamos; lo saldado, los pagos y los cobros, que la escritura
  solo deja en la deuda de su sentido.
*/

const usdDe = (tipos: ("prestamo" | "pago_deuda" | "cobro_prestamo")[]) =>
  sql<number>`coalesce(sum(${movimientos.montoUsdCentavos}) filter (where ${inArray(movimientos.tipo, tipos)}), 0)::bigint`.mapWith(
    Number,
  );

async function consultarDeudas(donde?: SQL, ejecutor: Ejecutor = db) {
  const filas = await ejecutor
    .select({
      id: deudas.id,
      sentido: deudas.sentido,
      persona: deudas.persona,
      montoInicialCentavos: deudas.montoInicialCentavos,
      fechaPrevista: deudas.fechaPrevista,
      cuentaPrevistaId: deudas.cuentaPrevistaId,
      cuentaPrevista: cuentas.nombre,
      monedaPrevista: cuentas.moneda,
      cuentaPrevistaActiva: cuentas.activa,
      nota: deudas.nota,
      creadoEn: deudas.creadoEn,
      prestadoCentavos: usdDe(["prestamo"]),
      saldadoCentavos: usdDe(["pago_deuda", "cobro_prestamo"]),
      movimientos: count(movimientos.id),
    })
    .from(deudas)
    .leftJoin(cuentas, eq(deudas.cuentaPrevistaId, cuentas.id))
    .leftJoin(movimientos, eq(movimientos.deudaId, deudas.id))
    .where(donde)
    .groupBy(deudas.id, cuentas.id)
    .orderBy(sql`${deudas.fechaPrevista} asc nulls last`, deudas.id);
  return filas.map((f) => {
    const { sentido, montoInicialCentavos, prestadoCentavos, saldadoCentavos } = f;
    const pendienteCentavos = pendienteDe({ sentido, montoInicialCentavos, prestadoCentavos, saldadoCentavos });
    return { ...f, pendienteCentavos, estado: estadoDe(pendienteCentavos) };
  });
}

/** Todas las deudas con su pendiente, lo prestado y lo saldado, y su cuenta prevista; por fecha, sin fecha al final. */
export async function deudasConPendiente() {
  return consultarDeudas();
}

export type DeudaConPendiente = Awaited<ReturnType<typeof deudasConPendiente>>[number];

/** Una deuda con su pendiente; dentro de una transacción, con lo que ya está escrito. null si no existe. */
export async function deudaPorId(id: number, ejecutor: Ejecutor = db) {
  const [deuda] = await consultarDeudas(eq(deudas.id, id), ejecutor);
  return deuda ?? null;
}

/** Una deuda con su pendiente y sus movimientos, del más reciente al más viejo; null si no existe. */
export async function deudaConMovimientos(id: number) {
  const deuda = await deudaPorId(id);
  if (!deuda) return null;
  const historial = await baseMovimientos()
    .where(eq(movimientos.deudaId, id))
    .orderBy(desc(movimientos.fecha), desc(movimientos.id));
  return { deuda, historial };
}

const sobreOrigen = alias(sobres, "sobre_origen");

/**
 * El sobre Deudas por su tipo, como "Por asignar": si hubiera dos, el de menor orden. Aunque esté inactivo, para que
 * /deudas diga por qué no deja pagar ni apartar (criterio 10). Con su saldo y lo recibido desde "Por asignar" en el
 * mes de hoy (Caracas), que la cuota resta para saber lo apartado al empezar el mes. null si no existe.
 */
export async function sobreDeudas() {
  const [sobre] = await db
    .select({ id: sobres.id, nombre: sobres.nombre, activo: sobres.activo })
    .from(sobres)
    .where(eq(sobres.tipo, "deudas"))
    .orderBy(sobres.orden, sobres.id)
    .limit(1);
  if (!sobre) return null;
  const mes = hoyEnCaracas(new Date()).slice(0, 7);
  const [fila] = await db
    .select({
      saldoCentavos: sql<number>`coalesce(sum(${efectoEnSobre(sobre.id)}), 0)::bigint`.mapWith(Number),
      recibidoEnElMesCentavos: sql<number>`coalesce(sum(${movimientos.montoUsdCentavos}) filter (where ${and(
        eq(movimientos.tipo, "reasignacion"),
        eq(movimientos.sobreDestinoId, sobre.id),
        eq(sobreOrigen.tipo, "por_asignar"),
        sql`to_char(${movimientos.fecha}, 'YYYY-MM') = ${mes}`,
      )}), 0)::bigint`.mapWith(Number),
    })
    .from(movimientos)
    .leftJoin(sobreOrigen, eq(movimientos.sobreOrigenId, sobreOrigen.id))
    .where(or(eq(movimientos.sobreOrigenId, sobre.id), eq(movimientos.sobreDestinoId, sobre.id)));
  return {
    ...sobre,
    saldoCentavos: fila?.saldoCentavos ?? 0,
    recibidoEnElMesCentavos: fila?.recibidoEnElMesCentavos ?? 0,
  };
}
