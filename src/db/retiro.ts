import { and, desc, eq, gt, sql } from "drizzle-orm";
import { marcaDeMover, prefijoDeCaptura } from "../lib/captura";
import {
  type Cambio,
  type PlanDeRetiro,
  type VistaPrevia,
  type RepartoPosterior,
  type Retiro,
  firmaDeRetiro,
  juntarPorSobre,
  planDeRetiro,
} from "../lib/retiro";
import { saldosPorCuenta } from "./consultas";
import { db } from "./index";
import { type Ejecutor, saldoDeSobre } from "./movimientos";
import { movimientos, sobres } from "./schema";

/*
  Retirar lo repartido (spec 007, criterio 11): leer lo que se repartió desde "Por asignar" después de lo que se
  deshace, armar la vista previa con los saldos, y aplicarlo. Las reglas viven en src/lib/retiro.ts; quien deshace
  toma antes el candado de "Por asignar" y vuelve a calcular el plan dentro de su transacción.
*/

/**
 * Lo que se repartió desde "Por asignar" después de la fila `despuesDeId` (Repartir, el reparto de un ingreso y
 * Apartar; no Mover), del más reciente al más viejo. `sinCaptura` deja fuera el reparto propio de un ingreso que se
 * borra, que se va con él. Con `bloquear`, las filas quedan bloqueadas hasta el final de la transacción.
 */
export async function repartoPosterior(
  ejecutor: Ejecutor,
  porAsignarId: number,
  despuesDeId: number,
  sinCaptura: string | null,
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
        sql`coalesce(${movimientos.referenciaExterna}, '') not like ${`%${marcaDeMover}%`}`,
        sinCaptura === null
          ? undefined
          : sql`coalesce(${movimientos.referenciaExterna}, '') not like ${`${prefijoDeCaptura(sinCaptura)}%`}`,
      ),
    )
    .orderBy(desc(movimientos.id));
  const filas = bloquear ? await consulta.for("update", { of: movimientos }) : await consulta;
  return filas.flatMap((f) => (f.sobreId === null ? [] : [{ ...f, sobreId: f.sobreId }]));
}

/** La vista previa con los saldos de ahora. Sin candado: la acción vuelve a calcular el plan y compara la firma. */
export async function vistaPrevia(
  cuenta: { id: number; centavos: number } | null,
  cambios: Cambio[],
  retiros: Retiro[],
): Promise<VistaPrevia> {
  const [cuentas, sobres] = await Promise.all([
    saldosPorCuenta(),
    Promise.all(
      cambios.map(async (c) => {
        const antes = await saldoDeSobre(db, c.sobreId);
        return { nombre: c.nombre, antes, despues: antes + c.centavos, moneda: null };
      }),
    ),
  ]);
  const deLaCuenta = cuenta && cuentas.find((c) => c.id === cuenta.id);
  const saldoDeLaCuenta = deLaCuenta
    ? [
        {
          nombre: deLaCuenta.nombre,
          antes: deLaCuenta.saldoCentavos,
          despues: deLaCuenta.saldoCentavos - (cuenta?.centavos ?? 0),
          moneda: deLaCuenta.moneda,
        },
      ]
    : [];
  return { firma: firmaDeRetiro(retiros), retirado: juntarPorSobre(retiros), saldos: [...saldoDeLaCuenta, ...sobres] };
}

/** El plan de retiro de lo que falta en "Por asignar", leído con el ejecutor dado. */
export async function planDeRetiroDesde(
  ejecutor: Ejecutor,
  faltan: number,
  porAsignarId: number,
  despuesDeId: number,
  sinCaptura: string | null,
  bloquear: boolean,
): Promise<PlanDeRetiro> {
  if (faltan <= 0) return { alcanza: true, retiros: [] };
  return planDeRetiro(faltan, await repartoPosterior(ejecutor, porAsignarId, despuesDeId, sinCaptura, bloquear));
}

/** Aplica los retiros, dentro de la transacción que los planeó: borra los enteros y achica el último. */
export async function aplicarRetiros(tx: Ejecutor, retiros: Retiro[]) {
  for (const r of retiros) {
    if (r.borra) {
      await tx.delete(movimientos).where(eq(movimientos.id, r.id));
    } else {
      // Una reasignación es en dólares: su monto y su monto en USD son el mismo.
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
