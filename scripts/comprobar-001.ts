/**
 * Comprobación contra la base de los criterios ★ de la spec 001 que no caben en una función pura: la venta
 * en una sola transacción, los saldos, el cuadre con la cuenta de la prima, y crear, editar y eliminar
 * categorías. Corre sobre la base local con los datos de demostración y la deja como estaba:
 *   pnpm exec tsx scripts/comprobar-001.ts                  → solo la base
 *   pnpm exec tsx scripts/comprobar-001.ts --url <origen>   → además, las páginas de un servidor en marcha
 * Lo que inserta lleva la referencia "demo-comprobar-001-*" y se borra al terminar; si se corta a medias,
 * pnpm db:demo:limpiar lo borra. Las categorías de prueba se borran por id.
 * Nunca contra una base con datos reales: se niega si encuentra movimientos que no sean de demostración.
 */
import { config } from "dotenv";
import { count, inArray, isNull, like, notLike, or } from "drizzle-orm";
import { type EntradaGasto, type FilaMovimiento, prepararGasto } from "../src/lib/gastos";
import { validarCategoria } from "../src/lib/categorias";
import { hoyEnCaracas } from "../src/lib/fechas";

const REFERENCIA = "demo-comprobar-001";
let fallos = 0;

function comprobar(criterio: string, descripcion: string, ok: boolean, detalle = "") {
  if (!ok) fallos++;
  console.log(`${ok ? "✓" : "✗"} ${criterio} · ${descripcion}${detalle ? ` (${detalle})` : ""}`);
}

/** Compara solo los campos esperados y, si falla, dice cuáles difieren. */
function coincide(criterio: string, descripcion: string, fila: object | undefined, esperado: Record<string, unknown>) {
  const valores = (fila ?? {}) as Record<string, unknown>;
  const diferencias = fila
    ? Object.entries(esperado)
        .filter(([campo, valor]) => valores[campo] !== valor)
        .map(([campo, valor]) => `${campo}: ${JSON.stringify(valores[campo])} en vez de ${JSON.stringify(valor)}`)
    : ["no existe"];
  comprobar(criterio, descripcion, diferencias.length === 0, diferencias.join("; "));
}

async function main() {
  config({ path: ".env.local" });
  const { db, categorias, movimientos } = await import("../src/db/index");
  const { registrarMovimientos } = await import("../src/db/movimientos");
  const { saldosPorCuenta, saldosPorSobre, categoriasDeGastoPorUso, movimientosRecientes } =
    await import("../src/db/consultas");
  const { categoriasConUso, crearCategoria, actualizarCategoria, eliminarCategoria } =
    await import("../src/db/categorias");
  const posicionUrl = process.argv.indexOf("--url");
  const url = posicionUrl > 0 ? process.argv[posicionUrl + 1] : null;

  // Solo con datos de demostración: el script escribe y borra.
  const [{ reales }] = await db
    .select({ reales: count() })
    .from(movimientos)
    .where(or(isNull(movimientos.referenciaExterna), notLike(movimientos.referenciaExterna, "demo-%")));
  if (reales > 0) throw new Error(`Hay ${reales} movimientos que no son de demostración. No se toca esta base.`);

  async function estado() {
    const [c, s] = await Promise.all([saldosPorCuenta(), saldosPorSobre()]);
    const [{ filas }] = await db.select({ filas: count() }).from(movimientos);
    const [{ cats }] = await db.select({ cats: count() }).from(categorias);
    return {
      cuentas: c,
      sobres: s,
      totalCuentas: c.reduce((a, x) => a + x.saldoUsdCentavos, 0),
      totalSobres: s.reduce((a, x) => a + x.saldoCentavos, 0),
      filas,
      cats,
    };
  }
  type Estado = Awaited<ReturnType<typeof estado>>;
  const saldo = (e: Estado, id: number) => e.cuentas.find((c) => c.id === id)?.saldoCentavos ?? NaN;
  const huella = (e: Estado) =>
    JSON.stringify([e.cuentas.map((c) => [c.id, c.saldoCentavos]), e.sobres.map((s) => [s.id, s.saldoCentavos])]);

  async function pagina(ruta: string) {
    const respuesta = await fetch(`${url}${ruta}`);
    return { estado: respuesta.status, html: await respuesta.text() };
  }

  const inicial = await estado();
  const cuenta = (nombre: string) => {
    const c = inicial.cuentas.find((x) => x.nombre === nombre);
    if (!c) throw new Error(`Falta la cuenta ${nombre}: corre pnpm db:seed`);
    return c;
  };
  const [binance, bolivares, prima] = [cuenta("Binance"), cuenta("Bolívares"), cuenta("Cuenta prima")];
  const gastosDelMes = inicial.sobres.find((s) => s.nombre === "Gastos del mes");
  const deGasto = await categoriasDeGastoPorUso();
  const [comida, transporte] = [
    deGasto.find((c) => c.nombre === "Comida"),
    deGasto.find((c) => c.nombre === "Transporte"),
  ];
  if (!gastosDelMes || !comida || !transporte) throw new Error("Faltan sobres o categorías base: corre pnpm db:seed");
  const porDefecto = { sobreId: gastosDelMes.id, categoriaId: comida.id };

  const hoy = hoyEnCaracas(new Date());
  let n = 0;
  const categoriasCreadas: number[] = [];

  function preparar(cambios: Partial<EntradaGasto>): FilaMovimiento[] {
    const entrada: EntradaGasto = {
      forma: "dolares",
      monto: "",
      tasa: "",
      vendido: "",
      cuentaOrigen: { id: binance.id, moneda: binance.moneda },
      cuentaBolivares: { id: bolivares.id, moneda: bolivares.moneda },
      ...porDefecto,
      fecha: hoy,
      nota: "",
      ...cambios,
    };
    const preparado = prepararGasto(entrada, hoy);
    if (!preparado.ok) throw new Error(`prepararGasto rechazó ${JSON.stringify(cambios)}`);
    return preparado.filas;
  }
  const marcar = (filas: FilaMovimiento[]) => filas.map((f) => ({ ...f, referenciaExterna: `${REFERENCIA}-${++n}` }));
  const guardar = async (cambios: Partial<EntradaGasto>) => leer(await registrarMovimientos(marcar(preparar(cambios))));
  const leer = (ids: number[]) => db.select().from(movimientos).where(inArray(movimientos.id, ids));
  const deTipo = (filas: Awaited<ReturnType<typeof leer>>, tipo: string) => filas.find((f) => f.tipo === tipo);

  console.log(`Base local · hoy en Caracas ${hoy} · ${inicial.filas} movimientos, ${inicial.cats} categorías`);
  comprobar(
    "16",
    "al empezar, la suma de sobres es igual a la suma en USD de todas las cuentas activas",
    inicial.totalCuentas === inicial.totalSobres,
    `sobres ${inicial.totalSobres}, cuentas ${inicial.totalCuentas}`,
  );

  try {
    // ★ 1 · gasto en dólares
    const [g1, ...resto1] = await guardar({ monto: "42" });
    coincide(
      "1",
      "un gasto de 4200 USDT que vale 4200 USD, de Binance, Gastos del mes y Comida, manual, sin tasa",
      g1,
      {
        tipo: "gasto",
        fecha: hoy,
        montoCentavos: 4_200,
        moneda: "USDT",
        montoUsdCentavos: 4_200,
        cuentaOrigenId: binance.id,
        sobreOrigenId: gastosDelMes.id,
        categoriaId: comida.id,
        origen: "manual",
        tasa: null,
      },
    );
    comprobar("1", "es un solo movimiento", resto1.length === 0);
    const tras1 = await estado();
    comprobar("1", "el cuadre se mantiene", tras1.totalCuentas === tras1.totalSobres, `${tras1.totalSobres}`);

    // ★ 2 · bolívares vendiendo USDT
    const venta = { forma: "vendiendo", vendido: "20", tasa: "241,8", monto: "2100" } as const;
    const filas2 = await guardar(venta);
    const [t2, g2] = [deTipo(filas2, "transferencia"), deTipo(filas2, "gasto")];
    comprobar("2", "dos movimientos con la misma fecha", filas2.length === 2 && t2?.fecha === hoy && g2?.fecha === hoy);
    coincide("2", "transferencia de 20 USDT de Binance a Bolívares: 483600 centavos de Bs a 241.8000", t2, {
      cuentaOrigenId: binance.id,
      cuentaDestinoId: bolivares.id,
      montoCentavos: 2_000,
      moneda: "USDT",
      montoUsdCentavos: 2_000,
      montoDestinoCentavos: 483_600,
      monedaDestino: "VES",
      tasa: "241.8000",
    });
    coincide("2", "gasto de 2100 Bs desde Bolívares que vale 868 centavos USD, Gastos del mes y Comida", g2, {
      cuentaOrigenId: bolivares.id,
      montoCentavos: 210_000,
      moneda: "VES",
      montoUsdCentavos: 868,
      tasa: "241.8000",
      sobreOrigenId: gastosDelMes.id,
      categoriaId: comida.id,
    });
    const tras2 = await estado();
    const vuelto = saldo(tras2, bolivares.id) - saldo(tras1, bolivares.id);
    comprobar("2", "Bolívares recibe 273600 centavos de Bs de vuelto", vuelto === 273_600, `${vuelto}`);
    comprobar("2", "el cuadre se mantiene", tras2.totalCuentas === tras2.totalSobres, `${tras2.totalSobres}`);
    // Una sola transacción: si el gasto no entra (la base exige un valor en USD positivo), la venta tampoco.
    const lote = marcar(preparar(venta)).map((f) => (f.tipo === "gasto" ? { ...f, montoUsdCentavos: 0 } : f));
    let rechazado = false;
    try {
      await registrarMovimientos(lote);
    } catch {
      rechazado = true; // lo esperado: el check de la base rechaza el gasto
    }
    const [{ quedaron }] = await db
      .select({ quedaron: count() })
      .from(movimientos)
      .where(
        inArray(
          movimientos.referenciaExterna,
          lote.map((f) => f.referenciaExterna),
        ),
      );
    comprobar(
      "2",
      "una sola transacción: con el gasto inválido no queda ni la transferencia",
      rechazado && quedaron === 0,
    );

    // ★ 3 · bolívares del saldo
    const filas3 = await guardar({ forma: "saldo", monto: "500", tasa: "241,8", categoriaId: transporte.id });
    comprobar("3", "es un solo movimiento", filas3.length === 1);
    coincide("3", "gasto de 500 Bs desde Bolívares que vale 207 centavos USD, en Transporte", filas3[0], {
      tipo: "gasto",
      cuentaOrigenId: bolivares.id,
      montoCentavos: 50_000,
      moneda: "VES",
      montoUsdCentavos: 207,
      tasa: "241.8000",
      categoriaId: transporte.id,
    });

    // ★ 4 · más bolívares gastados que recibidos
    const tras3 = await estado();
    const filas4 = await guardar({ forma: "vendiendo", vendido: "10", tasa: "240", monto: "2500" });
    coincide("4", "el gasto se registra completo: 250000 centavos de Bs, 1042 centavos USD", deTipo(filas4, "gasto"), {
      montoCentavos: 250_000,
      montoUsdCentavos: 1_042,
    });
    const tras4 = await estado();
    const cambio4 = saldo(tras4, bolivares.id) - saldo(tras3, bolivares.id);
    comprobar(
      "4",
      "Bolívares baja 10000 centavos de Bs: desde cero queda en −10000",
      cambio4 === -10_000,
      `${cambio4}`,
    );

    // ★ 16 · cuenta de la prima
    const [g16] = await guardar({ monto: "42", cuentaOrigen: { id: prima.id, moneda: prima.moneda } });
    coincide("16", "el gasto desde la Cuenta prima se registra como desde cualquier otra", g16, {
      tipo: "gasto",
      cuentaOrigenId: prima.id,
      montoCentavos: 4_200,
      moneda: prima.moneda,
      montoUsdCentavos: 4_200,
    });
    const tras16 = await estado();
    comprobar("16", "su saldo entra en el total de cuentas", tras16.totalCuentas - tras4.totalCuentas === -4_200);
    comprobar("16", "y el cuadre se mantiene", tras16.totalCuentas === tras16.totalSobres, `${tras16.totalSobres}`);
    comprobar("16", "la cuenta conserva su marca: no es propia", prima.esPropia === false);
    if (url) {
      const cuentas = await pagina("/cuentas");
      comprobar("16", "/cuentas dice «Cuadra con los sobres»", cuentas.html.includes("Cuadra con los sobres"));
      comprobar("16", "/cuentas muestra «a nombre de mi prima»", cuentas.html.includes("a nombre de mi prima"));
      comprobar(
        "16",
        "el inicio muestra «A nombre de mi prima»",
        (await pagina("/")).html.includes("A nombre de mi prima"),
      );
      const captura = await pagina("/nuevo/gasto");
      comprobar(
        "16",
        "el selector de cuenta muestra «a nombre de mi prima»",
        captura.html.includes("a nombre de mi prima"),
      );
      comprobar("18", "antes de crearla, Mascotas no está en la captura", !captura.html.includes("Mascotas"));
    }

    // ★ 18 · crear
    const mascotas = { nombre: "Mascotas", tipo: "gasto", icono: "huella", color: "lavanda" } as const;
    const validada = validarCategoria(mascotas, await categoriasConUso());
    if (!validada.ok) throw new Error(`Mascotas no se puede crear: ${JSON.stringify(validada.errores)}`);
    const idMascotas = await crearCategoria(validada.valores);
    categoriasCreadas.push(idMascotas);
    const creada = (await categoriasConUso()).find((c) => c.id === idMascotas);
    coincide("18", "existe Mascotas, de gasto, activa, con icono huella y color lavanda", creada, {
      ...mascotas,
      activa: true,
    });
    comprobar(
      "18",
      "aparece en las píldoras de la captura",
      (await categoriasDeGastoPorUso()).some((c) => c.id === idMascotas),
    );
    if (url) {
      comprobar("18", "/categorias la muestra", (await pagina("/categorias")).html.includes("Mascotas"));
      comprobar("18", "/nuevo/gasto la muestra", (await pagina("/nuevo/gasto")).html.includes("Mascotas"));
    }

    // ★ 20 · editar
    const movsMascotas = [
      ...(await guardar({ monto: "15", categoriaId: idMascotas })),
      ...(await guardar({ monto: "8", categoriaId: idMascotas })),
    ];
    const nuevos = { nombre: "Mascota y veterinario", tipo: "gasto", icono: "salud", color: "turquesa" } as const;
    const editada = await actualizarCategoria(idMascotas, nuevos);
    coincide(
      "20",
      "cambian el nombre, el icono y el color",
      (await categoriasConUso()).find((c) => c.id === idMascotas),
      {
        ...nuevos,
        activa: true,
      },
    );
    comprobar("20", "la operación responde «actualizada»", editada === "actualizada", editada);
    const releidos = await leer(movsMascotas.map((m) => m.id));
    comprobar(
      "20",
      "sus movimientos siguen en la misma fila",
      releidos.every((m) => m.categoriaId === idMascotas),
    );
    const recientes = await movimientosRecientes();
    comprobar(
      "20",
      "y muestran el nombre nuevo",
      movsMascotas.every((m) => recientes.find((r) => r.id === m.id)?.categoria === nuevos.nombre),
    );
    const aIngreso = await actualizarCategoria(idMascotas, { ...nuevos, tipo: "ingreso" });
    const sigue = (await categoriasConUso()).find((c) => c.id === idMascotas);
    comprobar("20", "con movimientos el tipo no cambia", aIngreso === "tipo-fijo" && sigue?.tipo === "gasto", aIngreso);
    const idSinMovimientos = await crearCategoria({
      nombre: "Comprobación 001",
      tipo: "gasto",
      icono: "etiqueta",
      color: "pizarra",
    });
    categoriasCreadas.push(idSinMovimientos);
    const cambiaTipo = await actualizarCategoria(idSinMovimientos, {
      nombre: "Comprobación 001",
      tipo: "ingreso",
      icono: "etiqueta",
      color: "pizarra",
    });
    const sinMovs = (await categoriasConUso()).find((c) => c.id === idSinMovimientos);
    comprobar("20", "sin movimientos el tipo sí cambia", cambiaTipo === "actualizada" && sinMovs?.tipo === "ingreso");
    if (url)
      comprobar(
        "20",
        "/movimientos muestra el nombre nuevo",
        (await pagina("/movimientos")).html.includes(nuevos.nombre),
      );

    // ★ 21 · eliminar
    if (url) {
      const edicion = await pagina(`/categorias/${idMascotas}`);
      const aviso = "Tiene 2 movimientos: se archivará, no se borra";
      comprobar("21", `antes de confirmar, la edición dice «${aviso}»`, edicion.html.includes(aviso));
      const sinAviso = await pagina(`/categorias/${idSinMovimientos}`);
      comprobar(
        "21",
        "y sin movimientos dice que se borrará",
        sinAviso.html.includes("No tiene movimientos: se borrará"),
      );
    }
    const borrada = await eliminarCategoria(idSinMovimientos);
    const yaNoEsta = !(await categoriasConUso()).some((c) => c.id === idSinMovimientos);
    comprobar("21", "sin movimientos se borra", borrada === "borrada" && yaNoEsta, borrada);
    const archivada = await eliminarCategoria(idMascotas);
    const fila = (await categoriasConUso()).find((c) => c.id === idMascotas);
    comprobar(
      "21",
      "con movimientos se archiva, no se borra",
      archivada === "archivada" && fila?.activa === false,
      archivada,
    );
    comprobar("21", "desaparece de la captura", !(await categoriasDeGastoPorUso()).some((c) => c.id === idMascotas));
    const conservan = await leer(movsMascotas.map((m) => m.id));
    comprobar(
      "21",
      "sus movimientos la conservan",
      conservan.length === 2 && conservan.every((m) => m.categoriaId === idMascotas),
    );
    if (url)
      comprobar("21", "/nuevo/gasto ya no la ofrece", !(await pagina("/nuevo/gasto")).html.includes(nuevos.nombre));
  } finally {
    await db.delete(movimientos).where(like(movimientos.referenciaExterna, `${REFERENCIA}-%`));
    if (categoriasCreadas.length > 0) await db.delete(categorias).where(inArray(categorias.id, categoriasCreadas));
    const final = await estado();
    comprobar(
      "—",
      "la base queda como estaba: mismos saldos, movimientos y categorías",
      huella(final) === huella(inicial) && final.filas === inicial.filas && final.cats === inicial.cats,
      `${final.filas} movimientos, ${final.cats} categorías`,
    );
  }
}

main()
  .then(() => {
    console.log(fallos === 0 ? "✓ comprobar-001: todo en verde" : `✗ comprobar-001: ${fallos} comprobaciones fallaron`);
    process.exit(fallos === 0 ? 0 : 1);
  })
  .catch((error) => {
    console.error("✗ comprobar-001:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
