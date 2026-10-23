import { and, desc, eq, gte, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { marcaDeMover } from "@/lib/captura";
import { cuotaDeDeudas, proximoVencimiento, reglaDeDeudas } from "@/lib/cuota-deudas";
import { hoyEnCaracas } from "@/lib/fechas";
import type { ReglaParaRepartir } from "@/lib/reparto";
import type { NivelDeSobre } from "@/lib/sobres";
import { deudasConPendiente, sobreDeudas } from "./deudas";
import { db } from "./index";
import { sobresConNivel } from "./sobres";
import { categorias, cuentas, movimientos, reglasReparto, sobres } from "./schema";

/*
  Lecturas del ingreso y su reparto (spec 004). La propuesta se calcula en src/lib/reparto.ts con lo que sale de
  aquí; la misma función corre en el servidor y en el cliente, así que el cliente recibe estos datos tal cual. La
  regla de Deudas no está en la base: se calcula aquí y llega como una fija más (spec 005).
*/

/**
 * "Por asignar" por su tipo: no hay índice único, la semilla crea uno; si hubiera dos, el de menor orden. Aunque esté
 * inactivo, para que la página diga por qué no deja guardar. null si no existe.
 */
export async function sobrePorAsignar() {
  const [sobre] = await db
    .select({ id: sobres.id, nombre: sobres.nombre, activo: sobres.activo })
    .from(sobres)
    .where(eq(sobres.tipo, "por_asignar"))
    .orderBy(sobres.orden, sobres.id)
    .limit(1);
  return sobre ?? null;
}

/**
 * Las reglas activas de sobres activos, sin "Por asignar" ni Deudas, ordenadas como las atiende el reparto entre
 * iguales. La de Deudas no se guarda: se calcula (cuotaDelMes); una fila que apuntara a él contaría dos veces.
 */
export async function reglasActivas() {
  return db
    .select({
      sobreId: reglasReparto.sobreId,
      orden: reglasReparto.orden,
      tipo: reglasReparto.tipo,
      valor: reglasReparto.valor,
      topeCentavos: sobres.topeCentavos,
    })
    .from(reglasReparto)
    .innerJoin(sobres, eq(reglasReparto.sobreId, sobres.id))
    .where(
      and(
        eq(reglasReparto.activa, true),
        eq(sobres.activo, true),
        ne(sobres.tipo, "por_asignar"),
        ne(sobres.tipo, "deudas"),
      ),
    )
    .orderBy(reglasReparto.orden, reglasReparto.sobreId);
}

const sobreOrigen = alias(sobres, "sobre_origen");

/**
 * Una reasignación desde "Por asignar" que es reparto (el de un ingreso, Repartir o Apartar), no Mover: Mover no cuenta
 * (spec 007, criterio 10, decidido por el desarrollador). Las de Mover llevan su marca en la referencia.
 */
const esRepartoDesdePorAsignar = sql`(${eq(movimientos.tipo, "reasignacion")} and ${sobreOrigen.tipo}::text = 'por_asignar' and coalesce(${movimientos.referenciaExterna}, '') not like ${`%${marcaDeMover}%`})`;

/**
 * Lo que el reparto le dio a cada sobre desde "Por asignar" en un mes ("AAAA-MM" de la fecha de la reasignación): un
 * fijo pide su valor menos esto (criterio 2), y Deudas, su cuota menos esto. Solo el reparto: lo que se mueve a mano
 * con Mover, también hacia o desde "Por asignar", no cuenta (spec 007, criterio 10). Así ir y volver no cambia nada, y
 * devolver a "Por asignar" no hace que el fijo pida otra vez. Todos los meses, porque el ingreso puede llevar cualquier
 * fecha pasada y el cliente recalcula la propuesta al cambiarla; son pocas filas, una por sobre y mes con reparto.
 */
export async function recibidoDesdePorAsignarPorMes(): Promise<Record<string, Record<number, number>>> {
  const filas = await db
    .select({
      mes: sql<string>`to_char(${movimientos.fecha}, 'YYYY-MM')`,
      sobreId: movimientos.sobreDestinoId,
      centavos: sql<number>`sum(${movimientos.montoUsdCentavos})::bigint`.mapWith(Number),
    })
    .from(movimientos)
    .innerJoin(sobreOrigen, eq(movimientos.sobreOrigenId, sobreOrigen.id))
    .where(esRepartoDesdePorAsignar)
    .groupBy(sql`1`, movimientos.sobreDestinoId);

  const porMes: Record<string, Record<number, number>> = {};
  for (const f of filas) {
    if (f.sobreId === null) continue;
    porMes[f.mes] = { ...porMes[f.mes], [f.sobreId]: f.centavos };
  }
  return porMes;
}

/** Categorías de ingreso activas, las más usadas en los últimos 90 días primero, como las de gasto. */
export async function categoriasDeIngresoPorUso() {
  const usos = sql<number>`count(${movimientos.id})::int`.mapWith(Number);
  return db
    .select({ id: categorias.id, nombre: categorias.nombre, icono: categorias.icono, color: categorias.color, usos })
    .from(categorias)
    .leftJoin(
      movimientos,
      and(
        eq(movimientos.categoriaId, categorias.id),
        eq(movimientos.tipo, "ingreso"),
        gte(movimientos.fecha, sql`current_date - 90`),
      ),
    )
    .where(and(eq(categorias.tipo, "ingreso"), eq(categorias.activa, true)))
    .groupBy(categorias.id)
    .orderBy(desc(usos), categorias.orden, categorias.id);
}

/** La cuenta del último ingreso registrado, si sigue activa y en dólares; null si no hay ninguno. */
export async function cuentaDelUltimoIngreso(): Promise<number | null> {
  const [ultima] = await db
    .select({ id: cuentas.id })
    .from(movimientos)
    .innerJoin(cuentas, eq(movimientos.cuentaDestinoId, cuentas.id))
    .where(and(eq(movimientos.tipo, "ingreso"), eq(cuentas.activa, true), ne(cuentas.moneda, "VES")))
    .orderBy(desc(movimientos.id))
    .limit(1);
  return ultima?.id ?? null;
}

/**
 * La cuota de Deudas de este mes (spec 005, criterios 11 y 12), con su sobre y el vencimiento más cercano. null sin
 * sobre Deudas activo, o si una deuda trae datos rotos: entonces se reparte sin Deudas en vez de impedir guardar el
 * ingreso (guardian-datos, T6); /deudas sí lo dice.
 */
export async function cuotaDelMes() {
  const [sobre, deudas] = await Promise.all([sobreDeudas(), deudasConPendiente().catch(() => null)]);
  if (!sobre?.activo || !deudas) return null;
  const hoy = hoyEnCaracas(new Date());
  // Lo apartado al empezar el mes: así la cuota no cambia dentro del mes, aunque lleguen pagos o cobros.
  const apartado = sobre.saldoCentavos - sobre.recibidoEnElMesCentavos;
  return {
    sobreId: sobre.id,
    cuotaCentavos: cuotaDeDeudas({ deudas, apartado, hoy }),
    vencimiento: proximoVencimiento(deudas),
    hoy,
  };
}

/** Una regla con lo que la pantalla muestra de su sobre: nombre, saldo, tipo y nivel para su icono. */
export type ReglaConSobre = ReglaParaRepartir & {
  nombre: string;
  saldoCentavos: number;
  tipoSobre: string;
  nivel: NivelDeSobre;
  /** Solo la de Deudas: para su pista, "cuota · faltan 385 este mes · vence 22 oct". */
  cuota?: { vencimiento: string | null; hoy: string };
};

/**
 * Todo lo que necesita la propuesta, en paralelo: "Por asignar" con su saldo, las reglas con el saldo de su sobre
 * (para los topes), los sobres que pueden recibir reparto y lo recibido por mes. Lo usan las páginas y las acciones.
 */
export async function datosDelReparto() {
  const [porAsignar, guardadas, saldos, recibidoPorMes, cuota] = await Promise.all([
    sobrePorAsignar(),
    reglasActivas(),
    sobresConNivel(),
    recibidoDesdePorAsignarPorMes(),
    cuotaDelMes(),
  ]);
  // Deudas, como una fija más antes que todas; con cuota 0 no tiene fila (spec 005, criterio 12).
  const deDeudas = cuota && reglaDeDeudas(cuota.sobreId, cuota.cuotaCentavos, guardadas);
  const reglas = deDeudas ? [deDeudas, ...guardadas] : guardadas;
  const saldoDe = new Map(saldos.map((s) => [s.id, s.saldoCentavos]));
  const sobreDe = new Map(saldos.map((s) => [s.id, s]));
  return {
    porAsignar: porAsignar && { ...porAsignar, saldoCentavos: saldoDe.get(porAsignar.id) ?? 0 },
    reglas: reglas.map((r): ReglaConSobre => {
      const sobre = sobreDe.get(r.sobreId);
      return {
        ...r,
        nombre: sobre?.nombre ?? "",
        saldoCentavos: sobre?.saldoCentavos ?? 0,
        tipoSobre: sobre?.tipo ?? "",
        nivel: sobre?.nivel ?? { porcentaje: null, alcanzado: false, negativo: false },
        ...(r === deDeudas && cuota ? { cuota: { vencimiento: cuota.vencimiento, hoy: cuota.hoy } } : {}),
      };
    }),
    /** Activos y sin "Por asignar": los únicos que pueden recibir una reasignación desde él. */
    sobres: saldos.filter((s) => s.tipo !== "por_asignar" && s.id !== porAsignar?.id),
    recibidoPorMes,
  };
}

export type DatosDelReparto = Awaited<ReturnType<typeof datosDelReparto>>;
