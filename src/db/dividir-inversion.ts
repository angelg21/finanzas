/**
 * Divide el sobre Inversión en "Inversión a largo plazo" y "Negocios" (spec 015). Primero muestra lo que va a hacer y
 * solo escribe al confirmarlo, en una transacción que compara todos los saldos antes y después: si alguno cambiara, no
 * queda nada. Correrlo otra vez no cambia nada: con un sobre de negocios ya creado, dice que ya está dividido.
 *   pnpm db:dividir-inversion              → la base local: muestra y pregunta (sin terminal, solo muestra)
 *   pnpm db:dividir-inversion --aplicar    → la base local, sin preguntar
 *   pnpm db:dividir-inversion:produccion   → producción: la cadena y la confirmación en la terminal
 */
import { and, eq, sql } from "drizzle-orm";
import { formatearCentavos } from "../lib/dinero";
import { type PlanDeDivision, notaLargoPlazo, planDeDivision } from "../lib/dividir-inversion";
import { formatearPorcentaje } from "../lib/reglas";
import { conectar, preguntar, terminarConError, urlLocal, urlProduccion } from "./conexion-script";
import { type EjecutorDeScript, fotoDeSaldos, saldosCambiados } from "./foto-de-saldos";
import { reglasReparto, sobres } from "./schema";

/** El candado de guardar las reglas (src/db/reglas.ts): una pestaña que guarda reglas a la vez espera. */
const claveReglas = 4;

type Base = ReturnType<typeof conectar>["db"];

async function estado(tx: EjecutorDeScript) {
  const [deSobres, deReglas] = await Promise.all([
    // Por id: de haber dos sobres de inversión, el plan toma siempre el primero que se creó (guardian-datos, 015).
    tx
      .select({ id: sobres.id, nombre: sobres.nombre, tipo: sobres.tipo, orden: sobres.orden })
      .from(sobres)
      .orderBy(sobres.id),
    tx
      .select({
        sobreId: reglasReparto.sobreId,
        tipo: reglasReparto.tipo,
        valor: reglasReparto.valor,
        orden: reglasReparto.orden,
        activa: reglasReparto.activa,
      })
      .from(reglasReparto),
  ]);
  return { sobres: deSobres, reglas: deReglas, plan: planDeDivision(deSobres, deReglas) };
}

/** Lo mismo que la vista previa, ahora con el candado y dentro de la transacción; si algo cambió, el plan nuevo. */
async function aplicar(db: Base): Promise<PlanDeDivision> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${claveReglas}, 0)`);
    const { plan } = await estado(tx);
    if (plan.estado !== "dividir") return plan;
    const antes = await fotoDeSaldos(tx);

    if (plan.renombrarA) {
      await tx
        .update(sobres)
        .set({ nombre: plan.renombrarA, nota: notaLargoPlazo })
        .where(eq(sobres.id, plan.inversionId));
    }
    const [negocios] = await tx.insert(sobres).values(plan.negocios).returning({ id: sobres.id });
    if (plan.regla) {
      await tx
        .update(reglasReparto)
        .set({ valor: plan.regla.largoPlazo })
        .where(and(eq(reglasReparto.sobreId, plan.inversionId), eq(reglasReparto.activa, true)));
      if (plan.regla.negocios !== null) {
        await tx.insert(reglasReparto).values({
          sobreId: negocios.id,
          tipo: plan.regla.tipo,
          valor: plan.regla.negocios,
          orden: plan.regla.orden,
        });
      }
      // Lo que reciben los dos juntos es lo de antes, ni un punto más ni uno menos (criterio 5).
      const despuesReglas = await tx
        .select({ valor: reglasReparto.valor })
        .from(reglasReparto)
        .where(
          and(sql`${reglasReparto.sobreId} in (${plan.inversionId}, ${negocios.id})`, eq(reglasReparto.activa, true)),
        );
      const suma = despuesReglas.reduce((a, r) => a + r.valor, 0);
      if (suma !== plan.regla.antes)
        throw new Error(`Las reglas sumarían ${suma} en vez de ${plan.regla.antes}: nada.`);
    }

    const cambiados = saldosCambiados(antes, await fotoDeSaldos(tx));
    if (cambiados.length > 0) {
      throw new Error(`Cambiarían ${cambiados.length} saldos (${cambiados.join(", ")}): no se dividió nada.`);
    }
    return plan;
  });
}

function valorDe(tipo: "fijo" | "porcentaje", valor: number) {
  return tipo === "porcentaje" ? formatearPorcentaje(valor) : `${formatearCentavos(valor, "USD")} al mes`;
}

/** La vista previa: qué cambia, en palabras. */
function mostrar(plan: PlanDeDivision, nombreActual: string | undefined) {
  if (plan.estado === "ya-dividido")
    return console.log("Ya está dividido: hay un sobre de negocios. No hay nada que hacer.");
  if (plan.estado === "sin-inversion") return console.log("No hay un sobre de inversión: no hay nada que dividir.");
  if (plan.estado === "nombre-ocupado") {
    return console.log(`Ya hay otro sobre llamado «${plan.nombre}»: cámbiale el nombre antes de dividir.`);
  }
  console.log("Dividir Inversión (spec 015):");
  console.log(
    plan.renombrarA
      ? `  · «${nombreActual}» pasa a llamarse «${plan.renombrarA}». Sigue intocable.`
      : `  · «${nombreActual}» conserva su nombre. Sigue intocable.`,
  );
  console.log(`  · Sobre nuevo «${plan.negocios.nombre}», libre, con saldo 0.`);
  if (!plan.regla) console.log("  · Inversión no tiene regla activa: Negocios queda sin regla.");
  else {
    const { tipo, antes, largoPlazo, negocios } = plan.regla;
    console.log(
      `  · Regla de reparto: ${valorDe(tipo, antes)} → largo plazo ${valorDe(tipo, largoPlazo)} y negocios ${
        negocios === null ? "sin regla" : valorDe(tipo, negocios)
      }.`,
    );
  }
  console.log("  · Ningún saldo cambia: el dinero que hay en Inversión se queda ahí.");
}

async function main() {
  const produccion = process.argv.includes("--produccion");
  const url = produccion ? await urlProduccion("dividir el sobre Inversión") : urlLocal("pnpm db:dividir-inversion");
  const { db, conexion } = conectar(url);
  try {
    const { sobres: lista, plan } = await estado(db);
    const nombreActual = plan.estado === "dividir" ? lista.find((s) => s.id === plan.inversionId)?.nombre : undefined;
    mostrar(plan, nombreActual);
    if (plan.estado !== "dividir") return;

    const sinPreguntar = process.argv.includes("--aplicar") && !produccion;
    if (!sinPreguntar && !process.stdin.isTTY) return console.log("Sin terminal solo se muestra: no se dividió nada.");
    if (!sinPreguntar && (await preguntar('Escribe "dividir" para aplicarlo: ')).trim() !== "dividir") {
      return console.log("Cancelado: no se dividió nada.");
    }
    const hecho = await aplicar(db);
    console.log(
      hecho.estado === "dividir"
        ? "Listo: Inversión dividida. Los saldos de todos los sobres y cuentas quedaron iguales."
        : "Otra corrida se adelantó: ya estaba dividido. No se cambió nada.",
    );
  } finally {
    await conexion.end();
  }
}

main().catch(terminarConError);
