import { and, count, eq, sql } from "drizzle-orm";
import { puedeApartarDesde } from "../lib/apartado";
import { esIdCaptura, referenciaDeCaptura, referenciaDeReasignacion } from "../lib/captura";
import { type FilaDeuda, montoInicialMinimo } from "../lib/deudas";
import { deudaPorId } from "./deudas";
import { db } from "./index";
import {
  type Ejecutor,
  claveReparto,
  esReferenciaRepetida,
  guardadasDeCaptura,
  registrarMovimientos,
  saldoDeSobre,
} from "./movimientos";
import { type Deuda, type Movimiento, type NuevoMovimiento, cuentas, deudas, movimientos, sobres } from "./schema";

/*
  Escrituras de deudas (spec 005). Lo que cambia el pendiente de una deuda (pagar, editar, borrar) va en una
  transacción con pg_advisory_xact_lock(5, deudaId), y dentro se vuelve a calcular el pendiente (criterios 6 y 16):
  dos pestañas nunca pagan más de lo que se debe. Un reintento se reconoce tras el candado y antes de mirar el
  pendiente: si el primer pago saldó la deuda, compararlo después diría "no alcanza" de un pago que sí se guardó.
  Las filas llegan preparadas por src/lib. Aquí se comprueba lo que el check de forma no puede: que cada movimiento
  vaya a una deuda de su sentido, desde el sobre y la cuenta que le tocan (guardian-datos, T5).
*/

/** Espacio de los candados de deudas: el desglose usa 2, el reparto 3 y las reglas 4. */
const claveDeuda = 5;

async function bloquearDeuda(ejecutor: Ejecutor, deudaId: number) {
  await ejecutor.execute(sql`select pg_advisory_xact_lock(${claveDeuda}, ${deudaId})`);
}

/** El choque con el índice único de la referencia de deudas; drizzle envuelve el error de Postgres en `cause`. */
function esDeudaRepetida(error: unknown) {
  const deLaBase = (error as { cause?: { code?: string; constraint_name?: string } } | null)?.cause;
  return deLaBase?.code === "23505" && deLaBase.constraint_name === "deudas_referencia_unica";
}

/** La cuenta prevista, si la hay, es una cuenta activa en dólares (guardian-datos, T7). */
async function exigirCuentaPrevista(ejecutor: Ejecutor, cuentaPrevistaId: number | null) {
  if (cuentaPrevistaId === null) return;
  const [cuenta] = await ejecutor
    .select({ moneda: cuentas.moneda, activa: cuentas.activa })
    .from(cuentas)
    .where(eq(cuentas.id, cuentaPrevistaId));
  if (!cuenta?.activa || cuenta.moneda === "VES") throw new Error("La cuenta prevista es una cuenta activa en dólares");
}

/**
 * Registra una deuda que ya existía (criterio 1): no crea movimientos ni cambia saldos. Si su referencia ya estaba,
 * devuelve la guardada para que la acción compare antes de decir "ya estaba" (criterio 7).
 */
export async function registrarDeuda(
  idCaptura: string,
  fila: FilaDeuda,
): Promise<{ nueva: true; id: number } | { nueva: false; guardada: Deuda }> {
  if (!esIdCaptura(idCaptura)) throw new RangeError("Id de captura inválido");
  await exigirCuentaPrevista(db, fila.sentido === "debo" ? fila.cuentaPrevistaId : null);
  const referencia = referenciaDeCaptura(idCaptura, "deuda");
  try {
    const [nueva] = await db
      .insert(deudas)
      .values({ ...fila, referencia })
      .returning({ id: deudas.id });
    return { nueva: true, id: nueva.id };
  } catch (error) {
    if (!esDeudaRepetida(error)) throw error;
    const [guardada] = await db.select().from(deudas).where(eq(deudas.referencia, referencia));
    if (!guardada) throw error;
    return { nueva: false, guardada };
  }
}

/**
 * Corrige persona, fecha, cuenta prevista, nota y monto inicial (criterio 16). Solo esos campos, uno por uno: el
 * sentido y la referencia nunca cambian aunque lleguen (guardian-datos, T7), y en "me deben" la cuenta prevista queda
 * vacía. Con el candado, el monto inicial se vuelve a comparar con lo ya movido: un pago que
 * llegó entre leer y guardar no deja el pendiente en negativo.
 */
export async function editarDeuda(
  id: number,
  cambios: Omit<FilaDeuda, "sentido">,
): Promise<{ ok: true } | { noExiste: true } | { minimoCentavos: number }> {
  return db.transaction(async (tx) => {
    await bloquearDeuda(tx, id);
    const actual = await deudaPorId(id, tx);
    if (!actual) return { noExiste: true as const };
    const minimoCentavos = montoInicialMinimo(actual);
    if (cambios.montoInicialCentavos < minimoCentavos) return { minimoCentavos };
    const cuentaPrevistaId = actual.sentido === "debo" ? cambios.cuentaPrevistaId : null;
    await exigirCuentaPrevista(tx, cuentaPrevistaId);
    const { persona, montoInicialCentavos, fechaPrevista, nota } = cambios;
    await tx
      .update(deudas)
      .set({ persona, montoInicialCentavos, fechaPrevista, cuentaPrevistaId, nota })
      .where(eq(deudas.id, id));
    return { ok: true as const };
  });
}

/** Borra una deuda sin movimientos (criterio 16). Con el candado: un pago en curso no queda apuntando a nada. */
export async function borrarDeuda(id: number): Promise<{ ok: true } | { noExiste: true } | { conMovimientos: true }> {
  return db.transaction(async (tx) => {
    await bloquearDeuda(tx, id);
    const [{ cantidad }] = await tx.select({ cantidad: count() }).from(movimientos).where(eq(movimientos.deudaId, id));
    if (cantidad > 0) return { conMovimientos: true as const };
    const borradas = await tx.delete(deudas).where(eq(deudas.id, id)).returning({ id: deudas.id });
    return borradas.length > 0 ? { ok: true as const } : { noExiste: true as const };
  });
}

/** Que el dinero salga de donde debe: una cuenta activa en dólares, en su moneda, y un sobre activo del tipo dado. */
async function exigirOrigen(tx: Ejecutor, fila: NuevoMovimiento, tipoSobre: "deudas" | null) {
  const [cuenta] = await tx
    .select({ moneda: cuentas.moneda, activa: cuentas.activa })
    .from(cuentas)
    .where(eq(cuentas.id, fila.cuentaOrigenId ?? 0));
  if (!cuenta?.activa || cuenta.moneda === "VES" || cuenta.moneda !== fila.moneda) {
    throw new Error("El movimiento sale de una cuenta activa en dólares, en su moneda");
  }
  const [sobre] = await tx
    .select({ tipo: sobres.tipo, activo: sobres.activo })
    .from(sobres)
    .where(eq(sobres.id, fila.sobreOrigenId ?? 0));
  if (!sobre?.activo || (tipoSobre !== null && sobre.tipo !== tipoSobre)) {
    throw new Error("El movimiento sale de un sobre activo que le corresponde");
  }
}

type ResultadoMovimiento = { nueva: true } | { nueva: false; guardadas: Movimiento[] };

/**
 * Un pago de una deuda que debo (criterios 3 y 6): sale de una cuenta activa en dólares y del sobre Deudas activo, y
 * nunca pasa del pendiente, que se vuelve a calcular con el candado. Si la deuda ya no existe o lo pendiente no
 * alcanza, lo dice para que la acción ponga el error en su campo.
 */
export async function pagarDeuda(
  idCaptura: string,
  fila: NuevoMovimiento,
): Promise<ResultadoMovimiento | { noExiste: true } | { excede: true; pendienteCentavos: number }> {
  const deudaId = fila.deudaId;
  const forma =
    fila.tipo === "pago_deuda" &&
    !!deudaId &&
    // En dólares, 1 a 1: la cuenta y la deuda bajan lo mismo (guardian-datos, T7).
    fila.montoCentavos === fila.montoUsdCentavos &&
    fila.referenciaExterna === referenciaDeCaptura(idCaptura, "pago");
  if (!forma || !deudaId) {
    throw new Error("Pagar solo admite un pago_deuda 1 a 1 con su deuda y la referencia de la captura");
  }
  try {
    return await db.transaction(async (tx) => {
      await bloquearDeuda(tx, deudaId);
      const previas = await guardadasDeCaptura(idCaptura, tx);
      if (previas.length > 0) return { nueva: false as const, guardadas: previas };
      const deuda = await deudaPorId(deudaId, tx);
      if (!deuda) return { noExiste: true as const };
      if (deuda.sentido !== "debo") throw new Error("Un pago solo va a una deuda que debo");
      if (fila.montoUsdCentavos > deuda.pendienteCentavos) {
        return { excede: true as const, pendienteCentavos: deuda.pendienteCentavos };
      }
      await exigirOrigen(tx, fila, "deudas");
      await registrarMovimientos([fila], tx);
      return { nueva: true as const };
    });
  } catch (error) {
    if (!esReferenciaRepetida(error)) throw error;
    return { nueva: false, guardadas: await guardadasDeCaptura(idCaptura) };
  }
}

/**
 * Aparta lo que ya se tiene (criterio 13): una reasignación de un sobre a Deudas. Con el candado del reparto sobre el
 * origen, así apartar desde "Por asignar" y repartir no se pisan; dentro se vuelve a comprobar su saldo. Nunca desde
 * Deudas ni desde Inversión, y nunca hacia un sobre que no sea Deudas activo.
 */
export async function apartarADeudas(
  idCaptura: string,
  fila: NuevoMovimiento,
): Promise<ResultadoMovimiento | { sinSaldo: true; saldoCentavos: number }> {
  const origen = fila.sobreOrigenId;
  const destino = fila.sobreDestinoId;
  const forma =
    fila.tipo === "reasignacion" &&
    origen != null &&
    destino != null &&
    origen !== destino &&
    fila.moneda === "USD" &&
    fila.montoCentavos === fila.montoUsdCentavos &&
    fila.referenciaExterna === referenciaDeReasignacion(idCaptura, destino);
  if (!forma) throw new Error("Apartar solo admite una reasignación hacia Deudas con la referencia de la captura");
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${claveReparto}, ${origen})`);
      const previas = await guardadasDeCaptura(idCaptura, tx);
      if (previas.length > 0) return { nueva: false as const, guardadas: previas };
      const [deOrigen] = await tx
        .select({ tipo: sobres.tipo })
        .from(sobres)
        .where(and(eq(sobres.id, origen), eq(sobres.activo, true)));
      const [aDeudas] = await tx
        .select({ id: sobres.id })
        .from(sobres)
        .where(and(eq(sobres.id, destino), eq(sobres.activo, true), eq(sobres.tipo, "deudas")));
      if (!deOrigen || !puedeApartarDesde(deOrigen.tipo) || !aDeudas) {
        throw new Error("Apartar solo desde un sobre activo que no sea Deudas ni Inversión, y hacia Deudas activo");
      }
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
