/**
 * Los criterios de la spec 015 (dividir Inversión en largo plazo y negocios) contra la base local, corriendo el script
 * de verdad (`src/db/dividir-inversion.ts`) y la semilla:
 *   ★ 1 · sin terminal, el script solo muestra lo que haría y no cambia nada;
 *   ★ 2 · aplicado: el nombre, Negocios en 0, la regla partida con el mismo total, y ningún saldo ni el cuadre cambian;
 *   ★ 3 · aplicado otra vez: "ya está dividido" y nada cambia;
 *   ★ 5 · un reparto de 1.000 USD: lo que iba a Inversión se parte en dos, con el mismo total;
 *   6 · Negocios es libre: se le carga un gasto, se aparta y se paga desde él, y su regla se edita;
 *   ★ 8 · la semilla, antes y después de dividir, no crea ni duplica ningún sobre ni regla.
 * Con --url, además, contra un servidor en marcha con esta misma base: Sobres y Reglas de reparto muestran Negocios.
 *   pnpm exec tsx scripts/comprobar-015.ts [--url http://localhost:3000]
 * Deja la base como estaba: si al empezar no estaba dividida, al terminar borra Negocios y su regla y le devuelve a
 * Inversión su nombre, su nota y su regla. Se niega si Negocios tiene movimientos.
 */
import { config } from "dotenv";
import { spawnSync } from "node:child_process";
import { and, count, eq, or } from "drizzle-orm";
import { puedeApartarDesde } from "../src/lib/apartado";
import { sobreAceptaPago } from "../src/lib/deudas";
import { exigirBaseLocal } from "../src/lib/destino-base";
import { sobreAceptaGasto } from "../src/lib/gastos";
import { reglaEditable } from "../src/lib/reglas";
import { proponerReparto } from "../src/lib/reparto";
import { abrirSesion, texto } from "./comprobar-003-paginas";

let fallos = 0;

function comprobar(criterio: string, descripcion: string, ok: boolean, detalle = "") {
  if (!ok) fallos++;
  console.log(`${ok ? "✓" : "✗"} ${criterio} · ${descripcion}${detalle ? ` (${detalle})` : ""}`);
}

/** Corre un comando del repo sin terminal (stdin no es TTY) y devuelve lo que imprimió. */
function correr(...argumentos: string[]) {
  const r = spawnSync("pnpm", ["exec", "tsx", ...argumentos], { encoding: "utf8", shell: true, stdio: "pipe" });
  return { codigo: r.status, salida: `${r.stdout}${r.stderr}` };
}

async function main() {
  config({ path: ".env.local" });
  // Escribe filas: solo en la base local (spec 002, criterio 10).
  exigirBaseLocal(process.env.DATABASE_URL, "comprobar-015");
  const posicionUrl = process.argv.indexOf("--url");
  const origenUrl = posicionUrl >= 0 ? process.argv[posicionUrl + 1] : null;
  const { db, movimientos, reglasReparto, sobres } = await import("../src/db/index");
  const { saldosPorCuenta, saldosPorSobre, sobresParaGasto } = await import("../src/db/consultas");

  /** Sobres y reglas tal cual, los saldos y el cuadre: lo que no debe cambiar salvo lo que la spec dice. */
  const foto = async () => {
    const [s, r, c, ss] = await Promise.all([
      db.select().from(sobres).orderBy(sobres.id),
      db.select().from(reglasReparto).orderBy(reglasReparto.id),
      saldosPorCuenta(),
      saldosPorSobre(),
    ]);
    return {
      sobres: s,
      reglas: r,
      saldos: JSON.stringify([c.map((x) => [x.id, x.saldoCentavos]), ss.map((x) => [x.id, x.saldoCentavos])]),
      cuadra: c.reduce((a, x) => a + x.saldoUsdCentavos, 0) === ss.reduce((a, x) => a + x.saldoCentavos, 0),
    };
  };
  type Foto = Awaited<ReturnType<typeof foto>>;
  const sinFechas = (f: Foto) => JSON.stringify({ s: f.sobres, r: f.reglas.map(({ creadoEn: _, ...x }) => x) });
  const reparto = (f: Foto) =>
    proponerReparto({
      monto: 100_000,
      reglas: f.reglas
        .filter((r) => r.activa)
        .map((r) => ({ ...r, topeCentavos: f.sobres.find((s) => s.id === r.sobreId)?.topeCentavos ?? null })),
      recibidoEnElMes: {},
      saldos: {},
    });
  const recibe = (p: ReturnType<typeof reparto>, sobreId: number | undefined) =>
    p.asignaciones.filter((a) => a.sobreId === sobreId).reduce((x, a) => x + a.centavos, 0);

  const inicial = await foto();
  const inversion = inicial.sobres.find((s) => s.tipo === "inversion");
  if (!inversion) throw new Error("No hay sobre de inversión: corre pnpm db:seed.");
  const yaDividida = inicial.sobres.some((s) => s.tipo === "negocios");
  const reglaInicial = inicial.reglas.find((r) => r.sobreId === inversion.id && r.activa);
  if (yaDividida) console.log("La base ya estaba dividida: solo se comprueba que nada cambie al repetir.");

  try {
    if (!yaDividida) {
      // ★ 8, antes de dividir: la semilla no crea Negocios ni toca la regla de Inversión.
      const semilla = correr("src/db/seed.ts");
      comprobar(
        "8",
        "la semilla en una base sin dividir no crea Negocios ni cambia nada",
        semilla.codigo === 0 && sinFechas(await foto()) === sinFechas(inicial),
        semilla.codigo === 0 ? "" : semilla.salida.slice(-300),
      );

      // ★ 1: sin terminal, solo muestra.
      const vista = correr("src/db/dividir-inversion.ts");
      comprobar(
        "1",
        "sin terminal muestra el cambio (nombre, Negocios, reglas) y no escribe nada",
        vista.codigo === 0 &&
          vista.salida.includes("Inversión a largo plazo") &&
          vista.salida.includes("Negocios") &&
          vista.salida.includes("Sin terminal solo se muestra") &&
          sinFechas(await foto()) === sinFechas(inicial),
        vista.codigo === 0 ? "" : vista.salida.slice(-300),
      );

      // ★ 2: aplicado.
      const hecho = correr("src/db/dividir-inversion.ts", "--aplicar");
      const tras = await foto();
      const largo = tras.sobres.find((s) => s.id === inversion.id);
      const negocios = tras.sobres.find((s) => s.tipo === "negocios");
      const reglaLargo = tras.reglas.find((r) => r.sobreId === inversion.id && r.activa);
      const reglaNegocios = tras.reglas.find((r) => r.sobreId === negocios?.id && r.activa);
      const saldoNegocios = (await saldosPorSobre()).find((s) => s.id === negocios?.id)?.saldoCentavos;
      comprobar(
        "2",
        "aplicado: «Inversión a largo plazo», Negocios en 0 y libre, reglas 2/3 y 1/3 con el mismo total",
        hecho.codigo === 0 &&
          largo?.nombre === (inversion.nombre === "Inversión" ? "Inversión a largo plazo" : inversion.nombre) &&
          negocios?.nombre === "Negocios" &&
          saldoNegocios === 0 &&
          (!reglaInicial ||
            (reglaLargo !== undefined &&
              reglaNegocios !== undefined &&
              reglaLargo.valor + reglaNegocios.valor === reglaInicial.valor &&
              Math.abs(reglaNegocios.valor * 3 - reglaInicial.valor) <= 1)),
        `${reglaInicial?.valor} → ${reglaLargo?.valor} + ${reglaNegocios?.valor}`,
      );
      comprobar(
        "2",
        "ningún saldo de sobre ni de cuenta cambió, y el cuadre sigue igual",
        tras.saldos.replace(/,\[\d+,0\]/g, "") === inicial.saldos.replace(/,\[\d+,0\]/g, "") &&
          tras.cuadra === inicial.cuadra,
      );

      // ★ 5: el reparto.
      const antesReparto = reparto(inicial);
      const despuesReparto = reparto(tras);
      const iba = recibe(antesReparto, inversion.id);
      const ahoraLargo = recibe(despuesReparto, inversion.id);
      const ahoraNegocios = recibe(despuesReparto, negocios?.id);
      comprobar(
        "5",
        "un reparto de 1.000 USD: lo que iba a Inversión se parte 2/3 y 1/3 con el mismo total",
        iba > 0 && Math.abs(ahoraLargo + ahoraNegocios - iba) <= 1 && Math.abs(ahoraNegocios * 3 - iba) <= 3,
        `${iba} → ${ahoraLargo} + ${ahoraNegocios}`,
      );

      // 6: libre.
      comprobar(
        "6",
        "Negocios acepta gastos, pagos de deuda y apartar, y su regla se edita; Inversión sigue sin apartar",
        sobreAceptaGasto("negocios") &&
          sobreAceptaPago("negocios") &&
          puedeApartarDesde("negocios") &&
          reglaEditable("negocios") &&
          !puedeApartarDesde("inversion") &&
          (await sobresParaGasto()).some((s) => s.id === negocios?.id),
      );
    }

    // ★ 3: otra vez.
    const antes = await foto();
    const otraVez = correr("src/db/dividir-inversion.ts", "--aplicar");
    comprobar(
      "3",
      "aplicado otra vez dice que ya está dividido y no cambia nada",
      otraVez.codigo === 0 &&
        otraVez.salida.includes("Ya está dividido") &&
        sinFechas(await foto()) === sinFechas(antes),
    );

    // ★ 8, después de dividir: la semilla reconoce los sobres por su tipo.
    const semilla = correr("src/db/seed.ts");
    comprobar(
      "8",
      "la semilla en una base dividida no duplica Inversión ni Negocios ni sus reglas",
      semilla.codigo === 0 && sinFechas(await foto()) === sinFechas(antes),
    );

    if (origenUrl) {
      console.log(`— páginas, contra ${origenUrl}`);
      const sesion = await abrirSesion(origenUrl);
      try {
        const lista = texto((await sesion.pagina("/sobres")).html);
        const reglas = texto((await sesion.pagina("/sobres/reglas")).html);
        comprobar(
          "7",
          "Sobres muestra Inversión a largo plazo y Negocios con su descripción, y Reglas ofrece Negocios",
          lista.includes("Negocios") &&
            lista.includes("Oportunidades de negocio de ahora") &&
            lista.includes("Inversión a largo plazo") &&
            reglas.includes("Negocios"),
        );
      } finally {
        await sesion.salir();
      }
    }
  } finally {
    if (!yaDividida) {
      // Deja la base como estaba: Negocios sin movimientos se borra con su regla, e Inversión recupera lo suyo.
      const negocios = (await db.select().from(sobres).where(eq(sobres.tipo, "negocios")))[0];
      if (negocios) {
        const [{ usos }] = await db
          .select({ usos: count() })
          .from(movimientos)
          .where(or(eq(movimientos.sobreOrigenId, negocios.id), eq(movimientos.sobreDestinoId, negocios.id)));
        if (usos > 0) throw new Error("Negocios ya tiene movimientos: no se deshace la división.");
        await db.delete(reglasReparto).where(eq(reglasReparto.sobreId, negocios.id));
        await db.delete(sobres).where(eq(sobres.id, negocios.id));
      }
      await db
        .update(sobres)
        .set({ nombre: inversion.nombre, nota: inversion.nota })
        .where(eq(sobres.id, inversion.id));
      if (reglaInicial) {
        await db
          .update(reglasReparto)
          .set({ valor: reglaInicial.valor })
          .where(and(eq(reglasReparto.id, reglaInicial.id)));
      }
      comprobar("—", "la base quedó como estaba", sinFechas(await foto()) === sinFechas(inicial));
    }
  }

  console.log(fallos === 0 ? "\nTodo en verde." : `\n${fallos} criterio(s) en rojo.`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
