import { and, count, eq, sql } from "drizzle-orm";
import { puedeApartarDesde } from "../lib/apartado";
import { puedePrestarDesde } from "../lib/prestamos";
import { esIdCaptura, referenciaDeCaptura, referenciaDeReasignacion } from "../lib/captura";
import { type FilaDeuda, montoInicialMinimo } from "../lib/deudas";
import { formatearCifra } from "../lib/dinero";
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

/** Solo los campos de una deuda, uno por uno: lo que llegue de más (un creadoEn, un id) no se escribe (guardian, T13). */
function columnasDeDeuda(d: FilaDeuda, referencia: string) {
  const { sentido, persona, montoInicialCentavos, fechaPrevista, cuentaPrevistaId, nota } = d;
  return { sentido, persona, montoInicialCentavos, fechaPrevista, cuentaPrevistaId, nota, referencia };
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
    const [nueva] = await db.insert(deudas).values(columnasDeDeuda(fila, referencia)).returning({ id: deudas.id });
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

/**
 * Que el dinero salga de donde debe, o entre adonde debe: una cuenta activa en dólares, en su moneda, y un sobre activo
 * que cumpla `sobreValido` (guardian-datos, T5).
 */
async function exigirLado(
  tx: Ejecutor,
  fila: NuevoMovimiento,
  lado: "origen" | "destino",
  sobreValido: (tipo: string) => boolean,
) {
  const cuentaId = (lado === "origen" ? fila.cuentaOrigenId : fila.cuentaDestinoId) ?? 0;
  const sobreId = (lado === "origen" ? fila.sobreOrigenId : fila.sobreDestinoId) ?? 0;
  const [cuenta] = await tx
    .select({ moneda: cuentas.moneda, activa: cuentas.activa })
    .from(cuentas)
    .where(eq(cuentas.id, cuentaId));
  if (!cuenta?.activa || cuenta.moneda === "VES" || cuenta.moneda !== fila.moneda) {
    throw new Error("El movimiento usa una cuenta activa en dólares, en su moneda");
  }
  const [sobre] = await tx
    .select({ tipo: sobres.tipo, activo: sobres.activo })
    .from(sobres)
    .where(eq(sobres.id, sobreId));
  if (!sobre?.activo || !sobreValido(sobre.tipo))
    throw new Error("El movimiento usa un sobre activo que le corresponde");
}

type ResultadoMovimiento = { nueva: true } | { nueva: false; guardadas: Movimiento[] };
type ResultadoSaldo = ResultadoMovimiento | { noExiste: true } | { excede: true; pendienteCentavos: number };

/** Lo que distingue un pago de un cobro: su tipo, su referencia, el sentido de la deuda y por dónde pasa el dinero. */
const saldos = {
  pago: {
    tipo: "pago_deuda",
    sentido: "debo",
    lado: "origen",
    sobreValido: (tipo: string) => tipo === "deudas",
  },
  cobro: {
    tipo: "cobro_prestamo",
    sentido: "me_deben",
    lado: "destino",
    sobreValido: (tipo: string) => tipo === "por_asignar",
  },
} as const;

/**
 * Un pago o un cobro (criterios 3, 5 y 6): con el candado de la deuda, el reintento se reconoce primero y luego el
 * pendiente se vuelve a calcular; nunca se pasa de él. Solo a una deuda de su sentido, 1 a 1 y por la cuenta y el
 * sobre que le tocan. Si la deuda ya no existe o lo pendiente no alcanza, lo dice para el error del campo.
 */
async function saldar(idCaptura: string, fila: NuevoMovimiento, cual: keyof typeof saldos): Promise<ResultadoSaldo> {
  const regla = saldos[cual];
  const deudaId = fila.deudaId;
  const forma =
    fila.tipo === regla.tipo &&
    !!deudaId &&
    // En dólares, 1 a 1: la cuenta y la deuda cambian lo mismo (guardian-datos, T7).
    fila.montoCentavos === fila.montoUsdCentavos &&
    fila.referenciaExterna === referenciaDeCaptura(idCaptura, cual);
  if (!forma || !deudaId) {
    throw new Error(`Solo un ${regla.tipo} 1 a 1 con su deuda y la referencia de la captura`);
  }
  try {
    return await db.transaction(async (tx) => {
      await bloquearDeuda(tx, deudaId);
      const previas = await guardadasDeCaptura(idCaptura, tx);
      if (previas.length > 0) return { nueva: false as const, guardadas: previas };
      const deuda = await deudaPorId(deudaId, tx);
      if (!deuda) return { noExiste: true as const };
      if (deuda.sentido !== regla.sentido) throw new Error(`Un ${regla.tipo} solo va a una deuda "${regla.sentido}"`);
      if (fila.montoUsdCentavos > deuda.pendienteCentavos) {
        return { excede: true as const, pendienteCentavos: deuda.pendienteCentavos };
      }
      await exigirLado(tx, fila, regla.lado, regla.sobreValido);
      await registrarMovimientos([fila], tx);
      return { nueva: true as const };
    });
  } catch (error) {
    if (!esReferenciaRepetida(error)) throw error;
    return { nueva: false, guardadas: await guardadasDeCaptura(idCaptura) };
  }
}

/** Un pago de una deuda que debo: sale de una cuenta en dólares y del sobre Deudas activo. */
export async function pagarDeuda(idCaptura: string, fila: NuevoMovimiento) {
  return saldar(idCaptura, fila, "pago");
}

/** Un cobro de algo que me deben: entra a una cuenta en dólares y a "Por asignar" activo. */
export async function cobrarPrestamo(idCaptura: string, fila: NuevoMovimiento) {
  return saldar(idCaptura, fila, "cobro");
}

/**
 * Un préstamo (criterio 4): la deuda "me deben" en 0 y el movimiento que sale de la cuenta y el sobre, en una sola
 * transacción: los dos o ninguno. Un reintento se reconoce por las referencias de la captura antes de escribir; si dos
 * llegan a la vez, lo frena el índice único. Desde "Por asignar" toma el candado del reparto y no pasa de su saldo, como
 * apartar: si no, el mismo dinero se repartiría y se prestaría a la vez (guardian-datos, T13). Desde otro sobre, como
 * un gasto, lo puede dejar en negativo.
 */
export async function prestar(
  idCaptura: string,
  deuda: FilaDeuda,
  fila: NuevoMovimiento,
): Promise<
  | { nueva: true; deudaId: number }
  | { nueva: false; deuda: Deuda | null; guardadas: Movimiento[] }
  | { sinSaldo: true; saldoCentavos: number }
> {
  const origen = fila.sobreOrigenId;
  const forma =
    esIdCaptura(idCaptura) &&
    origen != null &&
    deuda.sentido === "me_deben" &&
    deuda.montoInicialCentavos === 0 &&
    deuda.cuentaPrevistaId === null &&
    fila.tipo === "prestamo" &&
    fila.deudaId == null &&
    fila.montoCentavos === fila.montoUsdCentavos &&
    fila.referenciaExterna === referenciaDeCaptura(idCaptura, "prestamo");
  if (!forma || origen == null) {
    throw new Error("Prestar solo admite una deuda me_deben en 0 y un préstamo 1 a 1 de esta captura");
  }
  const referencia = referenciaDeCaptura(idCaptura, "deuda");
  const loGuardado = async (ejecutor: Ejecutor) => {
    const [guardada] = await ejecutor.select().from(deudas).where(eq(deudas.referencia, referencia));
    return { nueva: false as const, deuda: guardada ?? null, guardadas: await guardadasDeCaptura(idCaptura, ejecutor) };
  };
  try {
    return await db.transaction(async (tx) => {
      const [deOrigen] = await tx.select({ tipo: sobres.tipo }).from(sobres).where(eq(sobres.id, origen));
      const desdePorAsignar = deOrigen?.tipo === "por_asignar";
      if (desdePorAsignar) await tx.execute(sql`select pg_advisory_xact_lock(${claveReparto}, ${origen})`);
      const previo = await loGuardado(tx);
      if (previo.deuda || previo.guardadas.length > 0) return previo;
      await exigirLado(tx, fila, "origen", puedePrestarDesde);
      if (desdePorAsignar) {
        const saldo = await saldoDeSobre(tx, origen);
        if (fila.montoUsdCentavos > saldo) return { sinSaldo: true as const, saldoCentavos: saldo };
      }
      const [nueva] = await tx.insert(deudas).values(columnasDeDeuda(deuda, referencia)).returning({ id: deudas.id });
      await registrarMovimientos([{ ...fila, deudaId: nueva.id }], tx);
      return { nueva: true as const, deudaId: nueva.id };
    });
  } catch (error) {
    if (!esDeudaRepetida(error) && !esReferenciaRepetida(error)) throw error;
    return loGuardado(db);
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

/**
 * Deshacer un pago o un cobro (spec 007, criterios 1 a 3): borra el movimiento con el candado de la deuda, que
 * serializa con pagar y cobrar. Un pago devuelve el dinero a su cuenta y a Deudas, siempre. Un cobro lo saca de la
 * cuenta y de "Por asignar": con su candado (el del reparto, tomado después del de la deuda, en el mismo orden que en
 * todas partes) y solo si "Por asignar" todavía lo tiene; si ya se repartió, lo dice.
 */
export async function deshacerPagoOCobro(
  id: number,
): Promise<{ ok: true; deudaId: number } | { ok: false; error: string } | { noExiste: true }> {
  if (!Number.isSafeInteger(id) || id <= 0 || id > 2_147_483_647) return { noExiste: true };
  return db.transaction(async (tx) => {
    const [visto] = await tx
      .select({ deudaId: movimientos.deudaId })
      .from(movimientos)
      .where(and(eq(movimientos.id, id), sql`${movimientos.tipo}::text in ('pago_deuda', 'cobro_prestamo')`));
    if (!visto?.deudaId) return { noExiste: true as const };
    await bloquearDeuda(tx, visto.deudaId);
    const [m] = await tx
      .select()
      .from(movimientos)
      .where(and(eq(movimientos.id, id), sql`${movimientos.tipo}::text in ('pago_deuda', 'cobro_prestamo')`))
      .for("update");
    if (!m?.deudaId) return { noExiste: true as const };
    if (m.tipo === "cobro_prestamo") {
      if (m.sobreDestinoId === null) throw new Error("Un cobro sin sobre destino");
      await tx.execute(sql`select pg_advisory_xact_lock(${claveReparto}, ${m.sobreDestinoId})`);
      const saldo = await saldoDeSobre(tx, m.sobreDestinoId);
      if (saldo < m.montoUsdCentavos) {
        const [sobre] = await tx.select({ nombre: sobres.nombre }).from(sobres).where(eq(sobres.id, m.sobreDestinoId));
        return {
          ok: false as const,
          error: `${sobre?.nombre ?? "Por asignar"} tiene ${formatearCifra(saldo)}; le faltan ${formatearCifra(m.montoUsdCentavos - saldo)}`,
        };
      }
    }
    await tx.delete(movimientos).where(eq(movimientos.id, m.id));
    return { ok: true as const, deudaId: m.deudaId };
  });
}
