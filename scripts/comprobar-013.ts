/**
 * Los criterios ★ de la spec 013 (administrar cuentas) contra la base:
 *   ★ 2 · crear una cuenta la deja en 0, al final, y el cuadre no cambia;
 *   ★ 5 · con movimientos la moneda no cambia, tampoco llamando a la base directo;
 *   ★ 7 · con saldo no se elimina;
 *   ★ 8 · en 0 y sin usos se borra;
 *   ★ 9 · en 0 y con historial se archiva y deja de salir en Cuentas;
 *   ★ 10 · si el saldo de una archivada deja de ser 0, vuelve a salir en Cuentas y el cuadre sigue diciendo la verdad.
 * Los ★ 3 y 5 de la validación están en src/lib/cuentas.test.ts. Con --url, además, contra un servidor en marcha con
 * esta misma base y el usuario de prueba, como un navegador sin JavaScript: crear con icono y color, el nombre
 * repetido, y eliminar desde la pantalla.
 *   pnpm exec tsx scripts/comprobar-013.ts [--url http://localhost:3000]
 * Corre sobre la base local y la deja como estaba: sus cuentas se llaman "Prueba 013…" y sus movimientos llevan la
 * referencia captura-0c013013-…; se borran al terminar y, si una corrida se cortó, al empezar la siguiente.
 */
import { config } from "dotenv";
import { eq, like } from "drizzle-orm";
import { exigirBaseLocal } from "../src/lib/destino-base";
import { hoyEnCaracas } from "../src/lib/fechas";
import { abrirSesion, texto } from "./comprobar-003-paginas";

const MARCA = "captura-0c013013-";
let fallos = 0;

function comprobar(criterio: string, descripcion: string, ok: boolean, detalle = "") {
  if (!ok) fallos++;
  console.log(`${ok ? "✓" : "✗"} ${criterio} · ${descripcion}${detalle ? ` (${detalle})` : ""}`);
}

async function main() {
  config({ path: ".env.local" });
  // Escribe filas: solo en la base local (spec 002, criterio 10).
  exigirBaseLocal(process.env.DATABASE_URL, "comprobar-013");
  const posicionUrl = process.argv.indexOf("--url");
  const origenUrl = posicionUrl >= 0 ? process.argv[posicionUrl + 1] : null;
  const { db, categorias, cuentas, movimientos, sobres } = await import("../src/db/index");
  const { saldosPorCuenta, saldosPorSobre } = await import("../src/db/consultas");
  const { actualizarCuenta, crearCuenta, cuentaPorId, eliminarCuenta } = await import("../src/db/cuentas");

  const limpiar = async () => {
    await db.delete(movimientos).where(like(movimientos.referenciaExterna, `${MARCA}%`));
    await db.delete(cuentas).where(like(cuentas.nombre, "Prueba 013%"));
  };
  await limpiar();

  /** Lo que muestra Cuentas: la lista, y si cuadra con los sobres. */
  const cuadre = async () => {
    const [lista, deSobres] = await Promise.all([saldosPorCuenta(), saldosPorSobre()]);
    const enCuentas = lista.reduce((a, c) => a + c.saldoUsdCentavos, 0);
    const enSobres = deSobres.reduce((a, s) => a + s.saldoCentavos, 0);
    return { lista, enCuentas, enSobres, cuadra: enCuentas === enSobres };
  };

  try {
    const antes = await cuadre();
    const valores = { moneda: "USD", tipo: "billetera", icono: "tarjeta", color: "rosa" } as const;

    const nueva = await crearCuenta({ nombre: "Prueba 013 a", ...valores });
    const tras = await cuadre();
    const fila = tras.lista.find((c) => c.id === nueva);
    comprobar(
      "2",
      "crear deja la cuenta en 0, al final de la lista, con su icono y color, y el cuadre no cambia",
      fila?.saldoCentavos === 0 &&
        tras.lista.at(-1)?.id === nueva &&
        fila.icono === "tarjeta" &&
        fila.color === "rosa" &&
        tras.enCuentas === antes.enCuentas &&
        tras.enSobres === antes.enSobres &&
        tras.cuadra === antes.cuadra,
    );

    const [porAsignar] = await db.select().from(sobres).where(eq(sobres.tipo, "por_asignar"));
    const [ingreso] = await db.select().from(categorias).where(eq(categorias.tipo, "ingreso")).limit(1);
    const [gasto] = await db.select().from(categorias).where(eq(categorias.tipo, "gasto")).limit(1);
    const comun = {
      fecha: hoyEnCaracas(new Date()),
      moneda: "USD" as const,
      montoCentavos: 1_000,
      montoUsdCentavos: 1_000,
    };
    await db.insert(movimientos).values({
      ...comun,
      tipo: "ingreso",
      cuentaDestinoId: nueva,
      sobreDestinoId: porAsignar.id,
      categoriaId: ingreso.id,
      referenciaExterna: `${MARCA}ingreso`,
    });
    comprobar("7", "con saldo (10,00) no se elimina", (await eliminarCuenta(nueva)) === "con-saldo");
    comprobar(
      "5",
      "con movimientos, cambiar la moneda en la base devuelve moneda-fija y no cambia",
      (await actualizarCuenta(nueva, { nombre: "Prueba 013 a", ...valores, moneda: "VES" })) === "moneda-fija" &&
        (await cuentaPorId(nueva))?.moneda === "USD",
    );

    const [salida] = await db
      .insert(movimientos)
      .values({
        ...comun,
        tipo: "gasto",
        cuentaOrigenId: nueva,
        sobreOrigenId: porAsignar.id,
        categoriaId: gasto.id,
        referenciaExterna: `${MARCA}gasto`,
      })
      .returning({ id: movimientos.id });
    const archivada = await eliminarCuenta(nueva);
    const sinElla = await cuadre();
    comprobar(
      "9",
      "en 0 y con historial se archiva, sale de Cuentas, y sus movimientos la conservan",
      archivada === "archivada" &&
        (await cuentaPorId(nueva))?.activa === false &&
        !sinElla.lista.some((c) => c.id === nueva) &&
        (await db.select().from(movimientos).where(eq(movimientos.cuentaOrigenId, nueva))).length === 1 &&
        sinElla.cuadra === antes.cuadra,
    );

    // Editar el gasto viejo (como desde Movimientos): la archivada vuelve a tener 1,00.
    await db
      .update(movimientos)
      .set({ montoCentavos: 900, montoUsdCentavos: 900 })
      .where(eq(movimientos.id, salida.id));
    const reaparece = await cuadre();
    const vuelta = reaparece.lista.find((c) => c.id === nueva);
    comprobar(
      "10",
      "si su saldo deja de ser 0, la archivada vuelve a Cuentas marcada y el cuadre sigue igual que antes",
      vuelta?.activa === false &&
        vuelta.saldoUsdCentavos === 100 &&
        reaparece.cuadra === antes.cuadra &&
        reaparece.enCuentas - reaparece.enSobres === antes.enCuentas - antes.enSobres,
      `cuentas ${reaparece.enCuentas}, sobres ${reaparece.enSobres}`,
    );

    const vacia = await crearCuenta({ nombre: "Prueba 013 b", ...valores });
    comprobar(
      "8",
      "en 0 y sin usos se borra del todo",
      (await eliminarCuenta(vacia)) === "borrada" && (await cuentaPorId(vacia)) === null,
    );

    if (origenUrl) {
      console.log(`— páginas, contra ${origenUrl}`);
      const sesion = await abrirSesion(origenUrl);
      const formularios = (html: string) => [...html.matchAll(/<form[\s\S]*?<\/form>/g)].map((m) => m[0]);
      const ocultos = (form: string) => {
        const datos = new FormData();
        for (const m of form.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
          const nombre = /name="([^"]*)"/.exec(m[0])?.[1];
          if (nombre) datos.set(nombre, texto(/value="([^"]*)"/.exec(m[0])?.[1] ?? ""));
        }
        return datos;
      };
      try {
        const pagina = await sesion.pagina("/cuentas/nueva");
        const form = formularios(pagina.html).find((f) => f.includes('name="nombre"')) ?? "";
        comprobar(
          "1",
          "Nueva cuenta tiene nombre, moneda, tipo, icono y color",
          pagina.estado === 200 &&
            ["nombre", "moneda", "tipo", "icono", "color"].every((n) => form.includes(`name="${n}"`)) &&
            texto((await sesion.pagina("/cuentas")).html).includes("Nueva cuenta"),
        );
        const datos = ocultos(form);
        for (const [k, v] of Object.entries({ nombre: "Prueba 013 web", ...valores, color: "lavanda" }))
          datos.set(k, v);
        const r = await sesion.enviar("/cuentas/nueva", datos);
        const lista = await sesion.pagina("/cuentas");
        const filaWeb = /<a[^>]*href="\/cuentas\/(\d+)"[^>]*>(?:(?!<\/a>)[\s\S])*Prueba 013 web[\s\S]*?<\/a>/.exec(
          lista.html,
        );
        comprobar(
          "2",
          "sin JavaScript, crear vuelve a Cuentas y la fila lleva su color elegido y enlace a editar",
          r.estado === 303 && r.ubicacion === "/cuentas" && filaWeb !== null && filaWeb[0].includes("bg-cat-lavanda"),
          `${r.estado} ${r.ubicacion}`,
        );
        const repetida = await sesion.enviar("/cuentas/nueva", datos);
        comprobar(
          "3",
          "el mismo nombre otra vez no se guarda y lo dice",
          texto(repetida.html).includes("Ya existe una cuenta con ese nombre"),
        );
        const idWeb = filaWeb?.[1] ?? "0";
        const editar = await sesion.pagina(`/cuentas/${idWeb}`);
        const borrar = formularios(editar.html).find((f) => f.includes("Sí, eliminar")) ?? "";
        const eliminada = await sesion.enviar(`/cuentas/${idWeb}`, ocultos(borrar));
        comprobar(
          "8",
          "sin JavaScript, eliminar una cuenta en 0 sin movimientos la borra y vuelve a Cuentas",
          texto(editar.html).includes("se borrará del todo") &&
            eliminada.estado === 303 &&
            (await cuentaPorId(Number(idWeb))) === null,
          `${eliminada.estado} ${eliminada.ubicacion}`,
        );
      } finally {
        await sesion.salir();
      }
    }
  } finally {
    await limpiar();
  }

  console.log(fallos === 0 ? "\nTodo en verde." : `\n${fallos} criterio(s) en rojo.`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
