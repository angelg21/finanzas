/**
 * Respaldo de la base (spec 002, criterio 12). Vuelca los esquemas public y drizzle con el pg_dump del contenedor
 * local (Postgres 17, igual o más nuevo que Supabase) hacia data/respaldos/, que git ignora. Después lo restaura en
 * una base local aparte, finanzas_restauracion, y compara con el origen cada tabla del esquema (filas y huella), los
 * movimientos por tipo (cantidad y suma de monto_usd_centavos) y las migraciones aplicadas: un respaldo que no se
 * puede restaurar no es un respaldo. Pase lo que pase, borra finanzas_restauracion, para no dejar otra copia.
 *   pnpm db:respaldo:produccion        → producción, con ~/.finanzas/produccion.env y confirmación
 *   pnpm exec tsx src/db/respaldo.ts   → ensayo con la base local
 * El volcado se escribe como .sql.sin-comprobar y solo pasa a .sql cuando la restauración cuadra. La contraseña
 * entra al contenedor en PGPASSWORD y la URL sin ella, ambas como variables de entorno: nunca en los argumentos de
 * un proceso, que cualquiera con acceso a Docker puede listar.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { hoyEnCaracas } from "../lib/fechas";
import { conectar, terminarConError, urlLocal, urlProduccion } from "./conexion-script";
import { tablasDelEsquema } from "./estado-base";

const contenedor = "finanzas-db";
/** POSTGRES_USER de docker-compose.yml. */
const usuarioLocal = "finanzas";
const baseRestauracion = "finanzas_restauracion";
const carpeta = path.join("data", "respaldos");

type Linea = { nombre: string; valor: string };
type Opciones = { salida?: fs.WriteStream; entrada?: string; url?: string };

/** Corre un programa dentro del contenedor. Con `salida`, guarda lo que escribe; con `entrada`, se lo da a leer. */
async function enContenedor(programa: string[], { salida, entrada, url }: Opciones = {}) {
  let entorno: Record<string, string> = {};
  if (url) {
    const sinClave = new URL(url);
    entorno = { PGPASSWORD: decodeURIComponent(sinClave.password) };
    sinClave.password = "";
    entorno.URL_RESPALDO = sinClave.toString();
  }
  const variables = Object.keys(entorno).flatMap((nombre) => ["-e", nombre]);
  const hijo = spawn("docker", ["exec", "-i", ...variables, contenedor, ...programa], {
    env: { ...process.env, ...entorno },
    stdio: [entrada ? "pipe" : "ignore", salida ? "pipe" : "ignore", "inherit"],
  });
  const terminado = new Promise<void>((resolver, rechazar) => {
    hijo.on("error", rechazar);
    hijo.on("close", (codigo) =>
      codigo === 0 ? resolver() : rechazar(new Error(`${programa[0]} terminó con código ${codigo}.`)),
    );
  });
  await Promise.all([
    terminado,
    salida && hijo.stdout && pipeline(hijo.stdout, salida),
    entrada && hijo.stdin && pipeline(fs.createReadStream(entrada), hijo.stdin),
  ]);
}

/** Un nombre libre para el volcado de hoy, que nunca pisa uno anterior, comprobado o no. */
function reservarNombre(sufijo: string) {
  fs.mkdirSync(carpeta, { recursive: true });
  const base = `${hoyEnCaracas(new Date())}${sufijo}`;
  for (let n = 1; ; n++) {
    const final = path.join(carpeta, `${base}${n > 1 ? `-${n}` : ""}.sql`);
    const provisional = `${final}.sin-comprobar`;
    if (!fs.existsSync(final) && !fs.existsSync(provisional)) return { final, provisional };
  }
}

/** La misma URL hacia otra base, o hacia el servidor visto desde dentro del contenedor. */
function cambiar(url: string, { base, dentroDelContenedor }: { base?: string; dentroDelContenedor?: boolean }) {
  const cambiada = new URL(url);
  if (base) cambiada.pathname = `/${base}`;
  if (dentroDelContenedor) {
    cambiada.hostname = "localhost";
    cambiada.port = "5432";
  }
  return cambiada.toString();
}

/**
 * Lo que debe coincidir entre el origen y la restauración. La huella de cada tabla es el md5 de sus filas en orden
 * de id, con la zona horaria fija para que las fechas se escriban igual en las dos bases.
 */
async function resumir(url: string): Promise<Linea[]> {
  const { conexion } = conectar(url);
  try {
    return await conexion.begin(async (sql) => {
      await sql`set local timezone = 'UTC'`;
      const lineas: Linea[] = [];
      for (const tabla of tablasDelEsquema) {
        const [{ filas, huella }] = await sql<{ filas: number; huella: string }[]>`
          select count(*)::int as filas, md5(coalesce(string_agg(t::text, '|' order by t.id), '')) as huella
          from ${sql(tabla)} t`;
        lineas.push({ nombre: tabla, valor: `${filas} filas, huella ${huella.slice(0, 12)}` });
      }
      const porTipo = await sql<{ tipo: string; cantidad: number; suma: string }[]>`
        select tipo::text as tipo, count(*)::int as cantidad, sum(monto_usd_centavos)::text as suma
        from movimientos group by tipo order by tipo`;
      for (const { tipo, cantidad, suma } of porTipo) {
        lineas.push({ nombre: `movimientos de ${tipo}`, valor: `${cantidad}, ${suma} centavos USD` });
      }
      const [{ aplicadas, ultima }] = await sql<{ aplicadas: number; ultima: string }[]>`
        select count(*)::int as aplicadas, max(created_at)::text as ultima from drizzle.__drizzle_migrations`;
      lineas.push({ nombre: "migraciones", valor: `${aplicadas} aplicadas, la última ${ultima}` });
      return lineas;
    });
  } finally {
    await conexion.end();
  }
}

/** Restaura el volcado en finanzas_restauracion, la resume y la borra, también si algo falla a medias. */
async function restaurarYResumir(archivo: string, local: string): Promise<Linea[]> {
  await enContenedor(["dropdb", "-U", usuarioLocal, "--if-exists", baseRestauracion]);
  try {
    await enContenedor(["createdb", "-U", usuarioLocal, baseRestauracion]);
    // pg_dump --schema=public trae su propio "create schema public"; el de la base recién creada está vacío.
    await enContenedor(["psql", "-U", usuarioLocal, "-d", baseRestauracion, "-q", "-c", "drop schema public"]);
    const restaurar = ["psql", "-U", usuarioLocal, "-d", baseRestauracion, "-v", "ON_ERROR_STOP=1", "-q", "-f", "-"];
    await enContenedor(restaurar, { entrada: archivo });
    return await resumir(cambiar(local, { base: baseRestauracion }));
  } finally {
    await enContenedor(["dropdb", "-U", usuarioLocal, "--if-exists", baseRestauracion]);
  }
}

async function main() {
  const produccion = process.argv.includes("--produccion");
  // La restauración siempre va a la base local, también cuando el origen es producción.
  const local = urlLocal(produccion ? "pnpm db:respaldo:produccion" : "el ensayo de respaldo");
  const origen = produccion ? await urlProduccion("respaldar") : local;
  const { final, provisional } = reservarNombre(produccion ? "" : "-ensayo-local");

  console.log(`Volcando en ${provisional}…`);
  const volcar = 'exec pg_dump --dbname="$URL_RESPALDO" --schema=public --schema=drizzle --no-owner --no-privileges';
  try {
    await enContenedor(["sh", "-c", volcar], {
      salida: fs.createWriteStream(provisional, { flags: "wx" }),
      url: produccion ? origen : cambiar(origen, { dentroDelContenedor: true }),
    });
  } catch (error) {
    // Si otro proceso ganó el nombre (EEXIST), ese archivo no es nuestro y no se toca.
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") fs.rmSync(provisional, { force: true });
    throw error;
  }

  console.log(`Restaurando en ${baseRestauracion}…`);
  const enRestaurada = await restaurarYResumir(provisional, local);
  const enOrigen = await resumir(origen);

  const nombres = [...new Set([...enOrigen, ...enRestaurada].map((l) => l.nombre))];
  const valor = (lista: Linea[], nombre: string) => lista.find((l) => l.nombre === nombre)?.valor ?? "nada";
  let iguales = true;
  for (const nombre of nombres) {
    const [o, r] = [valor(enOrigen, nombre), valor(enRestaurada, nombre)];
    iguales &&= o === r;
    console.log(o === r ? `✓ ${nombre}: ${o}` : `✗ ${nombre}: ${o} en el origen, ${r} restaurado`);
  }
  if (!iguales) {
    throw new Error(
      `La restauración no coincide con el origen; el volcado queda como ${provisional}. ` +
        "Si se registró algo mientras corría, repítelo.",
    );
  }
  fs.renameSync(provisional, final);
  console.log(`Respaldo comprobado: ${final}`);
}

main().catch(terminarConError);
