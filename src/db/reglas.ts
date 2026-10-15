import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { type ReglaValidada, reglaEditable } from "@/lib/reglas";
import { db } from "./index";
import { reglasReparto, sobres } from "./schema";

/*
  Las reglas de reparto en /sobres/reglas (spec 004, criterio 11). Cambiar una regla solo cambia las propuestas
  siguientes: ningún movimiento guarda de qué regla salió.
*/

/** Cada sobre activo menos "Por asignar", en su orden, con su regla si la tiene (activa o no) y su tope. */
export async function reglasPorSobre() {
  return db
    .select({
      sobreId: sobres.id,
      nombre: sobres.nombre,
      tipoSobre: sobres.tipo,
      topeCentavos: sobres.topeCentavos,
      regla: { tipo: reglasReparto.tipo, valor: reglasReparto.valor, activa: reglasReparto.activa },
    })
    .from(sobres)
    .leftJoin(reglasReparto, eq(reglasReparto.sobreId, sobres.id))
    .where(and(eq(sobres.activo, true), ne(sobres.tipo, "por_asignar")))
    .orderBy(sobres.orden, sobres.id);
}

/** Espacio del candado de las reglas: dos pestañas que guardan a la vez van una tras otra. */
const claveReglas = 4;

/**
 * Guarda las reglas y el tope de Emergencia en una transacción: cambian todas juntas o ninguna. Los sobres editables
 * se leen aquí dentro, no se aceptan de fuera (guardian-datos, T5): los activos menos "Por asignar" y los fondos, cuya
 * regla escribe su desglose (src/db/fondos.ts) y que nunca se desactivan desde aquí. Un sobre editable sin regla
 * validada queda sin regla: la fila se desactiva, no se borra. Una regla nueva va al final del orden.
 */
export async function guardarReglas(reglas: ReglaValidada[], topeCentavos: number | null) {
  if (topeCentavos !== null && (!Number.isSafeInteger(topeCentavos) || topeCentavos <= 0)) {
    throw new RangeError(`Tope inválido: ${topeCentavos}`);
  }
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${claveReglas}, 0)`);
    const activos = await tx.select({ id: sobres.id, tipo: sobres.tipo }).from(sobres).where(eq(sobres.activo, true));
    const editables = activos.filter((s) => reglaEditable(s.tipo)).map((s) => s.id);
    if (reglas.some((r) => !editables.includes(r.sobreId))) throw new Error("Regla para un sobre que no es editable");

    const existentes = await tx
      .select({ sobreId: reglasReparto.sobreId })
      .from(reglasReparto)
      .where(inArray(reglasReparto.sobreId, editables.length > 0 ? editables : [-1]));
    const conFila = new Set(existentes.map((e) => e.sobreId));
    const [{ maximo }] = await tx
      .select({ maximo: sql<number>`coalesce(max(${reglasReparto.orden}), 0)`.mapWith(Number) })
      .from(reglasReparto);
    let orden = maximo;

    for (const r of reglas) {
      if (conFila.has(r.sobreId)) {
        // Tipo y valor en la misma sentencia: el check del porcentaje máximo no se difiere.
        await tx
          .update(reglasReparto)
          .set({ tipo: r.tipo, valor: r.valor, activa: true })
          .where(eq(reglasReparto.sobreId, r.sobreId));
      } else {
        await tx.insert(reglasReparto).values({ sobreId: r.sobreId, tipo: r.tipo, valor: r.valor, orden: ++orden });
      }
    }
    const sinRegla = editables.filter((id) => !reglas.some((r) => r.sobreId === id));
    if (sinRegla.length > 0) {
      await tx.update(reglasReparto).set({ activa: false }).where(inArray(reglasReparto.sobreId, sinRegla));
    }
    if (topeCentavos !== null) {
      const tocados = await tx
        .update(sobres)
        .set({ topeCentavos })
        .where(and(eq(sobres.tipo, "emergencia"), eq(sobres.activo, true)))
        .returning({ id: sobres.id });
      if (tocados.length !== 1)
        throw new Error(`El tope es de un solo sobre de emergencia activo: hay ${tocados.length}`);
    }
  });
}
