/**
 * Conexión de los scripts de base (spec 002, criterios 10 y 11). Los comandos de siempre leen .env.local y solo
 * corren contra la base de Docker de esta máquina. Los de producción piden pegar la cadena de conexión, oculta, en una
 * terminal: no existe en ningún archivo (auditoría T14, hallazgo 4). Exigen TLS, muestran el destino sin
 * credenciales y piden escribir "produccion" antes de tocar nada. Sin una terminal, se niegan: el agente nunca los
 * corre ni puede leer la cadena.
 */
import readline from "node:readline";
import { Writable } from "node:stream";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { describirBase, esUrlLegible, exigeTls, exigirBaseLocal } from "../lib/destino-base";
import * as schema from "./schema";

const contrasenaEscapada =
  "Escapa los caracteres especiales de la contraseña (/ ? # @ , % → %2F %3F %23 %40 %2C %25) o genera una sin ellos.";

/** DATABASE_URL de .env.local, o del entorno, que manda. Sin exigir nada: solo para borrar lo marcado demo-*. */
export function urlDeEntorno(): string | undefined {
  config({ path: ".env.local" });
  return process.env.DATABASE_URL;
}

/** DATABASE_URL de .env.local, solo si apunta a la base local. */
export function urlLocal(comando: string): string {
  return exigirBaseLocal(urlDeEntorno(), comando);
}

/**
 * La cadena de producción, pegada oculta en la terminal, después de que el desarrollador escribe "produccion". Nunca
 * sale de un archivo ni del entorno: un DATABASE_URL de .env.local o del shell no decide a qué base se apunta.
 */
export async function urlProduccion(accion: string): Promise<string> {
  if (!process.stdin.isTTY) {
    throw new Error(
      "Los comandos de producción piden la cadena y la confirmación en una terminal; sin ella no corren.",
    );
  }
  const url = (await preguntar("Pega la cadena de conexión de producción (no se ve al pegar): ", true)).trim();
  if (!url) throw new Error("Cancelado: no se pegó ninguna cadena.");
  if (!esUrlLegible(url)) throw new Error(`La cadena no se entiende. ${contrasenaEscapada}`);
  if (!exigeTls(url)) throw new Error("La cadena de producción debe llevar ?sslmode=require.");
  console.log(`\nVas a ${accion} en PRODUCCIÓN: ${describirBase(url)}`);
  const respuesta = await preguntar('Escribe "produccion" para continuar: ');
  if (respuesta.trim() !== "produccion") throw new Error("Cancelado: no se tocó la base.");
  return url;
}

/**
 * Lo que escribe el desarrollador; vacío si la entrada se cierra sin respuesta. Con `oculto`, lo que se escribe no
 * se repite en pantalla: ni en la terminal ni en su historial queda la cadena.
 */
export function preguntar(texto: string, oculto = false): Promise<string> {
  return new Promise((resolver) => {
    let callado = false;
    const salida = new Writable({
      write(trozo, codificacion, listo) {
        if (!callado) process.stdout.write(trozo, codificacion);
        listo();
      },
    });
    const rl = readline.createInterface({ input: process.stdin, output: salida, terminal: true });
    rl.once("close", () => resolver(""));
    rl.question(texto, (respuesta) => {
      if (oculto) process.stdout.write("\n");
      resolver(respuesta);
      rl.close();
    });
    // La pregunta ya se escribió; desde aquí, lo que se teclea no se ve.
    callado = oculto;
  });
}

/** Una sola conexión, sin sentencias preparadas: sirve igual en local que en Supabase. */
export function conectar(url: string) {
  // El error de URL inválida del driver repite la cadena entera, contraseña incluida: nunca se le pasa una así.
  if (!esUrlLegible(url)) throw new Error(`DATABASE_URL no se entiende. ${contrasenaEscapada}`);
  const conexion = postgres(url, { prepare: false, max: 1 });
  return { conexion, db: drizzle(conexion, { schema, casing: "snake_case" }) };
}

/**
 * Termina el script con el mensaje del error y el de su causa, nunca con el objeto entero: algunos errores traen
 * la URL completa. Drizzle envuelve el error de Postgres en `cause`, y ahí está el motivo real.
 */
export function terminarConError(error: unknown): never {
  console.error(error instanceof Error ? error.message : String(error));
  const causa = error instanceof Error ? error.cause : undefined;
  if (causa instanceof Error) {
    // Un host con varias IP (localhost, el pooler) falla con un AggregateError de mensaje vacío: el detalle va en
    // cada intento, que solo trae IP y puerto.
    const intentos = causa instanceof AggregateError ? causa.errors.map((e) => String(e?.message ?? e)) : [];
    const codigo = (causa as { code?: string }).code;
    const detalle = [causa.message, ...intentos].filter(Boolean).join(" · ");
    console.error(`Causa: ${[codigo, detalle].filter(Boolean).join(" · ")}`);
  }
  process.exit(1);
}
