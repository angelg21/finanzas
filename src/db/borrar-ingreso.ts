import { eq, inArray, sql } from "drizzle-orm";
import { idDeReferencia } from "../lib/captura";
import {
  type PlanDeBorrado,
  type RepartoGuardado,
  faltaParaBorrar,
  planDeBorradoDeIngreso,
} from "../lib/editar-ingreso";
import { type Retiro, type VistaPrevia, cambiosPorSobre, firmaDeRetiro, noAlcanzaElRetiro } from "../lib/retiro";
import { type MovimientoParaEditar, filaBloqueada, repartoConSaldos } from "./editar-movimientos";
import { db } from "./index";
import { type Ejecutor, claveReparto, saldoDeSobre } from "./movimientos";
import { aplicarRetiros, planDeRetiroDesde, vistaPrevia } from "./retiro";
import { movimientos, sobres } from "./schema";

/*
  Borrar un ingreso con su reparto (spec 006, criterio 7). Si el sobre que lo recibió ya no tiene lo que quedó sin
  repartir, se retira del reparto posterior (spec 007, criterio 11): se muestra antes y se aplica solo al confirmar
  esa misma vista previa. Vivía con la edición; tiene su propio archivo desde ese criterio.
*/

/** Lo que el plan necesita del sobre destino, del reparto propio y de lo que se retira, con el ejecutor dado. */
async function entradaDeBorrado(
  ejecutor: Ejecutor,
  ingreso: { id: number; montoUsdCentavos: number; sobreDestinoId: number },
  captura: string | null,
  bloquear: boolean,
) {
  const { ids, reparto } = await repartoConSaldos(ejecutor, captura, ingreso.sobreDestinoId);
  const [destino] = await ejecutor
    .select({ nombre: sobres.nombre })
    .from(sobres)
    .where(eq(sobres.id, ingreso.sobreDestinoId));
  const entrada = {
    montoUsdCentavos: ingreso.montoUsdCentavos,
    destino: {
      nombre: destino?.nombre ?? "Por asignar",
      saldoCentavos: await saldoDeSobre(ejecutor, ingreso.sobreDestinoId),
    },
    reparto,
  };
  // El reparto propio se va con el ingreso: no se cuenta como posterior.
  const retiro = await planDeRetiroDesde(
    ejecutor,
    faltaParaBorrar(entrada),
    ingreso.sobreDestinoId,
    ingreso.id,
    captura,
    bloquear,
  );
  return { ids, entrada, retiro };
}

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

/**
 * Lo que pasaría al borrar un ingreso, para la confirmación (criterio 7): el plan, su reparto con el nombre de cada
 * sobre y la vista previa de cómo queda todo, con lo que se retira si hace falta. Sin candado: la acción vuelve a
 * mirar y compara la firma.
 */
export async function vistaPreviaDeBorrado(
  m: MovimientoParaEditar,
): Promise<{ plan: PlanDeBorrado; reparto: RepartoGuardado[]; previa: VistaPrevia | null } | null> {
  const i = m.movimiento;
  if (i.tipo !== "ingreso" || i.sobreDestinoId === null) return null;
  const ingreso = { id: i.id, montoUsdCentavos: i.montoUsdCentavos, sobreDestinoId: i.sobreDestinoId };
  const { entrada, retiro } = await entradaDeBorrado(db, ingreso, m.captura, false);
  if (!retiro.alcanza) {
    const error = noAlcanzaElRetiro(entrada.destino.nombre, entrada.destino.saldoCentavos, retiro);
    return { plan: { ok: false, error }, reparto: entrada.reparto, previa: null };
  }
  const plan = planDeBorradoDeIngreso({ ...entrada, retirado: await conSaldos(db, retiro.retiros) });
  const cambios = cambiosPorSobre(
    { sobreId: i.sobreDestinoId, nombre: entrada.destino.nombre },
    i.montoUsdCentavos,
    entrada.reparto.map((r) => ({ sobreId: r.sobreId, nombre: r.nombre, centavos: r.montoUsdCentavos })),
    retiro.retiros,
  );
  const cuenta = i.cuentaDestinoId && { id: i.cuentaDestinoId, centavos: i.montoDestinoCentavos ?? i.montoCentavos };
  return { plan, reparto: entrada.reparto, previa: await vistaPrevia(cuenta || null, cambios, retiro.retiros) };
}

/**
 * Criterio 7: el ingreso y su reparto, con el candado de "Por asignar"; no lo deja en negativo. Si ya no tiene lo que
 * quedó sin repartir, retira lo que falta del reparto posterior, solo si es el mismo plan que se vio y confirmó
 * (`firma`); si cambió, responde `cambio` para volver a mostrarlo (spec 007, criterio 11).
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
    const { ids, entrada, retiro } = await entradaDeBorrado(
      tx,
      { id: ingreso.id, montoUsdCentavos: ingreso.montoUsdCentavos, sobreDestinoId: ingreso.sobreDestinoId },
      captura,
      true,
    );
    if (!retiro.alcanza) {
      return {
        ok: false as const,
        error: noAlcanzaElRetiro(entrada.destino.nombre, entrada.destino.saldoCentavos, retiro),
      };
    }
    if (firmaDeRetiro(retiro.retiros) !== firma) return { cambio: true as const };
    const plan = planDeBorradoDeIngreso({ ...entrada, retirado: await conSaldos(tx, retiro.retiros) });
    if (!plan.ok) return plan;
    await aplicarRetiros(tx, retiro.retiros);
    if (ids.length > 0) await tx.delete(movimientos).where(inArray(movimientos.id, ids));
    await tx.delete(movimientos).where(eq(movimientos.id, ingreso.id));
    return plan;
  });
}
