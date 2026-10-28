/**
 * Los criterios ★ de la spec 006 contra la base, escritos desde su texto al verificar:
 *   ★ 1  · editar o borrar nunca rompe el cuadre: se mira después de cada paso, y al final la base queda como estaba;
 *   ★ 2  · un gasto en dólares cambia monto, cuenta, sobre, categoría, fecha y nota en su misma fila; la cuenta y el
 *          sobre de antes recuperan lo de antes y los nuevos bajan lo nuevo; las reglas de la captura valen igual;
 *   ★ 3  · con bolívares, la venta enlazada se actualiza, se borra o se crea según la forma de pago nueva, y el gasto
 *          conserva su id en todos los casos;
 *   ★ 4  · un ingreso cambia en su fila, la diferencia entra o sale de Por asignar y su reparto no cambia;
 *   ★ 5  · bajarlo más de lo que tiene Por asignar no guarda nada y lo dice; una baja y un reparto a la vez, con el
 *          mismo candado, nunca dejan Por asignar en negativo;
 *   ★ 6  · borrar un gasto se lleva su venta, y la cuenta y el sobre recuperan lo que tenían;
 *   ★ 7  · borrar un ingreso se lleva su reparto (si lo que quedó sin repartir ya se usó, el criterio 11 de la 007,
 *          que prueba scripts/comprobar-007-retiro.ts); la
 *          confirmación avisa del sobre que quedará en negativo;
 *   ★ 8  · nada que no sea gasto o ingreso se abre para editar (la página da 404 cuando movimientoParaEditar da null)
 *          ni se edita o borra por su id; un gasto sin captura se edita solo él;
 *   ★ 9  · si algo falla dentro de la transacción no queda nada a medias, y dos ediciones a la vez no mezclan el
 *          gasto de una con la venta de la otra;
 *   ★ 10 · la misma edición dos veces deja lo mismo, y borrar lo ya borrado responde "no existe", sin error.
 * La sesión y conFallas del ★ 9 los miran, sobre todas las acciones, src/app/sesion.criterios.test.ts,
 * src/app/fallas.criterios.test.ts y scripts/comprobar-002-servidor.ts.
 * Corre sobre la base local con los datos de demostración y la deja como estaba:
 *   pnpm exec tsx scripts/comprobar-006.ts
 * Lo suyo son capturas cuyo id empieza por 0c060006 y la fila "demo-comprobar-006-sin-captura", que se borran al
 * terminar y, si una corrida se cortó, al empezar la siguiente. Nunca contra una base con datos reales: se niega si
 * encuentra movimientos que no sean de demostración.
 */
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { count, eq, isNull, like, not, or } from "drizzle-orm";
import { referenciaDeCaptura, referenciaDeReasignacion } from "../src/lib/captura";
import { exigirBaseLocal } from "../src/lib/destino-base";
import { centavosATexto } from "../src/lib/dinero";
import { planDeEdicionDeGasto } from "../src/lib/editar-gasto";
import { type EdicionDeIngreso, planDeEdicionDeIngreso } from "../src/lib/editar-ingreso";
import { fechaDesdeAtajo, hoyEnCaracas } from "../src/lib/fechas";
import { type CuentaGasto, type EntradaGasto, prepararGasto } from "../src/lib/gastos";
import { type AsignacionTecleada, prepararIngreso } from "../src/lib/ingresos";

const MARCA = "0c060006";
const SIN_CAPTURA = "demo-comprobar-006-sin-captura";
let fallos = 0;

function comprobar(criterio: string, descripcion: string, ok: boolean, detalle = "") {
  if (!ok) fallos++;
  console.log(`${ok ? "✓" : "✗"} ${criterio} · ${descripcion}${detalle ? ` (${detalle})` : ""}`);
}

const idDePrueba = () => `${MARCA}${randomUUID().slice(8)}`;

/** Lo que devuelve una edición: si guardó, si se negó (con sus errores) o si la fila no existe. */
const guardo = (r: object) => "ok" in r && r.ok === true;
const errores = (r: object): Record<string, string | undefined> =>
  "errores" in r ? (r.errores as Record<string, string | undefined>) : {};
const noExiste = (r: object) => "noExiste" in r;

async function main() {
  config({ path: ".env.local" });
  // Escribe filas: solo en la base local (spec 002, criterio 10).
  exigirBaseLocal(process.env.DATABASE_URL, "comprobar-006");
  const { db, movimientos } = await import("../src/db/index");
  const { categoriasDeGastoPorUso, saldosPorCuenta, saldosPorSobre, sobresParaGasto } =
    await import("../src/db/consultas");
  const { categoriasDeIngresoPorUso } = await import("../src/db/reparto");
  const { registrarCaptura, registrarMovimientos, repartirPorAsignar } = await import("../src/db/movimientos");
  const { borrarGasto, editarGasto, editarIngreso, movimientoParaEditar } =
    await import("../src/db/editar-movimientos");
  const { borrarIngreso, vistaPreviaDeBorrado } = await import("../src/db/borrar-ingreso");

  const nuestros = or(
    like(movimientos.referenciaExterna, `captura-${MARCA}-%`),
    eq(movimientos.referenciaExterna, SIN_CAPTURA),
  );
  const limpiar = () => db.delete(movimientos).where(nuestros);
  await limpiar();
  const [{ reales }] = await db
    .select({ reales: count() })
    .from(movimientos)
    .where(or(isNull(movimientos.referenciaExterna), not(like(movimientos.referenciaExterna, "demo-%"))));
  if (reales > 0) throw new Error(`Hay ${reales} movimientos que no son de demostración. No se toca esta base.`);

  async function estado() {
    const [c, s, [{ filas }]] = await Promise.all([
      saldosPorCuenta(),
      saldosPorSobre(),
      db.select({ filas: count() }).from(movimientos),
    ]);
    const totalCuentas = c.reduce((a, x) => a + x.saldoUsdCentavos, 0);
    const totalSobres = s.reduce((a, x) => a + x.saldoCentavos, 0);
    const huella = JSON.stringify([c.map((x) => [x.id, x.saldoCentavos]), s.map((x) => [x.id, x.saldoCentavos])]);
    return { cuentas: c, sobres: s, filas, cuadra: totalCuentas === totalSobres, huella, totalCuentas, totalSobres };
  }
  type Estado = Awaited<ReturnType<typeof estado>>;
  const enCuenta = (e: Estado, id: number) => e.cuentas.find((c) => c.id === id)?.saldoCentavos ?? NaN;
  const enSobre = (e: Estado, id: number) => e.sobres.find((s) => s.id === id)?.saldoCentavos ?? NaN;
  async function cuadra(paso: string) {
    const e = await estado();
    comprobar("1", `Cuadra ${paso}`, e.cuadra, `sobres ${e.totalSobres}, cuentas ${e.totalCuentas}`);
    return e;
  }

  const inicial = await estado();
  const hoy = hoyEnCaracas(new Date());
  const ayer = fechaDesdeAtajo("ayer", hoy);
  const manana = new Date(Date.parse(`${hoy}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  const binance = inicial.cuentas.find((c) => c.nombre === "Binance");
  const prima = inicial.cuentas.find((c) => c.nombre === "Cuenta prima");
  const bolivares = inicial.cuentas.find((c) => c.moneda === "VES");
  const porAsignar = inicial.sobres.find((s) => s.tipo === "por_asignar");
  const gastosDelMes = inicial.sobres.find((s) => s.tipo === "gastos");
  const planes = inicial.sobres.find((s) => s.nombre === "Planes");
  const [catA, catB] = await categoriasDeGastoPorUso();
  const [sueldo, otroIngreso] = await categoriasDeIngresoPorUso();
  if (!binance || !prima || !bolivares || !porAsignar || !gastosDelMes || !planes || !catB || !sueldo) {
    throw new Error("Faltan datos base: corre pnpm db:seed y pnpm db:demo");
  }
  const validos = inicial.sobres.filter((s) => s.tipo !== "por_asignar").map((s) => s.id);
  const cuenta = (c: { id: number; moneda: CuentaGasto["moneda"] }): CuentaGasto => ({ id: c.id, moneda: c.moneda });
  console.log(`Base local · hoy en Caracas ${hoy} · ${inicial.filas} movimientos`);
  comprobar("1", "al empezar, Cuadra", inicial.cuadra);

  const fila = (id: number | null) =>
    id === null
      ? Promise.resolve(null)
      : db
          .select()
          .from(movimientos)
          .where(eq(movimientos.id, id))
          .then((r) => r[0] ?? null);
  const deCaptura = (captura: string) =>
    db
      .select()
      .from(movimientos)
      .where(like(movimientos.referenciaExterna, `captura-${captura}-%`))
      .orderBy(movimientos.id);

  function entradaGasto(cambios: Partial<EntradaGasto> = {}): EntradaGasto {
    return {
      forma: "dolares",
      monto: "10",
      tasa: "",
      vendido: "",
      cuentaOrigen: cuenta(prima!),
      cuentaBolivares: cuenta(bolivares!),
      sobreId: gastosDelMes!.id,
      categoriaId: catA.id,
      fecha: hoy,
      nota: "comprobar-006",
      ...cambios,
    };
  }
  /** Un gasto registrado como en la captura, con su venta si se paga vendiendo USDT. */
  async function gasto(cambios: Partial<EntradaGasto> = {}) {
    const captura = idDePrueba();
    const p = prepararGasto(entradaGasto(cambios), hoy);
    if (!p.ok) throw new Error(`prepararGasto rechazó: ${JSON.stringify(p.errores)}`);
    const tipo = (t: string) => (t === "transferencia" ? "transferencia" : "gasto");
    await registrarCaptura(
      captura,
      p.filas.map((f) => ({ ...f, referenciaExterna: referenciaDeCaptura(captura, tipo(f.tipo)) })),
    );
    const filas = await deCaptura(captura);
    const gastoId = filas.find((f) => f.tipo === "gasto")?.id;
    if (!gastoId) throw new Error("El gasto no se registró");
    return { captura, gastoId, ventaId: filas.find((f) => f.tipo === "transferencia")?.id ?? null };
  }
  const editar = (id: number, cambios: Partial<EntradaGasto>) =>
    editarGasto(id, (g) => planDeEdicionDeGasto(g, entradaGasto(cambios), hoy), null);

  /** Las filas de un ingreso a Por asignar con su reparto, con las referencias de su captura. */
  function filasDeIngreso(captura: string, monto: string, asignaciones: AsignacionTecleada[]) {
    const p = prepararIngreso(
      {
        monto,
        fecha: hoy,
        nota: "comprobar-006",
        categoriaId: sueldo.id,
        porAsignarId: porAsignar!.id,
        sobresValidos: validos,
        asignaciones,
      },
      hoy,
      cuenta(prima!),
    );
    if (!p.ok) throw new Error(`prepararIngreso rechazó ${monto}: ${JSON.stringify(p.errores)}`);
    return p.filas.map((f) => ({
      ...f,
      referenciaExterna:
        f.tipo === "ingreso"
          ? referenciaDeCaptura(captura, "ingreso")
          : referenciaDeReasignacion(captura, f.sobreDestinoId),
    }));
  }
  async function ingreso(monto: string, asignaciones: AsignacionTecleada[] = []) {
    const captura = idDePrueba();
    await registrarCaptura(captura, filasDeIngreso(captura, monto, asignaciones));
    const filas = await deCaptura(captura);
    const ingresoId = filas.find((f) => f.tipo === "ingreso")?.id;
    if (!ingresoId) throw new Error("El ingreso no se registró");
    return { captura, ingresoId, reparto: filas.filter((f) => f.tipo === "reasignacion") };
  }
  const editarIng = (id: number, cambios: Partial<EdicionDeIngreso>, a = prima!) =>
    editarIngreso(
      id,
      (g, saldo) =>
        planDeEdicionDeIngreso(
          g,
          { monto: "100", fecha: hoy, nota: "comprobar-006", categoriaId: sueldo.id, ...cambios },
          cuenta(a),
          saldo,
          hoy,
        ),
      null,
    );
  /** Reparte desde Por asignar a `destino` con su propia captura, como /sobres/repartir. */
  async function repartir(centavos: number, destino: number) {
    const captura = idDePrueba();
    const monto = centavosATexto(centavos);
    const filas = filasDeIngreso(captura, monto, [{ sobreId: destino, monto }]).filter(
      (f) => f.tipo === "reasignacion",
    );
    return repartirPorAsignar(captura, porAsignar!.id, filas);
  }
  /** Deja Por asignar con exactamente `centavos`: reparte lo que sobra a Planes o registra un ingreso por lo que falta. */
  async function porAsignarEn(centavos: number) {
    const ahora = enSobre(await estado(), porAsignar!.id);
    if (ahora > centavos) await repartir(ahora - centavos, planes!.id);
    if (ahora < centavos) await ingreso(centavosATexto(centavos - ahora));
    const despues = enSobre(await estado(), porAsignar!.id);
    if (despues !== centavos) throw new Error(`Por asignar quedó en ${despues}, no en ${centavos}`);
  }

  try {
    // ★ 2 · un gasto en dólares, editado en su misma fila
    const e0 = await estado();
    const g = await gasto({ monto: "10" });
    const e1 = await estado();
    comprobar(
      "2",
      "el gasto registrado baja 10,00 de Cuenta prima y de Gastos del mes",
      enCuenta(e1, prima.id) === enCuenta(e0, prima.id) - 1000 &&
        enSobre(e1, gastosDelMes.id) === enSobre(e0, gastosDelMes.id) - 1000,
    );
    const rG = await editar(g.gastoId, {
      monto: "25",
      cuentaOrigen: cuenta(binance),
      sobreId: planes.id,
      categoriaId: catB.id,
      fecha: ayer,
      nota: "cambiada",
    });
    const fG = await fila(g.gastoId);
    comprobar("2", "editar monto, cuenta, sobre, categoría, fecha y nota responde que guardó", guardo(rG));
    comprobar(
      "2",
      "la misma fila queda con los valores nuevos",
      fG !== null &&
        fG.montoCentavos === 2500 &&
        fG.moneda === binance.moneda &&
        fG.cuentaOrigenId === binance.id &&
        fG.sobreOrigenId === planes.id &&
        fG.categoriaId === catB.id &&
        fG.fecha === ayer &&
        fG.nota === "cambiada" &&
        fG.tipo === "gasto",
      JSON.stringify(fG && [fG.montoCentavos, fG.cuentaOrigenId, fG.sobreOrigenId, fG.categoriaId, fG.fecha, fG.nota]),
    );
    const e2 = await cuadra("tras editar el gasto en dólares");
    comprobar(
      "2",
      "la cuenta y el sobre de antes recuperan lo de antes",
      enCuenta(e2, prima.id) === enCuenta(e0, prima.id) &&
        enSobre(e2, gastosDelMes.id) === enSobre(e0, gastosDelMes.id),
    );
    comprobar(
      "2",
      "la cuenta y el sobre nuevos bajan lo nuevo",
      enCuenta(e2, binance.id) === enCuenta(e0, binance.id) - 2500 &&
        enSobre(e2, planes.id) === enSobre(e0, planes.id) - 2500,
    );
    const guardadoAntes = JSON.stringify(await fila(g.gastoId));
    const rechazos: [string, Partial<EntradaGasto>, string][] = [
      ["monto cero", { monto: "0" }, "monto"],
      ["fecha de mañana", { fecha: manana }, "fecha"],
      ["una cuenta en bolívares para pagar en dólares", { cuentaOrigen: cuenta(bolivares) }, "cuenta"],
    ];
    for (const [descripcion, cambios, campo] of rechazos) {
      const r = await editar(g.gastoId, cambios);
      comprobar("2", `${descripcion}: no guarda y lo dice en "${campo}"`, !guardo(r) && Boolean(errores(r)[campo]));
    }
    comprobar("2", "tras los rechazos, la fila sigue igual", JSON.stringify(await fila(g.gastoId)) === guardadoAntes);
    const aceptan = (await sobresParaGasto()).map((s) => s.tipo);
    comprobar(
      "2",
      "los sobres que se ofrecen para un gasto no incluyen Por asignar ni Deudas",
      !aceptan.includes("por_asignar") && !aceptan.includes("deudas"),
    );

    // ★ 10 · la misma edición dos veces deja lo mismo
    const cambioRepetido = { monto: "12,5", nota: "dos veces" };
    await editar(g.gastoId, cambioRepetido);
    const tras1 = [JSON.stringify(await fila(g.gastoId)), (await estado()).huella];
    const r2 = await editar(g.gastoId, cambioRepetido);
    const tras2 = [JSON.stringify(await fila(g.gastoId)), (await estado()).huella];
    comprobar(
      "10",
      "enviar la misma edición otra vez guarda y deja la fila y los saldos iguales",
      guardo(r2) && tras1[0] === tras2[0] && tras1[1] === tras2[1],
    );

    // ★ 3 · con bolívares: la venta enlazada sigue a la forma de pago
    const vendiendo = { forma: "vendiendo" as const, cuentaOrigen: cuenta(binance) };
    const v = await gasto({ ...vendiendo, monto: "4000", tasa: "40", vendido: "100" });
    comprobar("3", "el gasto vendiendo USDT tiene su venta enlazada", v.ventaId !== null);
    await cuadra("tras registrar el gasto vendiendo USDT");
    const r3a = await editar(v.gastoId, { ...vendiendo, monto: "4500", tasa: "50", vendido: "95" });
    const [g3a, v3a] = [await fila(v.gastoId), await fila(v.ventaId)];
    comprobar(
      "3",
      "vendiendo → vendiendo: la misma venta se actualiza con lo vendido, lo recibido y la tasa nuevos",
      guardo(r3a) &&
        v3a !== null &&
        v3a.montoCentavos === 9500 &&
        v3a.montoDestinoCentavos === 475000 &&
        Number(v3a.tasa) === 50,
      JSON.stringify(v3a && [v3a.montoCentavos, v3a.montoDestinoCentavos, v3a.tasa]),
    );
    comprobar(
      "3",
      "y el gasto, en su misma fila, queda en 4.500 Bs a 50",
      g3a !== null &&
        g3a.montoCentavos === 450000 &&
        g3a.moneda === "VES" &&
        Number(g3a.tasa) === 50 &&
        g3a.montoUsdCentavos === 9000,
    );
    await cuadra("tras recalcular la venta");
    const r3b = await editar(v.gastoId, { forma: "saldo", monto: "4500", tasa: "50" });
    comprobar(
      "3",
      "vendiendo → bolívares del saldo: la venta enlazada se borra y el gasto conserva su id",
      guardo(r3b) && (await fila(v.ventaId)) === null && (await fila(v.gastoId))?.cuentaOrigenId === bolivares.id,
    );
    await cuadra("tras pasar a bolívares del saldo");
    const r3c = await editar(v.gastoId, { ...vendiendo, monto: "4000", tasa: "40", vendido: "100" });
    const ventaNueva = (await deCaptura(v.captura)).find((f) => f.tipo === "transferencia");
    comprobar(
      "3",
      "bolívares del saldo → vendiendo: se crea la venta, enlazada a la misma captura",
      guardo(r3c) &&
        ventaNueva?.referenciaExterna === referenciaDeCaptura(v.captura, "transferencia") &&
        ventaNueva.montoCentavos === 10000 &&
        (await fila(v.gastoId))?.tipo === "gasto",
    );
    await cuadra("tras volver a vender");
    const r3d = await editar(v.gastoId, { monto: "12" });
    comprobar(
      "3",
      "vendiendo → dólares: la venta se borra y el gasto, con su id, queda en dólares",
      guardo(r3d) &&
        (await deCaptura(v.captura)).every((f) => f.tipo === "gasto") &&
        (await fila(v.gastoId))?.cuentaOrigenId === prima.id,
    );
    const r3e = await editar(v.gastoId, { ...vendiendo, monto: "4000", tasa: "40", vendido: "100" });
    comprobar("3", "dólares → vendiendo: se crea la venta", guardo(r3e) && (await deCaptura(v.captura)).length === 2);
    await cuadra("tras los cambios de forma de pago");

    // ★ 9 · nada a medias: si escribir la venta falla, el gasto tampoco cambia
    const antesFalla = [JSON.stringify(await deCaptura(v.captura)), (await estado()).huella];
    let lanzo = false;
    try {
      await editarGasto(
        v.gastoId,
        (guardado) => {
          const plan = planDeEdicionDeGasto(
            guardado,
            entradaGasto({ ...vendiendo, monto: "4800", tasa: "48", vendido: "100" }),
            hoy,
          );
          if (!plan.ok || plan.venta?.accion !== "actualizar") throw new Error("Se esperaba actualizar la venta");
          // Una cuenta que no existe: la base rechaza la venta después de haber escrito el gasto.
          return { ...plan, venta: { ...plan.venta, fila: { ...plan.venta.fila, cuentaDestinoId: 2_147_483_000 } } };
        },
        null,
      );
    } catch {
      lanzo = true;
    }
    const despuesFalla = [JSON.stringify(await deCaptura(v.captura)), (await estado()).huella];
    comprobar(
      "9",
      "si la venta no se puede escribir, el gasto tampoco cambia: nada a medias",
      lanzo && antesFalla[0] === despuesFalla[0] && antesFalla[1] === despuesFalla[1],
    );
    // Dos ediciones a la vez del mismo gasto: gana una entera, nunca el gasto de una con la venta de la otra.
    let mezclas = 0;
    for (const [a, b] of [
      ["40", "50"],
      ["44", "52"],
      ["36", "60"],
    ]) {
      await Promise.all([
        editar(v.gastoId, { ...vendiendo, monto: "3600", tasa: a, vendido: "100" }),
        editar(v.gastoId, { ...vendiendo, monto: "3600", tasa: b, vendido: "100" }),
      ]);
      const filas = await deCaptura(v.captura);
      const gastoF = filas.find((f) => f.tipo === "gasto");
      const ventaF = filas.find((f) => f.tipo === "transferencia");
      if (filas.length !== 2 || Number(gastoF?.tasa) !== Number(ventaF?.tasa)) mezclas++;
    }
    comprobar(
      "9",
      "tres pares de ediciones a la vez: el gasto y su venta siempre de la misma",
      mezclas === 0,
      `${mezclas} mezcladas`,
    );
    await cuadra("tras las ediciones a la vez");

    // ★ 6 · borrar un gasto se lleva su venta
    const antesDeV2 = await estado();
    const v2 = await gasto({ ...vendiendo, monto: "2000", tasa: "40", vendido: "60" });
    const rB = await borrarGasto(v2.gastoId);
    const trasBorrar = await estado();
    comprobar(
      "6",
      "borrar el gasto se lleva el gasto y su venta",
      "ok" in rB && rB.ok && rB.conVenta && (await deCaptura(v2.captura)).length === 0,
    );
    comprobar("6", "la cuenta y el sobre recuperan lo que tenían", trasBorrar.huella === antesDeV2.huella);
    await cuadra("tras borrar el gasto con su venta");
    comprobar(
      "10",
      "borrar un gasto ya borrado responde que no existe, sin error",
      noExiste(await borrarGasto(v2.gastoId)),
    );

    // ★ 4 · editar un ingreso: la diferencia entra o sale de Por asignar, el reparto no cambia
    const eI0 = await estado();
    const i = await ingreso("100", [{ sobreId: planes.id, monto: "30" }]);
    const eI1 = await cuadra("tras registrar el ingreso con su reparto");
    comprobar(
      "4",
      "el ingreso de 100 con 30 a Planes deja 70 en Por asignar",
      enSobre(eI1, porAsignar.id) === enSobre(eI0, porAsignar.id) + 7000 &&
        enSobre(eI1, planes.id) === enSobre(eI0, planes.id) + 3000,
    );
    const repartoAntes = JSON.stringify(i.reparto);
    const rI = await editarIng(
      i.ingresoId,
      { monto: "150", fecha: ayer, nota: "cambiado", categoriaId: (otroIngreso ?? sueldo).id },
      binance,
    );
    const fI = await fila(i.ingresoId);
    const eI2 = await cuadra("tras subir el ingreso");
    comprobar(
      "4",
      "la fila queda con monto, cuenta, categoría, fecha y nota nuevos",
      guardo(rI) &&
        fI?.montoCentavos === 15000 &&
        fI.cuentaDestinoId === binance.id &&
        fI.categoriaId === (otroIngreso ?? sueldo).id &&
        fI.fecha === ayer &&
        fI.nota === "cambiado",
    );
    comprobar(
      "4",
      "la diferencia, 50, entra en Por asignar; Planes no cambia",
      enSobre(eI2, porAsignar.id) === enSobre(eI1, porAsignar.id) + 5000 &&
        enSobre(eI2, planes.id) === enSobre(eI1, planes.id),
    );
    comprobar(
      "4",
      "el dinero sale de la cuenta de antes y entra completo en la nueva",
      enCuenta(eI2, prima.id) === enCuenta(eI0, prima.id) &&
        enCuenta(eI2, binance.id) === enCuenta(eI1, binance.id) + 15000,
    );
    const repartoDespues = JSON.stringify((await deCaptura(i.captura)).filter((f) => f.tipo === "reasignacion"));
    comprobar("4", "su reparto no cambia", repartoAntes === repartoDespues);
    const rIrep = await editarIng(
      i.ingresoId,
      { monto: "150", fecha: ayer, nota: "cambiado", categoriaId: (otroIngreso ?? sueldo).id },
      binance,
    );
    comprobar(
      "10",
      "la misma edición del ingreso otra vez deja lo mismo",
      guardo(rIrep) && (await estado()).huella === eI2.huella,
    );

    // ★ 5 · bajar el ingreso solo si Por asignar alcanza
    await porAsignarEn(2000);
    const antesDeBajar = [(await estado()).huella, JSON.stringify(await fila(i.ingresoId))];
    const rBaja = await editarIng(i.ingresoId, { monto: "100" }, binance);
    comprobar(
      "5",
      "bajar 50 con 20 en Por asignar no guarda y lo dice junto al monto",
      !guardo(rBaja) &&
        errores(rBaja).monto ===
          "Por asignar tiene 20,00; para bajar 50,00, borra el ingreso con su reparto y regístralo de nuevo",
      errores(rBaja).monto,
    );
    comprobar(
      "5",
      "y no cambió nada",
      (await estado()).huella === antesDeBajar[0] && JSON.stringify(await fila(i.ingresoId)) === antesDeBajar[1],
    );
    const rJusto = await editarIng(i.ingresoId, { monto: "130" }, binance);
    comprobar(
      "5",
      "bajar justo lo que hay, 20, sí guarda y deja Por asignar en 0",
      guardo(rJusto) && enSobre(await estado(), porAsignar.id) === 0,
    );
    // Una baja de 15 y un reparto de 10 a la vez, con 20 en Por asignar: solo cabe uno.
    let montoIngreso = 130;
    let rondasMal = 0;
    for (let ronda = 0; ronda < 5; ronda++) {
      await porAsignarEn(2000);
      const [rEd, rRep] = await Promise.all([
        editarIng(i.ingresoId, { monto: String(montoIngreso - 15) }, binance),
        repartir(1000, gastosDelMes.id),
      ]);
      const bajo = guardo(rEd);
      const repartio = "nueva" in rRep && rRep.nueva === true;
      if (bajo) montoIngreso -= 15;
      const saldo = enSobre(await estado(), porAsignar.id);
      if (bajo === repartio || saldo < 0) rondasMal++;
    }
    comprobar(
      "5",
      "cinco carreras de baja contra reparto: siempre gana uno solo y Por asignar nunca baja de 0",
      rondasMal === 0,
      `${rondasMal} mal`,
    );
    await cuadra("tras las carreras de Por asignar");

    // ★ 7 · borrar un ingreso con su reparto
    const antesDeK = await estado();
    const k = await ingreso("100", [
      { sobreId: planes.id, monto: "30" },
      { sobreId: gastosDelMes.id, monto: "20" },
    ]);
    const rK = await borrarIngreso(k.ingresoId);
    comprobar(
      "7",
      "borrar el ingreso se lleva el ingreso y su reparto",
      "ok" in rK && rK.ok && (await deCaptura(k.captura)).length === 0 && k.reparto.length === 2,
    );
    comprobar(
      "7",
      "Por asignar pierde lo que quedó sin repartir y cada sobre devuelve lo suyo",
      (await estado()).huella === antesDeK.huella,
    );
    comprobar(
      "10",
      "borrar un ingreso ya borrado responde que no existe, sin error",
      noExiste(await borrarIngreso(k.ingresoId)),
    );
    // Si lo que quedó sin repartir ya se usó, se retira lo hecho con ese dinero, o no se borra si se prestó (criterio 11
    // de la 007): lo prueba scripts/comprobar-007-retiro.ts.
    // Un sobre que ya gastó lo recibido: la confirmación lo avisa antes, y borrar lo deja en negativo.
    const n = await ingreso("100", [{ sobreId: planes.id, monto: "40" }]);
    const saldoPlanes = enSobre(await estado(), planes.id);
    await gasto({ monto: centavosATexto(saldoPlanes - 1200), sobreId: planes.id });
    const previa = await vistaPreviaDeBorrado((await movimientoParaEditar(n.ingresoId))!);
    comprobar(
      "7",
      'la confirmación avisa antes: "Planes quedará en −28,00"',
      previa !== null && previa.plan.ok && previa.plan.avisos.includes("Planes quedará en −28,00"),
      previa && previa.plan.ok ? previa.plan.avisos.join(" | ") : "",
    );
    const rN = await borrarIngreso(n.ingresoId);
    comprobar(
      "7",
      "y al confirmar se borra, con Planes en −28,00",
      "ok" in rN && rN.ok && enSobre(await estado(), planes.id) === -2800,
    );
    await cuadra("tras borrar ingresos");

    // ★ 8 · solo gastos e ingresos
    const ventaId = (await deCaptura(v.captura)).find((f) => f.tipo === "transferencia")?.id ?? 0;
    const reasignacionId = i.reparto[0]?.id ?? 0;
    const otrosTipos = await db
      .selectDistinctOn([movimientos.tipo], { id: movimientos.id, tipo: movimientos.tipo })
      .from(movimientos)
      .where(not(or(eq(movimientos.tipo, "gasto"), eq(movimientos.tipo, "ingreso"))!));
    const ajenos = [
      { id: ventaId, tipo: "transferencia" },
      { id: reasignacionId, tipo: "reasignacion" },
      ...otrosTipos,
    ];
    let abiertos = 0;
    for (const a of ajenos) if ((await movimientoParaEditar(a.id)) !== null) abiertos++;
    comprobar(
      "8",
      `ningún movimiento de otro tipo se abre para editar: ${[...new Set(ajenos.map((a) => a.tipo))].join(", ")}`,
      abiertos === 0 && ajenos.length >= 2,
    );
    const antesDeAjenos = (await estado()).huella;
    const porId = [
      await editar(ventaId, { monto: "1" }),
      await editarIng(g.gastoId, { monto: "1" }),
      await borrarGasto(i.ingresoId),
      await borrarIngreso(g.gastoId),
      await borrarGasto(reasignacionId),
    ];
    comprobar(
      "8",
      "editar o borrar por id algo de otro tipo responde que no existe y no toca nada",
      porId.every(noExiste) && (await estado()).huella === antesDeAjenos,
    );
    let raros = 0;
    for (const id of [0, -3, 1.5, 2 ** 31, Number.MAX_SAFE_INTEGER + 2]) {
      if ((await movimientoParaEditar(id)) !== null || !noExiste(await borrarGasto(id))) raros++;
    }
    comprobar("8", "ids imposibles (0, negativo, decimal, fuera de integer) no abren ni borran nada", raros === 0);
    const sin = prepararGasto(entradaGasto({ monto: "8" }), hoy);
    if (!sin.ok) throw new Error("prepararGasto rechazó el gasto sin captura");
    const [sinId] = await registrarMovimientos(sin.filas.map((f) => ({ ...f, referenciaExterna: SIN_CAPTURA })));
    const sinM = await movimientoParaEditar(sinId);
    comprobar(
      "8",
      "un gasto sin captura se abre sin venta ni captura",
      sinM !== null && sinM.captura === null && sinM.venta === null,
    );
    const filasAntes = (await estado()).filas;
    const rSinVenta = await editar(sinId, { ...vendiendo, monto: "4000", tasa: "40", vendido: "100" });
    comprobar(
      "8",
      "pasarlo a vendiendo USDT no crea una venta suelta: lo dice y no guarda",
      !guardo(rSinVenta) &&
        /no se registró en la app/.test(errores(rSinVenta).vendido ?? "") &&
        (await estado()).filas === filasAntes,
    );
    const rSin = await editar(sinId, { monto: "9" });
    comprobar(
      "8",
      "editarlo en dólares cambia solo él",
      guardo(rSin) && (await fila(sinId))?.montoCentavos === 900 && (await estado()).filas === filasAntes,
    );
    await cuadra("tras los casos de otros tipos");
  } finally {
    await limpiar();
  }

  const final = await estado();
  comprobar(
    "1",
    "al terminar, la base queda como estaba",
    final.huella === inicial.huella && final.filas === inicial.filas,
  );
  console.log(fallos === 0 ? "\n✓ comprobar-006: todo en verde" : `\n✗ comprobar-006: ${fallos} fallos`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
