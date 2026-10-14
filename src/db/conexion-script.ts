/**
 * Conexión de los scripts de base (spec 002, criterios 10 y 11). Los comandos de siempre leen .env.local y solo
 * corren contra la base de Docker de esta máquina. Los de producción leen solo ~/.finanzas/produccion.env, exigen TLS,
 * muestran el destino sin credenciales y piden escribir "produccion" en una terminal antes de tocar nada. Sin una
 * terminal, se niegan: el agente nunca los corre.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { config, parse } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { describirBase, esUrlLegible, exigeTls, exigirBaseLocal } from "../lib/destino-base";
import * as schema from "./schema";

/**
 * Fuera del repo (auditoría T14, hallazgo 4): ninguna búsqueda dentro del proyecto lo toca, y los hooks y las
 * reglas del agente niegan cualquier comando o lectura que lo nombre.
 */
const archivoProduccion = path.join(os.homedir(), ".finanzas", "produccion.env");
const archivoMostrado = "~/.finanzas/produccion.env";
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

/** DATABASE_URL de ~/.finanzas/produccion.env, después de que el desarrollador escribe "produccion". */
export async function urlProduccion(accion: string): Promise<string> {
  if (!process.stdin.isTTY) {
    throw new Error("Los comandos de producción piden confirmación en una terminal; sin ella no corren.");
  }
  if (!fs.existsSync(archivoProduccion)) {
    throw new Error(`Falta ${archivoMostrado}. Los pasos están en docs/despliegue.md.`);
  }
  // Solo del archivo: un DATABASE_URL del entorno o de .env.local nunca decide a qué base se apunta.
  const url = parse(fs.readFileSync(archivoProduccion)).DATABASE_URL;
  if (!url) throw new Error(`Falta DATABASE_URL en ${archivoMostrado}.`);
  if (!esUrlLegible(url))
    throw new Error(`La DATABASE_URL de ${archivoMostrado} no se entiende. ${contrasenaEscapada}`);
  if (!exigeTls(url)) throw new Error(`La DATABASE_URL de ${archivoMostrado} debe llevar ?sslmode=require.`);
  console.log(`\nVas a ${accion} en PRODUCCIÓN: ${describirBase(url)}`);
  const respuesta = await preguntar('Escribe "produccion" para continuar: ');
  if (respuesta.trim() !== "produccion") throw new Error("Cancelado: no se tocó la base.");
  return url;
}

/** Lo que escribe el desarrollador; vacío si la entrada se cierra sin respuesta. */
function preguntar(texto: string): Promise<string> {
  return new Promise((resolver) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.once("close", () => resolver(""));
    rl.question(texto, (respuesta) => {
      resolver(respuesta);
      rl.close();
    });
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
