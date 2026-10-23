import { eq, inArray, or, sql } from "drizzle-orm";
import { marcaDeMover } from "../lib/captura";
import {
  type Cambio,
  type Clase,
  type MovimientoDePorAsignar,
  type PlanDeRetiro,
  type Retiro,
  type SaldoQueQueda,
  type VistaPrevia,
  firmaDeVista,
  juntarPorSobre,
  planDeRetiro,
} from "../lib/retiro";
import { claveReparto, type Ejecutor, saldoDeSobre } from "./movimientos";
import { cuentas, movimientos, sobres } from "./schema";
import { efectoEnCuenta, efectoEnSobre } from "./sumas-de-saldo";

/*
  Retirar lo repartido (spec 007, criterio 11): leer la cuenta de lotes de "Por asignar", armar la vista previa con
  los saldos, y aplicarla. Las reglas viven en src/lib/retiro.ts; quien deshace toma antes el candado de "Por
  asignar", vuelve a calcular el plan y la vista previa dentro de su transacción y solo aplica si su firma es la que
  se confirmó.
*/

/** "captura-<id>-reasignacion-<sobre>": de una reasignación, el comienzo que comparte con el ingreso de su captura. */
const deUnaCaptura = /^(captura-.+)-reasignacion-\d+$/;

/**
 * Las filas que mueven dinero de "Por asignar", en orden de id, con su clase. Una salida es reparto (se puede retirar)
 * si es una reasignación que no es Mover ni el reparto propio de un ingreso (la reasignación cuya captura tiene un
 * ingreso), a un sobre activo y con su monto igual a su monto en dólares (guardian-datos, hallazgos 1 y 3).
 */
export async function movimientosDePorAsignar(
  ejecutor: Ejecutor,
  porAsignarId: number,
): Promise<MovimientoDePorAsignar[]> {
  const filas = await ejecutor
    .select({
      id: movimientos.id,
      tipo: movimientos.tipo,
      centavos: sql<number>`${efectoEnSobre(porAsignarId)}`.mapWith(Number),
      montoCentavos: movimientos.montoCentavos,
      montoUsdCentavos: movimientos.montoUsdCentavos,
      referencia: movimientos.referenciaExterna,
      sobreId: movimientos.sobreDestinoId,
      nombre: sobres.nombre,
      activo: sobres.activo,
    })
    .from(movimientos)
    .leftJoin(sobres, eq(sobres.id, movimientos.sobreDestinoId))
    .where(or(eq(movimientos.sobreOrigenId, porAsignarId), eq(movimientos.sobreDestinoId, porAsignarId)))
    .orderBy(movimientos.id);
  const ingresos = new Map<string, number>();
  for (const f of filas) if (f.tipo === "ingreso" && f.referencia) ingresos.set(f.referencia, f.id);
  return filas.flatMap((f): MovimientoDePorAsignar[] => {
    if (f.centavos === 0) return [];
    if (f.centavos > 0) {
      return [
        {
          id: f.id,
          centavos: f.centavos,
          clase: "entrada",
          sobreId: null,
          nombre: null,
          ingresoId: null,
        },
      ];
    }
    const referencia = f.referencia ?? "";
    const captura = deUnaCaptura.exec(referencia)?.[1];
    const ingresoId = captura ? (ingresos.get(`${captura}-ingreso`) ?? null) : null;
    let clase: Clase = "otra";
    if (f.tipo === "reasignacion") {
      if (referencia.includes(marcaDeMover)) clase = "mover";
      else if (ingresoId !== null) clase = "propio";
      else if (f.activo && f.montoCentavos === f.montoUsdCentavos) clase = "reparto";
    }
    return [
      {
        id: f.id,
        centavos: f.centavos,
        clase,
        sobreId: f.sobreId,
        nombre: f.nombre,
        ingresoId: clase === "propio" ? ingresoId : null,
      },
    ];
  });
}

/**
 * El plan de quitar el lote de un cobro o un ingreso, con el saldo del sobre que lo recibió. Solo hay lotes en "Por
 * asignar": en otro sobre no se retira nada, y quien deshace comprueba que alcance. Con \`bloquear\`, bloquea las filas
 * que retira y toma el candado de sus sobres.
 */
export async function planDeRetiroDesde(
  ejecutor: Ejecutor,
  lote: { id: number; sobreId: number },
  bloquear: boolean,
): Promise<{ plan: PlanDeRetiro; saldo: number }> {
  const saldo = await saldoDeSobre(ejecutor, lote.sobreId);
  const [destino] = await ejecutor.select({ tipo: sobres.tipo }).from(sobres).where(eq(sobres.id, lote.sobreId));
  if (destino?.tipo !== "por_asignar") return { plan: { alcanza: true, retiros: [] }, saldo };
  const plan = planDeRetiro(await movimientosDePorAsignar(ejecutor, lote.sobreId), lote.id, saldo);
  if (bloquear && plan.alcanza && plan.retiros.length > 0) {
    const ids = plan.retiros.map((r) => r.id);
    await ejecutor.select({ id: movimientos.id }).from(movimientos).where(inArray(movimientos.id, ids)).for("update");
    await bloquearSobresDelRetiro(ejecutor, plan.retiros);
  }
  return { plan, saldo };
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
