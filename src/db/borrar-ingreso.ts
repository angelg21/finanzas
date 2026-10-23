import { eq, inArray, sql } from "drizzle-orm";
import { idDeReferencia } from "../lib/captura";
import {
  type PlanDeBorrado,
  type RepartoGuardado,
  faltaParaBorrar,
  planDeBorradoDeIngreso,
} from "../lib/editar-ingreso";
import { type Retiro, type VistaPrevia, cambiosPorSobre, noAlcanzaElRetiro } from "../lib/retiro";
import { type MovimientoParaEditar, filaBloqueada, repartoConSaldos } from "./editar-movimientos";
import { db } from "./index";
import { type Ejecutor, claveReparto, saldoDeSobre } from "./movimientos";
import { aplicarRetiros, bloquearSobresDelRetiro, planDeRetiroDesde, vistaPrevia } from "./retiro";
import { movimientos, sobres } from "./schema";

/*
  Borrar un ingreso con su reparto (spec 006, criterio 7). Si el sobre que lo recibió ya no tiene lo que quedó sin
  repartir, se retira del reparto posterior (spec 007, criterio 11): se muestra antes y se aplica solo al confirmar
  esa misma vista previa. Vivía con la edición; tiene su propio archivo desde ese criterio.
*/

/** Lo retirado, con el saldo de cada sobre, para que el plan avise del que queda en negativo. */
async function conSaldos(ejecutor: Ejecutor, retiros: Retiro[]): Promise<RepartoGuardado[]> {
  return Promise.all(
    retiros.map(async (r) => ({
      sobreId: r.sobreId,
      nombre: r.nombre,
      montoUsdCentavos: r.centavos,
      saldoCentavos: await saldoDeSobre(ejecutor, r.sobreId),
    })),
  );
}

type IngresoLeido = {
  id: number;
  montoCentavos: number;
  montoUsdCentavos: number;
  montoDestinoCentavos: number | null;
  sobreDestinoId: number;
  cuentaDestinoId: number | null;
};

/**
 * Lo que pasaría al borrar un ingreso, leído con el ejecutor dado: su reparto, el plan y la vista previa de cómo queda
 * todo, con lo que se retira del reparto posterior si hace falta (spec 007, criterio 11). La pantalla lo pide sin
 * candado; la acción, con `bloquear`, dentro de su transacción.
 */
async function alBorrarElIngreso(ejecutor: Ejecutor, i: IngresoLeido, captura: string | null, bloquear: boolean) {
  const { ids, reparto } = await repartoConSaldos(ejecutor, captura, i.sobreDestinoId);
  const [destino] = await ejecutor
    .select({ nombre: sobres.nombre })
    .from(sobres)
    .where(eq(sobres.id, i.sobreDestinoId));
  const entrada = {
    montoUsdCentavos: i.montoUsdCentavos,
    destino: {
      nombre: destino?.nombre ?? "Por asignar",
      saldoCentavos: await saldoDeSobre(ejecutor, i.sobreDestinoId),
    },
    reparto,
  };
  const retiro = await planDeRetiroDesde(ejecutor, faltaParaBorrar(entrada), i.sobreDestinoId, i.id, bloquear);
  if (!retiro.alcanza) {
    const error = noAlcanzaElRetiro(entrada.destino.nombre, entrada.destino.saldoCentavos, retiro);
    return { ids, reparto, plan: { ok: false, error } as PlanDeBorrado, previa: null, retiros: [] };
  }
  if (bloquear) await bloquearSobresDelRetiro(ejecutor, retiro.retiros);
  const plan = planDeBorradoDeIngreso({ ...entrada, retirado: await conSaldos(ejecutor, retiro.retiros) });
  if (!plan.ok) return { ids, reparto, plan, previa: null, retiros: [] };
  const cambios = cambiosPorSobre(
    { sobreId: i.sobreDestinoId, nombre: entrada.destino.nombre },
    i.montoUsdCentavos,
    reparto.map((r) => ({ sobreId: r.sobreId, nombre: r.nombre, centavos: r.montoUsdCentavos })),
    retiro.retiros,
  );
  const cuenta =
    i.cuentaDestinoId === null ? null : { id: i.cuentaDestinoId, centavos: i.montoDestinoCentavos ?? i.montoCentavos };
  const previa = await vistaPrevia(ejecutor, cuenta, cambios, retiro.retiros);
  return { ids, reparto, plan, previa, retiros: retiro.retiros };
}

/**
 * Lo que pasaría al borrar un ingreso, para la confirmación (criterio 7): el plan, su reparto con el nombre de cada
 * sobre y la vista previa. Sin candado: la acción vuelve a mirar y compara la firma.
 */
export async function vistaPreviaDeBorrado(
  m: MovimientoParaEditar,
): Promise<{ plan: PlanDeBorrado; reparto: RepartoGuardado[]; previa: VistaPrevia | null } | null> {
  const i = m.movimiento;
  if (i.tipo !== "ingreso" || i.sobreDestinoId === null) return null;
  const { plan, reparto, previa } = await alBorrarElIngreso(
    db,
    { ...i, sobreDestinoId: i.sobreDestinoId },
    m.captura,
    false,
  );
  return { plan, reparto, previa };
}

/**
 * Criterio 7: el ingreso y su reparto, con el candado de "Por asignar"; no lo deja en negativo. Si ya no tiene lo que
 * quedó sin repartir, retira lo que falta del reparto posterior, solo si es la misma vista previa que se vio y
 * confirmó (`firma`: filas, montos y saldos); si cambió, responde `cambio` para volver a mostrarla (spec 007,
 * criterio 11).
 */
export async function borrarIngreso(
  id: number,
  firma = "",
): Promise<PlanDeBorrado | { noExiste: true } | { cambio: true }> {
  return db.transaction(async (tx) => {
    const ingreso = await filaBloqueada(tx, id, "ingreso");
    if (!ingreso?.sobreDestinoId) return { noExiste: true as const };
    await tx.execute(sql`select pg_advisory_xact_lock(${claveReparto}, ${ingreso.sobreDestinoId})`);
    const captura = ingreso.origen === "manual" ? idDeReferencia(ingreso.referenciaExterna) : null;
    const { ids, plan, previa, retiros } = await alBorrarElIngreso(
      tx,
      { ...ingreso, sobreDestinoId: ingreso.sobreDestinoId },
      captura,
      true,
    );
    if (!plan.ok) return plan;
    if ((previa?.firma ?? "") !== firma) return { cambio: true as const };
    await aplicarRetiros(tx, retiros);
    if (ids.length > 0) await tx.delete(movimientos).where(inArray(movimientos.id, ids));
    await tx.delete(movimientos).where(eq(movimientos.id, ingreso.id));
    return plan;
  });
}
