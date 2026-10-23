import { and, desc, eq, gt, notExists, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { marcaDeMover } from "../lib/captura";
import {
  type Cambio,
  type PlanDeRetiro,
  type RepartoPosterior,
  type Retiro,
  type SaldoQueQueda,
  type VistaPrevia,
  firmaDeVista,
  juntarPorSobre,
  planDeRetiro,
} from "../lib/retiro";
import { claveReparto, type Ejecutor, saldoDeSobre } from "./movimientos";
import { cuentas, movimientos, sobres } from "./schema";
import { efectoEnCuenta } from "./sumas-de-saldo";

/*
  Retirar lo repartido (spec 007, criterio 11): leer lo que se repartió desde "Por asignar" después de lo que se
  deshace, armar la vista previa con los saldos, y aplicarlo. Las reglas viven en src/lib/retiro.ts; quien deshace
  toma antes el candado de "Por asignar", vuelve a calcular el plan y la vista previa dentro de su transacción y solo
  aplica si su firma es la que se confirmó.
*/

const ingresoPropio = alias(movimientos, "ingreso_propio");

/**
 * Lo que se repartió desde "Por asignar" después de la fila `despuesDeId` con Repartir o Apartar, del más reciente al
 * más viejo. Quedan fuera Mover, el reparto propio de un ingreso (la reasignación cuya captura tiene un ingreso: es de
 * ese ingreso, que se lleva el suyo al borrarse), los sobres archivados y una fila cuyo monto no es su monto en
 * dólares (guardian-datos, hallazgos 1 y 3). Con `bloquear`, las filas quedan bloqueadas hasta el final de la
 * transacción.
 */
export async function repartoPosterior(
  ejecutor: Ejecutor,
  porAsignarId: number,
  despuesDeId: number,
  bloquear: boolean,
): Promise<RepartoPosterior[]> {
  const consulta = ejecutor
    .select({
      id: movimientos.id,
      sobreId: movimientos.sobreDestinoId,
      nombre: sobres.nombre,
      montoCentavos: movimientos.montoUsdCentavos,
    })
    .from(movimientos)
    .innerJoin(sobres, eq(sobres.id, movimientos.sobreDestinoId))
    .where(
      and(
        eq(movimientos.tipo, "reasignacion"),
        eq(movimientos.sobreOrigenId, porAsignarId),
        gt(movimientos.id, despuesDeId),
        eq(sobres.activo, true),
        eq(movimientos.montoCentavos, movimientos.montoUsdCentavos),
        sql`coalesce(${movimientos.referenciaExterna}, '') not like ${`%${marcaDeMover}%`}`,
        notExists(
          ejecutor
            .select({ uno: sql`1` })
            .from(ingresoPropio)
            .where(
              and(
                eq(ingresoPropio.tipo, "ingreso"),
                eq(
                  ingresoPropio.referenciaExterna,
                  sql`regexp_replace(${movimientos.referenciaExterna}, '-reasignacion-[0-9]+$', '-ingreso')`,
                ),
              ),
            ),
        ),
      ),
    )
    .orderBy(desc(movimientos.id));
  const filas = bloquear ? await consulta.for("update", { of: movimientos }) : await consulta;
  return filas.flatMap((f) => (f.sobreId === null ? [] : [{ ...f, sobreId: f.sobreId }]));
}

/** El plan de retiro de lo que falta en "Por asignar", leído con el ejecutor dado. Solo se retira desde "Por asignar". */
export async function planDeRetiroDesde(
  ejecutor: Ejecutor,
  faltan: number,
  porAsignarId: number,
  despuesDeId: number,
  bloquear: boolean,
): Promise<PlanDeRetiro> {
  if (faltan <= 0) return { alcanza: true, retiros: [] };
  const [origen] = await ejecutor.select({ tipo: sobres.tipo }).from(sobres).where(eq(sobres.id, porAsignarId));
  if (origen?.tipo !== "por_asignar") return { alcanza: false, faltan, alcanzaHasta: 0 };
  return planDeRetiro(faltan, await repartoPosterior(ejecutor, porAsignarId, despuesDeId, bloquear));
}

/**
 * Los candados de los sobres de los que se retira, después del de "Por asignar" y en orden de id: un Mover, un pago o
 * un Apartar desde uno de ellos espera, y lee el saldo ya con el retiro (guardian-datos, hallazgo 2). Ninguna otra
 * operación toma dos candados del reparto, así que el orden no puede trabarse.
 */
export async function bloquearSobresDelRetiro(tx: Ejecutor, retiros: Retiro[]) {
  for (const id of [...new Set(retiros.map((r) => r.sobreId))].sort((a, b) => a - b)) {
    await tx.execute(sql`select pg_advisory_xact_lock(${claveReparto}, ${id})`);
  }
}

/** El saldo de una cuenta en su moneda, con su nombre, leído con el ejecutor dado. */
async function saldoDeCuenta(ejecutor: Ejecutor, cuentaId: number) {
  const [fila] = await ejecutor
    .select({
      nombre: cuentas.nombre,
      moneda: cuentas.moneda,
      saldoCentavos: sql<number>`coalesce(sum(${efectoEnCuenta(cuentas.id)}), 0)::bigint`.mapWith(Number),
    })
    .from(cuentas)
    .leftJoin(movimientos, or(eq(movimientos.cuentaOrigenId, cuentas.id), eq(movimientos.cuentaDestinoId, cuentas.id)))
    .where(eq(cuentas.id, cuentaId))
    .groupBy(cuentas.id);
  return fila ?? null;
}

/**
 * La vista previa: cómo quedan la cuenta y cada sobre, lo retirado y su firma. La misma función la arma para la
 * pantalla, sin candado, y dentro de la transacción que aplica, para comparar la firma.
 */
export async function vistaPrevia(
  ejecutor: Ejecutor,
  cuenta: { id: number; centavos: number } | null,
  cambios: Cambio[],
  retiros: Retiro[],
): Promise<VistaPrevia> {
  const deLaCuenta = cuenta ? await saldoDeCuenta(ejecutor, cuenta.id) : null;
  const saldos: SaldoQueQueda[] = [];
  if (cuenta && deLaCuenta) {
    saldos.push({
      nombre: deLaCuenta.nombre,
      antes: deLaCuenta.saldoCentavos,
      despues: deLaCuenta.saldoCentavos - cuenta.centavos,
      moneda: deLaCuenta.moneda,
    });
  }
  for (const c of cambios) {
    const antes = await saldoDeSobre(ejecutor, c.sobreId);
    saldos.push({ nombre: c.nombre, antes, despues: antes + c.centavos, moneda: null });
  }
  return { firma: firmaDeVista(retiros, saldos), retirado: juntarPorSobre(retiros), saldos };
}

/** Aplica los retiros, dentro de la transacción que los planeó: borra los enteros y achica el último. */
export async function aplicarRetiros(tx: Ejecutor, retiros: Retiro[]) {
  for (const r of retiros) {
    if (r.borra) {
      await tx.delete(movimientos).where(eq(movimientos.id, r.id));
    } else {
      // Solo se retiran filas cuyo monto es su monto en dólares (repartoPosterior): restar lo mismo a los dos.
      await tx
        .update(movimientos)
        .set({
          montoCentavos: sql`${movimientos.montoCentavos} - ${r.centavos}`,
          montoUsdCentavos: sql`${movimientos.montoUsdCentavos} - ${r.centavos}`,
        })
        .where(eq(movimientos.id, r.id));
    }
  }
}
