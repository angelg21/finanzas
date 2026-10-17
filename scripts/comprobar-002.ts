/**
 * Comprobación contra la base local de los criterios ★ de la spec 002 que no caben en una función pura:
 * - 10 y 11: pnpm db:demo, db:seed y db:migrate se niegan ante un DATABASE_URL remoto sin llegar a conectar, y
 *   db:demo:limpiar no se niega. El remoto es un servidor TCP de mentira en 127.0.0.2 que cuenta las conexiones;
 * - 9: la base local tiene RLS en cada tabla del esquema y ninguna política (la misma revisión que hace
 *   db:migrate:produccion después de migrar);
 * - 19: un reintento de la captura con el mismo id se registra una sola vez, también en carrera, y si entre intentos
 *   cambió la forma de pago o el monto no se guarda nada más; el cuadre sigue intacto.
 *   pnpm exec tsx scripts/comprobar-002.ts
 * Las capturas usan ids que empiezan por 0c050002 y la nota "demo-comprobar-002-captura": se borran al terminar y,
 * si una corrida se cortó, al empezar la siguiente. No toca ninguna otra fila. Lo que necesita el build va en
 * scripts/comprobar-002-servidor.ts.
 */
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import net from "node:net";
import { config } from "dotenv";
import { and, count, eq, like } from "drizzle-orm";
import { referenciaDeCaptura, resolverReintento } from "../src/lib/captura";
import { exigirBaseLocal } from "../src/lib/destino-base";
import { hoyEnCaracas } from "../src/lib/fechas";
import { type FormaPago, prepararGasto } from "../src/lib/gastos";

const MARCA = "0c050002";
const NOTA = "demo-comprobar-002-captura";
let fallos = 0;

function comprobar(criterio: string, descripcion: string, ok: boolean, detalle = "") {
  if (!ok) fallos++;
  console.log(`${ok ? "✓" : "✗"} ${criterio} · ${descripcion}${detalle ? ` (${detalle})` : ""}`);
}

/** La cadena se arma por partes: el hook de secretos no distingue un ejemplo de una contraseña real. */
const url = (credenciales: string, resto: string) => `postgres://${credenciales}@${resto}`;

/** Corre un comando con otro entorno y devuelve su código de salida y lo que escribió. */
function correr(args: string[], entorno: NodeJS.ProcessEnv): Promise<{ codigo: number | null; salida: string }> {
  return new Promise((resolver) => {
    const hijo = spawn("pnpm", args, { env: entorno, shell: process.platform === "win32" });
    let salida = "";
    hijo.stdout.on("data", (d) => (salida += d));
    hijo.stderr.on("data", (d) => (salida += d));
    const reloj = setTimeout(() => hijo.kill(), 90_000);
    hijo.on("close", (codigo) => {
      clearTimeout(reloj);
      resolver({ codigo, salida });
    });
  });
}

/** ★ 10 y 11: un "remoto" que cuenta quién intenta conectar y corta cada conexión. */
async function guardasDeBase() {
  let conexiones = 0;
  const servidor = net.createServer((socket) => {
    conexiones++;
    socket.destroy();
  });
  await new Promise<void>((listo, fallo) => servidor.once("error", fallo).listen(0, "127.0.0.2", listo));
  const { port } = servidor.address() as net.AddressInfo;
  const remota = url("finanzas:finanzas", `127.0.0.2:${port}/finanzas`);
  const entorno = { ...process.env, DATABASE_URL: remota };
  // Un intento de conectar se ve en el servidor o, si el sistema lo corta antes (un sandbox), en el error del driver.
  const intentoEnSalida = (salida: string) => /\bconnect\b|ECONN|EACCES|CONNECTION_/.test(salida);
  try {
    for (const [criterio, comando, quien] of [
      ["10", "db:demo", "pnpm db:demo"],
      ["11", "db:seed", "pnpm db:seed"],
      ["11", "db:migrate", "drizzle-kit"],
    ] as const) {
      const antes = conexiones;
      const { codigo, salida } = await correr(["run", comando], entorno);
      const negado = salida.includes(`${quien} solo corre contra la base local`);
      const intentos = conexiones - antes + (intentoEnSalida(salida) ? 1 : 0);
      comprobar(
        criterio,
        `pnpm ${comando} con DATABASE_URL remoto se niega antes de conectar`,
        codigo !== 0 && negado && intentos === 0,
        `código ${codigo}, ${negado ? "mensaje de la guarda" : "sin el mensaje"}, ${intentos} intentos de conectar`,
      );
    }
    const antes = conexiones;
    const { codigo, salida } = await correr(["run", "db:demo:limpiar"], entorno);
    const intento = conexiones > antes || intentoEnSalida(salida);
    comprobar(
      "10",
      "pnpm db:demo:limpiar no se niega con una base remota: intenta conectar",
      !salida.includes("solo corre contra la base local") && intento,
      `código ${codigo}, ${conexiones - antes} conexiones recibidas${intentoEnSalida(salida) ? ", error de conexión del driver" : ""}`,
    );
  } finally {
    servidor.close();
  }
}

async function main() {
  config({ path: ".env.local", quiet: true });
  // Escribe filas: solo en la base local (criterio 10).
  exigirBaseLocal(process.env.DATABASE_URL, "comprobar-002");

  await guardasDeBase();

  const { conectar } = await import("../src/db/conexion-script");
  const { revisarEstadoBase } = await import("../src/db/estado-base");
  const revision = conectar(process.env.DATABASE_URL as string);
  try {
    for (const c of await revisarEstadoBase(revision.conexion)) comprobar("9", c.texto, c.ok);
    const [{ politicas }] = await revision.conexion<{ politicas: number }[]>`
      select count(*)::int as politicas from pg_policies where schemaname = 'public'`;
    comprobar("9", "ninguna política en public", politicas === 0, `${politicas}`);
  } finally {
    await revision.conexion.end();
  }

  await capturas();
}

/** ★ 19: los reintentos de una captura, contra la base y con las mismas funciones que la acción. */
async function capturas() {
  const { db, movimientos } = await import("../src/db/index");
  const schema = await import("../src/db/schema");
  const { registrarCaptura } = await import("../src/db/movimientos");
  const { categoriasDeGastoPorUso, saldosPorCuenta, saldosPorSobre, sobresParaGasto } =
    await import("../src/db/consultas");

  const nuestras = and(like(movimientos.referenciaExterna, `captura-${MARCA}-%`), eq(movimientos.origen, "manual"));
  const limpiar = () => db.delete(movimientos).where(nuestras);
  const idDePrueba = () => `${MARCA}${randomUUID().slice(8)}`;
  const deLaCaptura = async (id: string) =>
    (
      await db
        .select({ n: count() })
        .from(movimientos)
        .where(like(movimientos.referenciaExterna, `captura-${id}-%`))
    )[0].n;
  async function cuadre() {
    const [c, s] = await Promise.all([saldosPorCuenta(), saldosPorSobre()]);
    const cuentas = c.reduce((a, x) => a + x.saldoUsdCentavos, 0);
    const sobres = s.reduce((a, x) => a + x.saldoCentavos, 0);
    return { ok: cuentas === sobres, texto: `sobres ${sobres}, cuentas ${cuentas}` };
  }

  const cuentas = await db.select().from(schema.cuentas);
  const enDolares = cuentas.find((c) => c.activa && c.esPropia && c.moneda !== "VES");
  const bolivares = cuentas.find((c) => c.activa && c.moneda === "VES");
  const [sobre] = await sobresParaGasto();
  const [categoria] = await categoriasDeGastoPorUso();
  if (!enDolares || !bolivares || !sobre || !categoria) throw new Error("Faltan las semillas: corre pnpm db:seed.");
  const hoy = hoyEnCaracas(new Date());

  /** Las filas que guardaría la acción para lo tecleado, con la referencia de la captura. */
  function filas(id: string, forma: FormaPago, monto: string) {
    const preparado = prepararGasto(
      {
        forma,
        monto,
        tasa: "200",
        vendido: "10",
        cuentaOrigen: { id: enDolares!.id, moneda: enDolares!.moneda },
        cuentaBolivares: { id: bolivares!.id, moneda: bolivares!.moneda },
        sobreId: sobre.id,
        categoriaId: categoria.id,
        fecha: hoy,
        nota: NOTA,
      },
      hoy,
    );
    if (!preparado.ok) throw new Error(`Gasto de prueba inválido: ${JSON.stringify(preparado.errores)}`);
    return preparado.filas.map((f) => ({ ...f, referenciaExterna: referenciaDeCaptura(id, f.tipo) }));
  }
  /** Lo que haría la acción al guardar: registrar y, si ya estaba, decidir si es el mismo gasto. */
  async function guardar(id: string, preparadas: ReturnType<typeof filas>) {
    const registro = await registrarCaptura(id, preparadas);
    if (registro.nueva) return "nueva";
    return resolverReintento(registro.guardadas, preparadas, new Date());
  }

  await limpiar();
  const inicial = await cuadre();
  try {
    {
      const id = idDePrueba();
      const primero = await guardar(id, filas(id, "dolares", "4,50"));
      const reintento = await guardar(id, filas(id, "dolares", "4,50"));
      comprobar(
        "19",
        "el mismo gasto guardado dos veces con el mismo id se registra una sola vez",
        primero === "nueva" && reintento === "ya-estaba" && (await deLaCaptura(id)) === 1,
        `${primero}, luego ${reintento}; ${await deLaCaptura(id)} fila`,
      );
    }
    {
      const id = idDePrueba();
      await guardar(id, filas(id, "dolares", "4,50"));
      const otroMonto = await guardar(id, filas(id, "dolares", "5,50"));
      const [guardada] = await db
        .select()
        .from(movimientos)
        .where(like(movimientos.referenciaExterna, `captura-${id}-%`));
      comprobar(
        "19",
        "si entre intentos cambió el monto, no es el mismo gasto: avisa y no guarda otro",
        otroMonto === "otra" && (await deLaCaptura(id)) === 1 && guardada?.montoCentavos === 450,
        `${otroMonto}; ${await deLaCaptura(id)} fila de ${guardada?.montoCentavos} centavos`,
      );
    }
    {
      const id = idDePrueba();
      await guardar(id, filas(id, "dolares", "4,50"));
      const vendiendo = await guardar(id, filas(id, "vendiendo", "900"));
      comprobar(
        "19",
        "si cambió de dólares a vendiendo, no es el mismo y la venta no queda a medias",
        vendiendo === "otra" && (await deLaCaptura(id)) === 1,
        `${vendiendo}; ${await deLaCaptura(id)} fila`,
      );
      const otro = idDePrueba();
      await guardar(otro, filas(otro, "vendiendo", "900"));
      const enDolaresAhora = await guardar(otro, filas(otro, "dolares", "4,50"));
      comprobar(
        "19",
        "y al revés, de vendiendo a dólares: tampoco",
        enDolaresAhora === "otra" && (await deLaCaptura(otro)) === 2,
        `${enDolaresAhora}; ${await deLaCaptura(otro)} filas`,
      );
    }
    {
      const id = idDePrueba();
      const preparadas = filas(id, "vendiendo", "900");
      const resultados = await Promise.all(Array.from({ length: 6 }, () => guardar(id, preparadas)));
      const nuevas = resultados.filter((r) => r === "nueva").length;
      comprobar(
        "19",
        "seis intentos a la vez con el mismo id: uno guarda y los demás ven que ya estaba",
        nuevas === 1 && resultados.every((r) => r !== "otra") && (await deLaCaptura(id)) === 2,
        `${resultados.join(", ")}; ${await deLaCaptura(id)} filas`,
      );
    }
    const final = await cuadre();
    comprobar("19", "con los reintentos guardados, sigue en Cuadra", final.ok, final.texto);
  } finally {
    await limpiar();
    const despues = await cuadre();
    const quedan = (await db.select({ n: count() }).from(movimientos).where(nuestras))[0].n;
    comprobar(
      "—",
      "la base queda como estaba",
      quedan === 0 && despues.texto === inicial.texto && despues.ok === inicial.ok,
      despues.texto,
    );
  }
}

main()
  .then(() => {
    console.log(fallos === 0 ? "✓ comprobar-002: todo en verde" : `✗ comprobar-002: ${fallos} comprobaciones fallaron`);
    process.exit(fallos === 0 ? 0 : 1);
  })
  .catch((error) => {
    console.error("✗ comprobar-002:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
