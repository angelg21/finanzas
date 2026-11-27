/**
 * Comprobación contra la base de los criterios ★ de la spec 004 que no caben en una función pura: el ingreso y su
 * reparto en una sola sentencia y con el cuadre intacto, el reintento sin duplicados, dos repartos a la vez sin
 * pasarse del saldo, las reglas guardadas todas juntas o ninguna y el check del porcentaje. Corre sobre la base local
 * con los datos de demostración y la deja como estaba:
 *   pnpm exec tsx scripts/comprobar-004.ts
 * Lo que no pasa por una captura lleva la referencia "demo-comprobar-004-*". Lo que sí (registrarCaptura y
 * repartirPorAsignar exigen "captura-<uuid>-…") usa ids que empiezan por 0c040004, para reconocerlos: se borran al
 * terminar y, si una corrida se cortó, al empezar la siguiente. Las reglas de reparto se restauran tal cual estaban.
 * Nunca contra una base con datos reales: se niega si encuentra movimientos que no sean de demostración.
 */
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { and, count, eq, inArray, isNull, like, not, or } from "drizzle-orm";
import { referenciaDeCaptura, referenciaDeReasignacion, resolverReintento } from "../src/lib/captura";
import { exigirBaseLocal } from "../src/lib/destino-base";
import { aCentavos } from "../src/lib/dinero";
import { hoyEnCaracas } from "../src/lib/fechas";
import { type AsignacionTecleada, type FilaIngreso, camposDePropuesta, prepararIngreso } from "../src/lib/ingresos";

const REFERENCIA = "demo-comprobar-004";
/** El primer bloque de los ids de captura de esta comprobación. */
const MARCA = "0c040004";
let fallos = 0;

function comprobar(criterio: string, descripcion: string, ok: boolean, detalle = "") {
  if (!ok) fallos++;
  console.log(`${ok ? "✓" : "✗"} ${criterio} · ${descripcion}${detalle ? ` (${detalle})` : ""}`);
}

/** Un id de captura reconocible: 0c040004-xxxx-4xxx-8xxx-xxxxxxxxxxxx. */
const idDePrueba = () => `${MARCA}${randomUUID().slice(8)}`;

async function main() {
  config({ path: ".env.local" });
  // Escribe filas: solo en la base local (spec 002, criterio 10).
  exigirBaseLocal(process.env.DATABASE_URL, "comprobar-004");
  const { db, movimientos, reglasReparto, sobres } = await import("../src/db/index");
  const { registrarCaptura, repartirPorAsignar } = await import("../src/db/movimientos");
  const { saldosPorCuenta, saldosPorSobre } = await import("../src/db/consultas");
  const { categoriasDeIngresoPorUso, datosDelReparto } = await import("../src/db/reparto");
  const { guardarReglas } = await import("../src/db/reglas");

  const nuestras = or(
    like(movimientos.referenciaExterna, `${REFERENCIA}-%`),
    like(movimientos.referenciaExterna, `captura-${MARCA}-%`),
  );
  // Lo que dejó una corrida cortada se borra antes de mirar.
  await db.delete(movimientos).where(nuestras);
  const [{ reales }] = await db
    .select({ reales: count() })
    .from(movimientos)
    .where(or(isNull(movimientos.referenciaExterna), not(like(movimientos.referenciaExterna, "demo-%"))));
  if (reales > 0) throw new Error(`Hay ${reales} movimientos que no son de demostración. No se toca esta base.`);

  async function estado() {
    const [c, s] = await Promise.all([saldosPorCuenta(), saldosPorSobre()]);
    const [{ filas }] = await db.select({ filas: count() }).from(movimientos);
    const totalCuentas = c.reduce((a, x) => a + x.saldoUsdCentavos, 0);
    const totalSobres = s.reduce((a, x) => a + x.saldoCentavos, 0);
    return { cuentas: c, sobres: s, totalCuentas, totalSobres, cuadra: totalCuentas === totalSobres, filas };
  }
  type Estado = Awaited<ReturnType<typeof estado>>;
  const huella = (e: Estado) =>
    JSON.stringify([e.cuentas.map((c) => [c.id, c.saldoCentavos]), e.sobres.map((s) => [s.id, s.saldoCentavos])]);
  const reglasAhora = () =>
    db
      .select()
      .from(reglasReparto)
      .orderBy(reglasReparto.sobreId)
      .then((r) => JSON.stringify(r));

  const inicial = await estado();
  const reglasIniciales = await db.select().from(reglasReparto);
  const topeInicial = (
    await db.select({ tope: sobres.topeCentavos }).from(sobres).where(eq(sobres.tipo, "emergencia"))
  )[0]?.tope;
  const reparto = await datosDelReparto();
  const { porAsignar } = reparto;
  const binance = inicial.cuentas.find((c) => c.nombre === "Binance");
  const prima = inicial.cuentas.find((c) => c.nombre === "Cuenta prima");
  const sueldo = (await categoriasDeIngresoPorUso()).find((c) => c.nombre === "Sueldo remoto");
  if (!porAsignar?.activo || !binance || !prima || !sueldo) throw new Error("Faltan datos base: corre pnpm db:seed");
  const saldoDe = (e: Estado, id: number) => e.sobres.find((s) => s.id === id)?.saldoCentavos ?? NaN;
  const cuentaDe = (e: Estado, id: number) => e.cuentas.find((c) => c.id === id)?.saldoCentavos ?? NaN;
  const hoy = hoyEnCaracas(new Date());
  const validos = reparto.sobres.map((s) => s.id);
  const planes = reparto.sobres.find((s) => s.nombre === "Planes");
  // Por tipo: desde la spec 015 el sobre se llama "Inversión a largo plazo".
  const inversion = reparto.sobres.find((s) => s.tipo === "inversion");
  if (!planes || !inversion) throw new Error("Faltan los sobres Planes e Inversión: corre pnpm db:seed");

  /** Las filas de un ingreso con el reparto dado (o la propuesta), con las referencias de su captura. */
  function ingreso(
    id: string,
    monto: string,
    cuenta: { id: number; moneda: "USD" | "USDT" | "USDC" | "VES" },
    asignaciones?: AsignacionTecleada[],
  ) {
    const propuesta = camposDePropuesta(aCentavos(monto), hoy, reparto.reglas, reparto.recibidoPorMes);
    const preparado = prepararIngreso(
      {
        monto,
        fecha: hoy,
        nota: "",
        categoriaId: sueldo!.id,
        porAsignarId: porAsignar!.id,
        sobresValidos: validos,
        asignaciones:
          asignaciones ?? Object.entries(propuesta).map(([sobreId, m]) => ({ sobreId: Number(sobreId), monto: m })),
      },
      hoy,
      cuenta,
    );
    if (!preparado.ok) throw new Error(`prepararIngreso rechazó ${monto}: ${JSON.stringify(preparado.errores)}`);
    const referencia = (f: FilaIngreso) =>
      f.tipo === "ingreso" ? referenciaDeCaptura(id, "ingreso") : referenciaDeReasignacion(id, f.sobreDestinoId);
    return preparado.filas.map((f) => ({ ...f, referenciaExterna: referencia(f) }));
  }
  const deCaptura = (id: string) =>
    db
      .select()
      .from(movimientos)
      .where(like(movimientos.referenciaExterna, `captura-${id}-%`));

  console.log(`Base local · hoy en Caracas ${hoy} · ${inicial.filas} movimientos`);
  comprobar(
    "9",
    "al empezar, Cuadra",
    inicial.cuadra,
    `sobres ${inicial.totalSobres}, cuentas ${inicial.totalCuentas}`,
  );

  try {
    // ★ 6 y 9 · el ingreso cae en la cuenta y en "Por asignar", y el reparto deja todo cuadrado
    const id1 = idDePrueba();
    const filas1 = ingreso(id1, "1200", binance);
    comprobar("6", "registrarCaptura guarda un ingreso nuevo", (await registrarCaptura(id1, filas1)).nueva === true);
    const guardadas1 = await deCaptura(id1);
    const fila1 = guardadas1.find((f) => f.tipo === "ingreso");
    comprobar(
      "6",
      "una fila ingreso en Binance, a Por asignar, con Sueldo remoto, 1 a 1 en USD",
      fila1?.cuentaDestinoId === binance.id &&
        fila1.sobreDestinoId === porAsignar.id &&
        fila1.categoriaId === sueldo.id &&
        fila1.montoCentavos === 120_000 &&
        fila1.montoUsdCentavos === 120_000 &&
        fila1.moneda === "USDT",
    );
    const reasignaciones1 = guardadas1.filter((f) => f.tipo === "reasignacion");
    comprobar(
      "6",
      "y una reasignación en USD desde Por asignar por cada sobre con monto",
      reasignaciones1.length === filas1.length - 1 &&
        reasignaciones1.every((r) => r.moneda === "USD" && r.sobreOrigenId === porAsignar.id && r.montoCentavos > 0),
      `${reasignaciones1.length} reasignaciones`,
    );
    const tras1 = await estado();
    comprobar("9", "tras guardar, Cuadra", tras1.cuadra, `sobres ${tras1.totalSobres}, cuentas ${tras1.totalCuentas}`);
    comprobar("9", "Por asignar queda donde estaba", saldoDe(tras1, porAsignar.id) === saldoDe(inicial, porAsignar.id));
    comprobar("6", "Binance sube 1.200", cuentaDe(tras1, binance.id) - cuentaDe(inicial, binance.id) === 120_000);

    // ★ 7 · todo o nada, y sin duplicados
    const repetido = await registrarCaptura(id1, filas1);
    const reintento = repetido.nueva ? "nueva" : resolverReintento(repetido.guardadas, filas1, new Date());
    comprobar(
      "7",
      'el mismo envío otra vez es "ya estaba" y no duplica',
      reintento === "ya-estaba" && (await estado()).filas === tras1.filas,
      reintento,
    );
    const cambiado = filas1.map((f, i) =>
      i === 1 ? { ...f, montoCentavos: f.montoCentavos - 1, montoUsdCentavos: f.montoUsdCentavos - 1 } : f,
    );
    const otro = await registrarCaptura(id1, cambiado);
    const veredicto = otro.nueva ? "nueva" : resolverReintento(otro.guardadas, cambiado, new Date());
    comprobar(
      "7",
      'con un monto cambiado es "otra" y no guarda nada',
      veredicto === "otra" && (await estado()).filas === tras1.filas,
      veredicto,
    );
    const id2 = idDePrueba();
    const malas = ingreso(id2, "100", binance).map((f) =>
      f.tipo === "reasignacion" ? { ...f, montoUsdCentavos: 0 } : f,
    );
    let rechazado = false;
    try {
      await registrarCaptura(id2, malas);
    } catch {
      rechazado = true; // lo esperado: el check de la base rechaza la reasignación de 0
    }
    comprobar(
      "7",
      "si una reasignación no entra, el ingreso tampoco",
      rechazado && (await deCaptura(id2)).length === 0,
    );

    // ADR 0006 · un ingreso en la cuenta de la prima también cuadra
    const id3 = idDePrueba();
    await registrarCaptura(id3, ingreso(id3, "300", prima, [{ sobreId: planes.id, monto: "100" }]));
    const tras3 = await estado();
    comprobar("9", "un ingreso en la cuenta de la prima cuadra igual", tras3.cuadra, `${tras3.totalSobres}`);
    const enPorAsignar = saldoDe(tras3, porAsignar.id) - saldoDe(inicial, porAsignar.id);
    comprobar("10", "lo que no se repartió (200) queda en Por asignar", enPorAsignar === 20_000, `${enPorAsignar}`);

    // ★ 10 · dos repartos a la vez nunca pasan del saldo
    const saldo = saldoDe(tras3, porAsignar.id);
    const pedido = (saldo * 6 - ((saldo * 6) % 10)) / 10;
    const repartoDe = (id: string) => [
      {
        fecha: hoy,
        tipo: "reasignacion" as const,
        montoCentavos: pedido,
        moneda: "USD" as const,
        montoUsdCentavos: pedido,
        sobreOrigenId: porAsignar.id,
        sobreDestinoId: inversion.id,
        origen: "manual" as const,
        referenciaExterna: referenciaDeReasignacion(id, inversion.id),
      },
    ];
    const [a, b] = [idDePrueba(), idDePrueba()];
    const resultados = await Promise.all([
      repartirPorAsignar(a, porAsignar.id, repartoDe(a)),
      repartirPorAsignar(b, porAsignar.id, repartoDe(b)),
    ]);
    const guardados = resultados.filter((r) => "nueva" in r && r.nueva).length;
    const sinSaldo = resultados.filter((r) => "sinSaldo" in r).length;
    const tras4 = await estado();
    comprobar(
      "10",
      `dos pestañas piden el 60 % de ${saldo} a la vez: una guarda y la otra recibe "no alcanza"`,
      guardados === 1 && sinSaldo === 1,
      `${guardados} guardados, ${sinSaldo} sin saldo`,
    );
    comprobar("10", "Por asignar no queda en negativo y Cuadra", saldoDe(tras4, porAsignar.id) >= 0 && tras4.cuadra);
    const ganador = resultados[0] && "nueva" in resultados[0] && resultados[0].nueva ? a : b;
    const otraVez = await repartirPorAsignar(ganador, porAsignar.id, repartoDe(ganador));
    const dice =
      "nueva" in otraVez && !otraVez.nueva
        ? resolverReintento(otraVez.guardadas, repartoDe(ganador), new Date())
        : "otro";
    comprobar("10", 'el reintento del reparto que guardó es "ya estaba", no "no alcanza"', dice === "ya-estaba", dice);

    // ★ 11 y 12 · las reglas cambian juntas o ninguna, sin tocar movimientos
    // Las reglas activas de los sobres editables, con Planes en 25 % e Inversión en 35 %.
    const tipoDe = new Map(reparto.sobres.map((s) => [s.id, s.tipo]));
    const cambios: Record<number, number> = { [planes.id]: 2_500, [inversion.id]: 3_500 };
    const nuevas = reglasIniciales
      .filter((r) => r.activa && tipoDe.has(r.sobreId) && tipoDe.get(r.sobreId) !== "fondo")
      .map((r) => ({ sobreId: r.sobreId, tipo: r.tipo, valor: cambios[r.sobreId] ?? r.valor }));
    const movimientosAntes = (await estado()).filas;
    await guardarReglas(nuevas, topeInicial ?? null);
    const conNuevas = await db
      .select()
      .from(reglasReparto)
      .where(inArray(reglasReparto.sobreId, [planes.id, inversion.id]));
    comprobar(
      "11",
      "guardar cambia las reglas pedidas",
      conNuevas.every((r) => r.valor === (r.sobreId === planes.id ? 2_500 : 3_500) && r.activa),
    );
    comprobar("11", "y no toca ningún movimiento", (await estado()).filas === movimientosAntes);
    const conMala = nuevas.map((r) => (r.sobreId === inversion.id ? { ...r, valor: 10_001 } : r));
    let rechazada = "";
    try {
      await guardarReglas(conMala, topeInicial ?? null);
    } catch (error) {
      rechazada = (error as { cause?: { code?: string } }).cause?.code ?? "otro";
    }
    const reglasTrasMala = await db.select().from(reglasReparto).where(eq(reglasReparto.sobreId, planes.id));
    comprobar("12", "un porcentaje de 10001 lo rechaza la base (23514)", rechazada === "23514", rechazada);
    comprobar("11", "y nada del guardado cambia: Planes sigue en 25 %", reglasTrasMala[0]?.valor === 2_500);
  } finally {
    await db.delete(movimientos).where(nuestras);
    for (const r of reglasIniciales) {
      await db
        .update(reglasReparto)
        .set({ tipo: r.tipo, valor: r.valor, activa: r.activa, orden: r.orden })
        .where(eq(reglasReparto.id, r.id));
    }
    await db.delete(reglasReparto).where(
      and(
        not(
          inArray(
            reglasReparto.id,
            reglasIniciales.map((r) => r.id),
          ),
        ),
      ),
    );
    await db
      .update(sobres)
      .set({ topeCentavos: topeInicial ?? null })
      .where(eq(sobres.tipo, "emergencia"));
    const final = await estado();
    comprobar(
      "—",
      "la base queda como estaba: mismos saldos, movimientos y reglas",
      huella(final) === huella(inicial) &&
        final.filas === inicial.filas &&
        (await reglasAhora()) === JSON.stringify([...reglasIniciales].sort((x, y) => x.sobreId - y.sobreId)),
      `${final.filas} movimientos`,
    );
  }
}

main()
  .then(() => {
    console.log(fallos === 0 ? "✓ comprobar-004: todo en verde" : `✗ comprobar-004: ${fallos} comprobaciones fallaron`);
    process.exit(fallos === 0 ? 0 : 1);
  })
  .catch((error) => {
    console.error("✗ comprobar-004:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
