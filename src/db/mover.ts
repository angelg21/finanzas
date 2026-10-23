import { and, eq, inArray, sql } from "drizzle-orm";
import { referenciaDeMover } from "../lib/captura";
import { db } from "./index";
import {
  claveReparto,
  esReferenciaRepetida,
  guardadasDeCaptura,
  registrarMovimientos,
  saldoDeSobre,
} from "./movimientos";
import { type Movimiento, type NuevoMovimiento, sobres } from "./schema";

type Resultado =
  { nueva: true } | { nueva: false; guardadas: Movimiento[] } | { sinSaldo: true; saldoCentavos: number };

/**
 * Mover entre sobres (spec 007, criterio 7): una reasignación con el candado del origen, el del reparto, y dentro se
 * vuelve a mirar su saldo; nunca lo deja en negativo. Un reintento se reconoce por la referencia de la captura antes
 * de mirar el saldo, como al apartar. Los dos sobres, activos y distintos.
 */
export async function moverEntreSobres(idCaptura: string, fila: NuevoMovimiento): Promise<Resultado> {
  const origen = fila.sobreOrigenId;
  const destino = fila.sobreDestinoId;
  const forma =
    fila.tipo === "reasignacion" &&
    origen != null &&
    destino != null &&
    origen !== destino &&
    fila.cuentaOrigenId == null &&
    fila.cuentaDestinoId == null &&
    fila.moneda === "USD" &&
    fila.montoCentavos === fila.montoUsdCentavos &&
    fila.referenciaExterna === referenciaDeMover(idCaptura, destino);
  if (!forma) throw new Error("Mover solo admite una reasignación entre dos sobres con la referencia de la captura");
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${claveReparto}, ${origen})`);
      const previas = await guardadasDeCaptura(idCaptura, tx);
      if (previas.length > 0) return { nueva: false as const, guardadas: previas };
      const activos = await tx
        .select({ id: sobres.id })
        .from(sobres)
        .where(and(inArray(sobres.id, [origen, destino]), eq(sobres.activo, true)));
      if (activos.length !== 2) throw new Error("Mover solo entre dos sobres activos");
      const saldo = await saldoDeSobre(tx, origen);
      if (fila.montoUsdCentavos > saldo) return { sinSaldo: true as const, saldoCentavos: saldo };
      await registrarMovimientos([fila], tx);
      return { nueva: true as const };
    });
  } catch (error) {
    if (!esReferenciaRepetida(error)) throw error;
    return { nueva: false, guardadas: await guardadasDeCaptura(idCaptura) };
  }
}
