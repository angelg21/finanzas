/**
 * Datos iniciales según docs/plan-financiero-y-app.md.
 * Es idempotente: se puede correr varias veces, no duplica nada.
 *   pnpm db:seed              → la base local; se niega si .env.local apunta a otra
 *   pnpm db:seed:produccion   → producción, una sola vez, con ~/.finanzas/produccion.env y confirmación
 */
import { and, eq } from "drizzle-orm";
import { categoriasBase, colorPorDefecto, iconoPorDefecto } from "../lib/categorias";
import { conectar, terminarConError, urlLocal, urlProduccion } from "./conexion-script";
import * as schema from "./schema";

async function main() {
  const url = process.argv.includes("--produccion") ? await urlProduccion("sembrar") : urlLocal("pnpm db:seed");
  const { db, conexion } = conectar(url);

  // Cuentas: sección 4, "Cuentas y monedas".
  await db
    .insert(schema.cuentas)
    .values([
      { nombre: "Binance", moneda: "USDT", tipo: "exchange", orden: 1, nota: "Principal." },
      {
        nombre: "Segunda billetera",
        moneda: "USDC",
        tipo: "billetera",
        orden: 2,
        nota: "Parte del fondo de emergencia.",
      },
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

  // Sobres: sección 2, "Los sobres". "Por asignar" es donde cae cada ingreso antes del reparto.
  await db
    .insert(schema.sobres)
    .values([
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
      { nombre: "Inversión", tipo: "inversion", orden: 6, nota: "Intocable. Nunca se retira." },
    ])
    .onConflictDoNothing();

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
  // Idempotente por sobre: si la regla ya existe, no se toca.
  const sobres = await db.select({ id: schema.sobres.id, nombre: schema.sobres.nombre }).from(schema.sobres);
  const idDe = (nombre: string) => {
    const s = sobres.find((x) => x.nombre === nombre);
    if (!s) throw new Error(`No existe el sobre ${nombre}`);
    return s.id;
  };
  await db
    .insert(schema.reglasReparto)
    .values([
      { orden: 1, sobreId: idDe("Gastos del mes"), tipo: "fijo", valor: 45_000 },
      { orden: 2, sobreId: idDe("Familia"), tipo: "fijo", valor: 10_000 },
      // Fondo de reserva: 25 USD al mes como punto de partida; se recalcula desde el desglose del sobre.
      { orden: 3, sobreId: idDe("Ocasiones"), tipo: "fijo", valor: 2_500 },
      { orden: 4, sobreId: idDe("Emergencia"), tipo: "porcentaje", valor: 4_000 },
      { orden: 5, sobreId: idDe("Planes"), tipo: "porcentaje", valor: 3_000 },
      { orden: 6, sobreId: idDe("Inversión"), tipo: "porcentaje", valor: 3_000 },
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
