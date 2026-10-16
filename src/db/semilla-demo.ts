/**
 * Datos de demostración para ver la app con números reales mientras no existe el importador.
 * Todos los movimientos llevan origen "importado" y referencia "demo-..." para poder borrarlos, y las deudas la
 * referencia "demo-deuda-..." (spec 005, criterio 22):
 *   pnpm db:demo            → inserta (idempotente)
 *   pnpm db:demo:limpiar    → borra solo lo que insertó este script
 * Requiere haber corrido antes pnpm db:seed (cuentas, sobres y categorías).
 * Insertar solo corre contra la base local, nunca en producción (spec 002, criterio 10). Limpiar corre en
 * cualquier base, porque solo borra lo marcado demo-*.
 */
import { like } from "drizzle-orm";
import { aTasa, bolivaresDesdeUsd, tasaDecimal } from "../lib/dinero";
import { conectar, terminarConError, urlDeEntorno, urlLocal } from "./conexion-script";
import * as schema from "./schema";

type Nuevo = typeof schema.movimientos.$inferInsert;

async function main() {
  const limpiar = process.argv.includes("--limpiar");
  const url = limpiar ? urlDeEntorno() : urlLocal("pnpm db:demo");
  if (!url) throw new Error("Falta DATABASE_URL en .env.local");
  const { db, conexion } = conectar(url);

  if (limpiar) {
    // Primero los movimientos y luego las deudas, por la FK. En una transacción: si un movimiento real apunta a una
    // deuda demo, la FK lo impide y no se borra nada.
    const { movimientosBorrados, deudasBorradas } = await db.transaction(async (tx) => {
      const m = await tx
        .delete(schema.movimientos)
        .where(like(schema.movimientos.referenciaExterna, "demo-%"))
        .returning({ id: schema.movimientos.id });
      const d = await tx
        .delete(schema.deudas)
        .where(like(schema.deudas.referencia, "demo-deuda-%"))
        .returning({ id: schema.deudas.id });
      return { movimientosBorrados: m.length, deudasBorradas: d.length };
    });
    console.log(`Demo limpiada: ${movimientosBorrados} movimientos y ${deudasBorradas} deudas borrados.`);
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
  const sobreDeudas = sobres.find((s) => s.tipo === "deudas")?.id ?? falta("el sobre Deudas");

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
  const reasignar = (fecha: string, monto: number, destino: number, desde = porAsignar): Nuevo => ({
    fecha,
    tipo: "reasignacion",
    montoCentavos: monto,
    moneda: "USD",
    montoUsdCentavos: monto,
    sobreOrigenId: desde,
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

  // Deudas y préstamos (spec 005, criterio 22). Van al final: las referencias de los movimientos son posicionales.
  await db
    .insert(schema.deudas)
    .values([
      {
        sentido: "debo",
        persona: "Papás",
        montoInicialCentavos: 52_000,
        fechaPrevista: "2026-12-15",
        cuentaPrevistaId: efectivo,
        nota: "Para diciembre",
        referencia: "demo-deuda-001",
      },
      {
        sentido: "debo",
        persona: "Andrés",
        montoInicialCentavos: 25_000,
        fechaPrevista: "2026-10-22",
        cuentaPrevistaId: binance,
        nota: "Solo cobra en USDT",
        referencia: "demo-deuda-002",
      },
      {
        sentido: "me_deben",
        persona: "Carlos",
        montoInicialCentavos: 14_000,
        nota: "De antes de la app",
        referencia: "demo-deuda-003",
      },
      { sentido: "me_deben", persona: "Luis", montoInicialCentavos: 0, referencia: "demo-deuda-004" },
    ])
    .onConflictDoNothing();
  const deudas = await db
    .select({ id: schema.deudas.id, referencia: schema.deudas.referencia })
    .from(schema.deudas)
    .where(like(schema.deudas.referencia, "demo-deuda-%"));
  const deuda = (r: string) => deudas.find((d) => d.referencia === r)?.id ?? falta(`la deuda ${r}`);
  const sinDestino = { cuentaDestinoId: null, sobreDestinoId: null, categoriaId: null };
  // Apartar desde Planes, pagar parte de lo de Andrés, prestarle a Luis y cobrarle una parte.
  filas.push(reasignar("2026-10-02", 15_000, sobreDeudas, metas));
  filas.push({
    fecha: "2026-10-03",
    tipo: "pago_deuda",
    montoCentavos: 10_000,
    moneda: "USDT",
    montoUsdCentavos: 10_000,
    cuentaOrigenId: binance,
    sobreOrigenId: sobreDeudas,
    ...sinDestino,
    deudaId: deuda("demo-deuda-002"),
    nota: "Primera parte",
    origen: "importado",
    referenciaExterna: ref("pag"),
  });
  filas.push({
    fecha: "2026-09-12",
    tipo: "prestamo",
    montoCentavos: 8_000,
    moneda: "USDT",
    montoUsdCentavos: 8_000,
    cuentaOrigenId: binance,
    sobreOrigenId: metas,
    ...sinDestino,
    deudaId: deuda("demo-deuda-004"),
    nota: "Para el alquiler",
    origen: "importado",
    referenciaExterna: ref("pre"),
  });
  filas.push({
    fecha: "2026-10-02",
    tipo: "cobro_prestamo",
    montoCentavos: 3_000,
    moneda: "USDT",
    montoUsdCentavos: 3_000,
    cuentaOrigenId: null,
    sobreOrigenId: null,
    cuentaDestinoId: binance,
    sobreDestinoId: porAsignar,
    categoriaId: null,
    deudaId: deuda("demo-deuda-004"),
    nota: null,
    origen: "importado",
    referenciaExterna: ref("cob"),
  });

  const insertados = await db
    .insert(schema.movimientos)
    .values(filas)
    .onConflictDoNothing()
    .returning({ id: schema.movimientos.id });
  console.log(`Demo lista: ${insertados.length} movimientos nuevos de ${filas.length} (el resto ya existía).`);
  await conexion.end();
}

main().catch(terminarConError);
