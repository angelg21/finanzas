import { eq, or, sql } from "drizzle-orm";
// Imports relativos: lo cargan los scripts de la base, que se conectan con conexion-script y no con ./index.
import type { conectar } from "./conexion-script";
import { cuentas, movimientos, sobres } from "./schema";
import { efectoEnCuenta, efectoEnSobre } from "./sumas-de-saldo";

/*
  La foto de todos los saldos, para los scripts que cambian datos sin mover dinero (importar el historial, spec 012;
  dividir Inversión, spec 015): se toma antes y después dentro de la misma transacción y, si algún saldo cambió, el
  script lanza y no queda nada.
*/

type Base = ReturnType<typeof conectar>["db"];
export type EjecutorDeScript = Base | Parameters<Parameters<Base["transaction"]>[0]>[0];

/** Cada saldo de cuenta (en su moneda) y de sobre, con las mismas sumas que la app. */
export async function fotoDeSaldos(tx: EjecutorDeScript): Promise<Map<string, number>> {
  const deSobres = await tx
    .select({
      id: sobres.id,
      saldo: sql<number>`coalesce(sum(${efectoEnSobre(sobres.id)}), 0)::bigint`.mapWith(Number),
    })
    .from(sobres)
    .leftJoin(movimientos, or(eq(movimientos.sobreOrigenId, sobres.id), eq(movimientos.sobreDestinoId, sobres.id)))
    .groupBy(sobres.id);
  const deCuentas = await tx
    .select({
      id: cuentas.id,
      saldo: sql<number>`coalesce(sum(${efectoEnCuenta(cuentas.id)}), 0)::bigint`.mapWith(Number),
    })
    .from(cuentas)
    .leftJoin(movimientos, or(eq(movimientos.cuentaOrigenId, cuentas.id), eq(movimientos.cuentaDestinoId, cuentas.id)))
    .groupBy(cuentas.id);
  return new Map([
    ...deSobres.map((s) => [`sobre ${s.id}`, s.saldo] as const),
    ...deCuentas.map((c) => [`cuenta ${c.id}`, c.saldo] as const),
  ]);
}

/** Las claves cuyo saldo cambió entre dos fotos. Un sobre o una cuenta nuevos cuentan solo si no están en 0. */
export function saldosCambiados(antes: Map<string, number>, despues: Map<string, number>): string[] {
  return [...despues].filter(([clave, saldo]) => (antes.get(clave) ?? 0) !== saldo).map(([clave]) => clave);
}
