/**
 * Datos de demostración para ver la app con números reales mientras no existe el importador.
 * Todos los movimientos llevan origen "importado" y referencia "demo-..." para poder borrarlos:
 *   pnpm db:demo            → inserta (idempotente)
 *   pnpm db:demo:limpiar    → borra solo lo que insertó este script
 * Requiere haber corrido antes pnpm db:seed (cuentas, sobres y categorías).
 */
import { config } from "dotenv";
import { like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { aTasa, bolivaresDesdeUsd, tasaDecimal } from "../lib/dinero";
import * as schema from "./schema";

config({ path: ".env.local" });

type Nuevo = typeof schema.movimientos.$inferInsert;

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("Falta DATABASE_URL en .env.local");
  const conexion = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
  const db = drizzle(conexion, { schema, casing: "snake_case" });

  if (process.argv.includes("--limpiar")) {
    const borrados = await db
      .delete(schema.movimientos)
      .where(like(schema.movimientos.referenciaExterna, "demo-%"))
      .returning({ id: schema.movimientos.id });
    console.log(`Demo limpiada: ${borrados.length} movimientos borrados.`);
    await conexion.end();
    return;
  }

  const cuentas = await db.select().from(schema.cuentas);
  const sobres = await db.select().from(schema.sobres);
  const categorias = await db.select().from(schema.categorias);
  const cuenta = (n: string) => cuentas.find((c) => c.nombre === n)?.id ?? falta(`cuenta ${n}`);
  const sobre = (n: string) => sobres.find((s) => s.nombre === n)?.id ?? falta(`sobre ${n}`);
  // Por nombre y tipo: "Familia" puede existir como gasto y como ingreso (el nombre es único por tipo).
  const categoria = (n: string, tipo: "gasto" | "ingreso") =>
    categorias.find((c) => c.nombre === n && c.tipo === tipo)?.id ??
    falta(`la categoría de ${tipo} "${n}" (si la renombraste, devuélvele ese nombre)`);
  function falta(que: string): never {
    throw new Error(`No existe ${que}. Corre primero pnpm db:seed.`);
  }

  const binance = cuenta("Binance");
  const billetera = cuenta("Segunda billetera");
  const efectivo = cuenta("Efectivo");
  const bolivares = cuenta("Bolívares");
  const porAsignar = sobre("Por asignar");
  const gastos = sobre("Gastos del mes");
  const familia = sobre("Familia");
  const emergencia = sobre("Emergencia");
  const metas = sobre("Planes");
  const ocasiones = sobre("Ocasiones");
  const inversion = sobre("Inversión");

  const filas: Nuevo[] = [];
  let n = 0;
  const ref = (tag: string) => `demo-${tag}-${String(++n).padStart(3, "0")}`;

  const ingreso = (fecha: string, monto: number, cat: string, nota: string): Nuevo => ({
    fecha,
    tipo: "ingreso",
    montoCentavos: monto,
    moneda: "USDT",
    montoUsdCentavos: monto,
    cuentaDestinoId: binance,
    sobreDestinoId: porAsignar,
    categoriaId: categoria(cat, "ingreso"),
    nota,
    origen: "importado",
    referenciaExterna: ref("ing"),
  });
  const reasignar = (fecha: string, monto: number, destino: number): Nuevo => ({
    fecha,
    tipo: "reasignacion",
    montoCentavos: monto,
    moneda: "USD",
    montoUsdCentavos: monto,
    sobreOrigenId: porAsignar,
    sobreDestinoId: destino,
    origen: "importado",
    referenciaExterna: ref("rea"),
  });
  const gasto = (fecha: string, monto: number, cat: string, nota: string, desde = gastos): Nuevo => ({
    fecha,
    tipo: "gasto",
    montoCentavos: monto,
    moneda: "USDT",
    montoUsdCentavos: monto,
    cuentaOrigenId: binance,
    sobreOrigenId: desde,
    categoriaId: categoria(cat, "gasto"),
    nota,
    origen: "importado",
    referenciaExterna: ref("gas"),
  });
  /**
   * Vende USDT por bolívares a una tasa y registra el gasto en Bs valorado en los dólares vendidos.
   * La aritmética es la de dinero.ts, en enteros: nunca float fuera de ella.
   */
  const gastoEnBolivares = (fecha: string, usd: number, tasa: string, cat: string, nota: string): Nuevo[] => {
    const tasaDm = aTasa(tasa);
    const bsCentavos = bolivaresDesdeUsd(usd, tasaDm);
    return [
      {
        fecha,
        tipo: "transferencia",
        montoCentavos: usd,
        moneda: "USDT",
        montoUsdCentavos: usd,
        montoDestinoCentavos: bsCentavos,
        monedaDestino: "VES",
        tasa: tasaDecimal(tasaDm),
        cuentaOrigenId: binance,
        cuentaDestinoId: bolivares,
        nota: `Cambio a Bs a ${tasa}`,
        origen: "importado",
        referenciaExterna: ref("cam"),
      },
      {
        fecha,
        tipo: "gasto",
        montoCentavos: bsCentavos,
        moneda: "VES",
        montoUsdCentavos: usd,
        tasa: tasaDecimal(tasaDm),
        cuentaOrigenId: bolivares,
        sobreOrigenId: gastos,
        categoriaId: categoria(cat, "gasto"),
        nota,
        origen: "importado",
        referenciaExterna: ref("gbs"),
      },
    ];
  };
  const transferir = (
    fecha: string,
    monto: number,
    origen: number,
    destino: number,
    monedaDestino: "USDC" | "USD",
    nota: string,
  ): Nuevo => ({
    fecha,
    tipo: "transferencia",
    montoCentavos: monto,
    moneda: "USDT",
    montoUsdCentavos: monto,
    montoDestinoCentavos: monto,
    monedaDestino,
    cuentaOrigenId: origen,
    cuentaDestinoId: destino,
    nota,
    origen: "importado",
    referenciaExterna: ref("tra"),
  });

  // Cinco meses: junio a octubre de 2026. Sueldo el día 1 y reparto según las reglas.
  const meses = ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];
  for (const m of meses) {
    filas.push(ingreso(`${m}-01`, 120_000, "Sueldo remoto", "Sueldo"));
    filas.push(reasignar(`${m}-01`, 45_000, gastos));
    filas.push(reasignar(`${m}-01`, 10_000, familia));
    filas.push(reasignar(`${m}-01`, 2_500, ocasiones));
    filas.push(reasignar(`${m}-01`, 25_000, emergencia));
    filas.push(reasignar(`${m}-01`, 17_500, metas));
    filas.push(reasignar(`${m}-01`, 20_000, inversion));
    filas.push(gasto(`${m}-02`, 10_000, "Familia", "Apoyo a la casa", familia));
  }
  // Proyecto local desde septiembre: el extra acelera emergencia, metas e inversión.
  for (const m of ["2026-09", "2026-10"]) {
    filas.push(ingreso(`${m}-03`, 80_000, "Proyecto local", "Proyecto local, pago mensual"));
    filas.push(reasignar(`${m}-03`, 40_000, emergencia));
    filas.push(reasignar(`${m}-03`, 20_000, metas));
    filas.push(reasignar(`${m}-03`, 20_000, inversion));
  }

  // Gastos del día a día. Montos en centavos de USD.
  const plantilla: [number, number, string, string][] = [
    [3, 4_200, "Comida", "Mercado semanal"],
    [4, 1_250, "Transporte", "Gasolina"],
    [6, 2_800, "Servicios", "Internet"],
    [8, 1_500, "Ocio", "Cine"],
    [10, 4_600, "Comida", "Mercado semanal"],
    [12, 3_000, "Servicios", "Plan del celular"],
    [14, 2_200, "Salud", "Farmacia"],
    [17, 4_100, "Comida", "Mercado semanal"],
    [19, 1_800, "Ocio", "Salida con amigos"],
    [22, 900, "Transporte", "Taxi"],
    [24, 4_400, "Comida", "Mercado semanal"],
    [27, 1_200, "Hogar", "Limpieza"],
  ];
  const tasas: Record<string, string> = {
    "2026-06": "221.4",
    "2026-07": "226.9",
    "2026-08": "231.2",
    "2026-09": "236.5",
    "2026-10": "241.8",
  };
  for (const m of meses) {
    for (const [dia, monto, cat, nota] of plantilla) {
      if (m === "2026-10" && dia > 3) continue; // hoy es 3 de octubre
      filas.push(gasto(`${m}-${String(dia).padStart(2, "0")}`, monto, cat, nota));
    }
    // Dos gastos en bolívares al mes: panadería y transporte público.
    if (m !== "2026-10") {
      filas.push(...gastoEnBolivares(`${m}-05`, 800, tasas[m], "Comida", "Panadería"));
      filas.push(...gastoEnBolivares(`${m}-15`, 500, tasas[m], "Transporte", "Pasajes"));
    }
  }
  // Gastos puntuales que hacen interesante la gráfica.
  filas.push(gasto("2026-07-20", 18_000, "Tecnología", "Audífonos"));
  filas.push(gasto("2026-08-09", 6_500, "Ropa", "Zapatos"));
  filas.push(gasto("2026-09-21", 9_000, "Regalos", "Cumpleaños de mamá", ocasiones));

  // Parte del fondo de emergencia fuera de Binance.
  filas.push(transferir("2026-08-01", 30_000, binance, billetera, "USDC", "Reserva fuera de Binance"));
  filas.push(transferir("2026-08-01", 10_000, binance, efectivo, "USD", "Efectivo de reserva"));

  const insertados = await db
    .insert(schema.movimientos)
    .values(filas)
    .onConflictDoNothing()
    .returning({ id: schema.movimientos.id });
  console.log(`Demo lista: ${insertados.length} movimientos nuevos de ${filas.length} (el resto ya existía).`);
  await conexion.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
