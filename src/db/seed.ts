/**
 * Datos iniciales según docs/plan-financiero-y-app.md.
 * Es idempotente: se puede correr varias veces, no duplica nada.
 *   pnpm db:seed              → la base local; se niega si .env.local apunta a otra
 *   pnpm db:seed:produccion   → producción, una sola vez, pegando la cadena en la terminal y confirmando
 */
import { and, eq } from "drizzle-orm";
import { categoriasBase, colorPorDefecto, iconoPorDefecto } from "../lib/categorias";
import { nombreLargoPlazo, notaLargoPlazo, sobreNegocios } from "../lib/dividir-inversion";
import { conectar, terminarConError, urlLocal, urlProduccion } from "./conexion-script";
import * as schema from "./schema";

async function main() {
  const url = process.argv.includes("--produccion") ? await urlProduccion("sembrar") : urlLocal("pnpm db:seed");
  const { db, conexion } = conectar(url);

  // Cuentas: sección 4, "Cuentas y monedas".
  await db
    .insert(schema.cuentas)
    .values([
      // Sin segunda billetera hasta que exista una de verdad (observación 2, decidido el 2026-10-16).
      { nombre: "Binance", moneda: "USDT", tipo: "exchange", orden: 1, nota: "Principal." },
      { nombre: "Efectivo", moneda: "USD", tipo: "efectivo", orden: 3, nota: "Parte pequeña del fondo de emergencia." },
      {
        nombre: "Cuenta prima",
        moneda: "USD",
        tipo: "transito",
        esPropia: false,
        orden: 4,
        nota: "A nombre de mi prima. El dinero es mío y entra al cuadre con los sobres (ADR 0006).",
      },
      { nombre: "Bolívares", moneda: "VES", tipo: "banco", orden: 5, nota: "De paso. Casi siempre en cero." },
    ])
    .onConflictDoNothing();

  // Sobres: sección 2, "Los sobres". "Por asignar" es donde cae cada ingreso antes del reparto. Se reconocen por su tipo,
  // no por su nombre (spec 015): uno renombrado no se vuelve a crear, y los tipos base son únicos. Negocios nace de
  // dividir Inversión: en una base que ya tiene Inversión lo crea `pnpm db:dividir-inversion`, que también parte su
  // regla; si lo creara la semilla, el reparto pasaría del 100 %.
  const sobresBase: (typeof schema.sobres.$inferInsert)[] = [
    {
      nombre: "Por asignar",
      tipo: "por_asignar",
      orden: 0,
      nota: "Donde cae cada ingreso antes del reparto. Debe quedar en cero.",
    },
    {
      nombre: "Gastos del mes",
      tipo: "gastos",
      orden: 1,
      nota: "Todo el consumo, ocio incluido. Los bolívares siempre pertenecen a este sobre.",
    },
    { nombre: "Familia", tipo: "familia", orden: 2 },
    {
      nombre: "Emergencia",
      tipo: "emergencia",
      topeCentavos: 270_000,
      orden: 3,
      nota: "6 meses de gastos. Solo salud, pérdida de ingreso o emergencia familiar.",
    },
    {
      nombre: "Planes",
      tipo: "meta",
      orden: 4,
      nota: "Viajes, teléfono, ropa y compras grandes. Dividir en un sobre por meta cuando tenga monto y fecha.",
    },
    {
      nombre: "Ocasiones",
      tipo: "fondo",
      orden: 5,
      nota: "Regalos, cumpleaños, aniversarios, Navidad. Se alimenta cada mes con un aporte fijo calculado del desglose anual; lo que sobra se acumula.",
    },
    // Spec 005: después de Ocasiones (mismo orden, id mayor). Sin regla: su cuota se calcula en cada reparto.
    {
      nombre: "Deudas",
      tipo: "deudas",
      orden: 5,
      nota: "Lo apartado para pagar lo que debo. Recibe su cuota en cada reparto, antes que los demás.",
    },
    { nombre: nombreLargoPlazo, tipo: "inversion", orden: 6, nota: notaLargoPlazo },
    { ...sobreNegocios, orden: 6 },
  ];
  const presentes = new Set((await db.select({ tipo: schema.sobres.tipo }).from(schema.sobres)).map((s) => s.tipo));
  const faltan = sobresBase.filter(
    (s) => !presentes.has(s.tipo) && !(s.tipo === "negocios" && presentes.has("inversion")),
  );
  if (faltan.length > 0) await db.insert(schema.sobres).values(faltan).onConflictDoNothing();
  const negociosNuevo = faltan.some((s) => s.tipo === "negocios");

  // Categorías base, con icono y color (src/lib/categorias.ts). Solo se insertan en una base sin categorías:
  // si no, la semilla reviviría las que el usuario renombró o borró. En una base que ya las tiene solo les
  // pone icono y color, y solo a las que siguen con los dos valores por defecto: nunca pisa una elección.
  const { categorias } = schema;
  if ((await db.$count(categorias)) === 0) {
    await db.insert(categorias).values(
      categoriasBase.map((c) => ({
        ...c,
        orden: categoriasBase.filter((o) => o.tipo === c.tipo).indexOf(c) + 1,
      })),
    );
  } else {
    for (const c of categoriasBase) {
      await db
        .update(categorias)
        .set({ icono: c.icono, color: c.color })
        .where(
          and(
            eq(categorias.nombre, c.nombre),
            eq(categorias.tipo, c.tipo),
            eq(categorias.icono, iconoPorDefecto),
            eq(categorias.color, colorPorDefecto),
          ),
        );
    }
  }

  // Reglas de reparto: sección 2, columna "Con 1.200 $". Fijos primero, porcentajes sobre lo que queda.
  // Idempotente por sobre: si la regla ya existe, no se toca. Cada sobre base se busca por su tipo (spec 015); de
  // varios del mismo tipo (metas), el primero que se creó.
  const sobres = await db
    .select({ id: schema.sobres.id, tipo: schema.sobres.tipo })
    .from(schema.sobres)
    .orderBy(schema.sobres.id);
  const idDe = (tipo: (typeof schema.sobres.$inferSelect)["tipo"]) => {
    const s = sobres.find((x) => x.tipo === tipo);
    if (!s) throw new Error(`No existe un sobre de tipo ${tipo}`);
    return s.id;
  };
  await db
    .insert(schema.reglasReparto)
    .values([
      { orden: 1, sobreId: idDe("gastos"), tipo: "fijo", valor: 45_000 },
      { orden: 2, sobreId: idDe("familia"), tipo: "fijo", valor: 10_000 },
      // Fondo de reserva: 25 USD al mes como punto de partida; se recalcula desde el desglose del sobre.
      { orden: 3, sobreId: idDe("fondo"), tipo: "fijo", valor: 2_500 },
      { orden: 4, sobreId: idDe("emergencia"), tipo: "porcentaje", valor: 4_000 },
      { orden: 5, sobreId: idDe("meta"), tipo: "porcentaje", valor: 3_000 },
      // El 30 % de Inversión partido 2/3 y 1/3 (spec 015). Negocios solo recibe regla si la semilla lo acaba de crear:
      // en una base dividida por el script, la suya ya la puso el script, o el desarrollador la quitó.
      { orden: 6, sobreId: idDe("inversion"), tipo: "porcentaje", valor: 2_000 },
      ...(negociosNuevo ? [{ orden: 6, sobreId: idDe("negocios"), tipo: "porcentaje" as const, valor: 1_000 }] : []),
    ])
    .onConflictDoNothing();

  const [c, s, k, r] = await Promise.all([
    db.$count(schema.cuentas),
    db.$count(schema.sobres),
    db.$count(schema.categorias),
    db.$count(schema.reglasReparto, eq(schema.reglasReparto.activa, true)),
  ]);
  console.log(`Semillas listas: ${c} cuentas, ${s} sobres, ${k} categorías, ${r} reglas de reparto.`);
  await conexion.end();
}

main().catch(terminarConError);
