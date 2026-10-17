/**
 * Comprobación contra el build de los criterios ★ de la spec 002 que solo se ven con el servidor corriendo:
 * - 2 y 19: cada server action del build, llamada sin sesión como lo haría la página (con JavaScript) o como un
 *   formulario sin él, pide entrar y no escribe nada: ninguna tabla cambia de filas. Las de formularios con estado
 *   responden con el mensaje de la sesión vencida y no pierden la pantalla;
 * - 3: con una cuenta válida de Supabase que no es USUARIO_PERMITIDO, entrar da el mismo error que una contraseña
 *   equivocada y no deja la sesión abierta; con USUARIO_PERMITIDO en blanco, nadie entra. Y el registro de usuarios
 *   nuevos está apagado en el proyecto de desarrollo;
 * - 8: ningún valor del entorno del servidor está en lo que se sirve al navegador, ni hay una clave de servicio;
 * - 13: el modo de pnpm humo que se corre contra producción (--url --sin-sesion) funciona.
 *   pnpm exec tsx scripts/comprobar-002-servidor.ts     (necesita el build hecho y la base local arriba)
 * Levanta el build en los puertos 3141 a 3143 (se niega si alguno está ocupado) y los apaga al terminar. Usa el usuario de prueba de "finanzas-dev"
 * (HUMO_CORREO y HUMO_CLAVE), que nunca se imprimen.
 */
import { type ChildProcess, execSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { count, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { exigirBaseLocal } from "../src/lib/destino-base";

let fallos = 0;
function comprobar(criterio: string, descripcion: string, ok: boolean, detalle = "") {
  if (!ok) fallos++;
  console.log(`${ok ? "✓" : "✗"} ${criterio} · ${descripcion}${detalle ? ` (${detalle})` : ""}`);
}

const esWindows = process.platform === "win32";
/** El entorno de antes de leer el archivo de entorno: el servidor lee el suyo y aquí solo se cambia lo que se pide. */
const entornoOriginal = { ...process.env };

/** Levanta `next start` con otro entorno, corre `f` contra él y lo apaga pase lo que pase. */
async function conServidor<T>(puerto: number, entorno: Record<string, string>, f: (base: string) => Promise<T>) {
  // Otro servidor en el mismo puerto contestaría por este, con su propio build.
  const ocupado = await fetch(`http://localhost:${puerto}/`).then(
    () => true,
    () => false,
  );
  if (ocupado) throw new Error(`El puerto ${puerto} ya está ocupado: no se comprueba contra un servidor ajeno.`);
  const servidor: ChildProcess = spawn("pnpm", ["exec", "next", "start", "-p", String(puerto)], {
    env: { ...entornoOriginal, ...entorno },
    stdio: ["ignore", "ignore", "ignore"],
    shell: esWindows,
  });
  const base = `http://localhost:${puerto}`;
  try {
    let escucha = false;
    for (let i = 0; i < 60 && !escucha; i++) {
      try {
        escucha = Boolean((await fetch(`${base}/entrar`)).status);
      } catch {
        await new Promise((resolver) => setTimeout(resolver, 1000));
      }
    }
    if (!escucha) throw new Error(`El build no respondió en el puerto ${puerto}. ¿Está hecho (pnpm build)?`);
    return await f(base);
  } finally {
    if (esWindows) {
      try {
        execSync(`taskkill /PID ${servidor.pid} /T /F`, { stdio: "ignore" });
      } catch {
        // ya estaba cerrado
      }
    } else {
      servidor.kill("SIGTERM");
    }
  }
}

type Accion = { id: string; archivo: string; nombre: string; ruta: string };

/** Las server actions del build y una página donde vive cada una, salvo las de (sin-sesion). */
function accionesDelBuild(): Accion[] {
  const manifiesto = JSON.parse(fs.readFileSync(".next/server/server-reference-manifest.json", "utf8")).node as Record<
    string,
    { workers: Record<string, unknown>; filename: string; exportedName: string }
  >;
  return Object.entries(manifiesto)
    .filter(([, a]) => !a.filename.includes("(sin-sesion)"))
    .map(([id, a]) => {
      const pagina = Object.keys(a.workers).find((w) => w.endsWith("/page")) ?? "app/page";
      const ruta =
        pagina
          .replace(/^app/, "")
          .replace(/\/page$/, "")
          .replace(/\/\([^)]+\)/g, "")
          .replace(/\[[^\]]+\]/g, "1") || "/";
      return { id, archivo: a.filename, nombre: a.exportedName, ruta };
    });
}

/**
 * Los argumentos de la acción como los manda React desde la página: el estado previo, el FormData ("$K1", con sus
 * campos en "_1_<nombre>") y los ligados con bind, según su firma. Nada de esto llega a usarse sin sesión.
 */
function argumentosDe(accion: Accion): string {
  const fuente = fs.readFileSync(accion.archivo, "utf8");
  const inicio = fuente.indexOf(`export async function ${accion.nombre}(`);
  let i = fuente.indexOf("(", inicio);
  const desde = i + 1;
  for (let abiertos = 0; i < fuente.length; i++) {
    if (fuente[i] === "(") abiertos++;
    else if (fuente[i] === ")" && --abiertos === 0) break;
  }
  const parametros = fuente
    .slice(desde, i)
    .split(/,(?![^<{(]*[>})])/)
    .map((p) => p.trim())
    .filter(Boolean);
  return JSON.stringify(
    parametros.map((p) => (/FormData/.test(p) ? "$K1" : /^previo|Estado/.test(p) ? { ronda: 0 } : 1)),
  );
}

/** Filas de cada tabla del esquema. */
async function filasPorTabla() {
  const { db } = await import("../src/db/index");
  const schema = await import("../src/db/schema");
  const tablas = Object.entries(schema).filter(([, t]) => is(t, PgTable)) as [string, PgTable][];
  const cuentas = await Promise.all(
    tablas.map(async ([nombre, t]) => [nombre, (await db.select({ n: count() }).from(t))[0].n]),
  );
  return JSON.stringify(cuentas);
}

/** ★ 2 y 19: cada acción sin sesión pide entrar y no escribe nada. */
async function accionesSinSesion(base: string) {
  const acciones = accionesDelBuild();
  comprobar("2", `el build trae ${acciones.length} server actions con sesión`, acciones.length >= 15);
  const antes = await filasPorTabla();
  let sinJsAEntrar = 0;
  for (const accion of acciones) {
    // Con JavaScript: el fetch de React, con la cabecera next-action.
    // Como React: primero los campos del FormData y al final la raíz, que los nombra.
    const datos = new FormData();
    datos.append("_1_monto", "12,34");
    datos.append("_1_nota", "demo-comprobar-002-sin-sesion");
    datos.append("0", argumentosDe(accion));
    const r = await fetch(`${base}${accion.ruta}`, {
      method: "POST",
      redirect: "manual",
      headers: { "next-action": accion.id, accept: "text/x-component" },
      body: datos,
    });
    const cuerpo = await r.text();
    const redirige = (r.headers.get("x-action-redirect") ?? "").startsWith("/entrar");
    const mensaje = /Tu sesión terminó: [^".\\]+\. Entra de nuevo\./.exec(cuerpo)?.[0];
    comprobar(
      "2",
      `${accion.nombre} sin sesión, con JavaScript → ${redirige ? "a /entrar" : (mensaje ?? `${r.status}, sin pedir entrar`)}`,
      (redirige || Boolean(mensaje)) && !/Centavos/.test(cuerpo),
    );
    // Criterio 19: el mensaje de la captura, y el mismo sin nombrar el gasto en categorías y sobres, también en sus
    // botones sueltos (quitar una ocasión, eliminar y restaurar una categoría). Borrar una deuda (spec 005), igual.
    const esperado = {
      registrarGasto: "Tu sesión terminó: el gasto no se guardó. Entra de nuevo.",
      guardarCategoria: "Tu sesión terminó: no se guardó. Entra de nuevo.",
      eliminarCategoriaAccion: "Tu sesión terminó: no se guardó. Entra de nuevo.",
      restaurarCategoriaAccion: "Tu sesión terminó: no se guardó. Entra de nuevo.",
      agregarPartida: "Tu sesión terminó: no se guardó. Entra de nuevo.",
      eliminarPartida: "Tu sesión terminó: no se guardó. Entra de nuevo.",
      fijarAporteManual: "Tu sesión terminó: no se guardó. Entra de nuevo.",
      borrarDeudaAccion: "Tu sesión terminó: la deuda no se borró. Entra de nuevo.",
    }[accion.nombre];
    if (esperado) comprobar("19", `${accion.nombre}: el mensaje de la spec`, mensaje === esperado);
    if (accion.nombre === "registrarGasto") {
      comprobar("19", "registrarGasto: lo escrito vuelve con el mensaje", cuerpo.includes('"monto":"12,34"'));
    }
    // Sin JavaScript: el formulario va a la página con el id de la acción entre sus campos.
    const formulario = new FormData();
    formulario.append(`$ACTION_ID_${accion.id}`, "");
    formulario.append("monto", "12,34");
    const s = await fetch(`${base}${accion.ruta}`, { method: "POST", redirect: "manual", body: formulario });
    const cuerpoSinJs = await s.text();
    const ubicacion = s.headers.get("location") ?? "";
    if (s.status === 303 && ubicacion.includes("/entrar?siguiente=") && cuerpoSinJs.length < 300) sinJsAEntrar++;
    else comprobar("2", `${accion.nombre} sin sesión, sin JavaScript → ${s.status} ${ubicacion}`, false);
  }
  comprobar(
    "2",
    `sin JavaScript, los ${acciones.length} formularios sin sesión van con 303 a /entrar`,
    sinJsAEntrar === acciones.length,
    `${sinJsAEntrar} de ${acciones.length}`,
  );
  const despues = await filasPorTabla();
  comprobar("2", "ninguna tabla cambió de filas", antes === despues, despues);
}

/** El primer formulario de /entrar, enviado sin JavaScript con estos datos; lo que respondió y las cookies que quedan. */
async function entrar(base: string, correo: string, clave: string) {
  const html = await (await fetch(`${base}/entrar`)).text();
  const [formulario] = html.match(/<form[\s\S]*?<\/form>/) ?? [""];
  const datos = new FormData();
  for (const [entrada] of formulario.matchAll(/<input[^>]*>/g)) {
    const nombre = /name="([^"]*)"/.exec(entrada)?.[1];
    if (nombre)
      datos.append(nombre, (/value="([^"]*)"/.exec(entrada)?.[1] ?? "").replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
  }
  datos.set("correo", correo);
  datos.set("clave", clave);
  const r = await fetch(`${base}/entrar`, { method: "POST", redirect: "manual", body: datos });
  const cuerpo = await r.text();
  const frasco = new Map<string, string>();
  for (const linea of r.headers.getSetCookie()) {
    const [par] = linea.split(";");
    const nombre = par.slice(0, par.indexOf("="));
    const valor = par.slice(par.indexOf("=") + 1);
    if (!valor || /max-age=0\b/i.test(linea)) frasco.delete(nombre);
    else frasco.set(nombre, valor);
  }
  const alerta = /role="alert"[^>]*>([^<]*)</.exec(cuerpo)?.[1] ?? "";
  return { estado: r.status, alerta, sesion: [...frasco.keys()].some((n) => n.startsWith("sb-")) };
}

/** ★ 3: un correo que no es el permitido, o ningún permitido, no entra. */
async function unSoloUsuario(correo: string, clave: string) {
  const otro = await conServidor(3142, { USUARIO_PERMITIDO: "otro@ejemplo.invalid" }, async (base) => ({
    valida: await entrar(base, correo, clave),
    equivocada: await entrar(base, correo, `${clave}-equivocada`),
  }));
  comprobar(
    "3",
    "una cuenta válida que no es la permitida no entra y no le queda sesión",
    otro.valida.estado === 200 && otro.valida.alerta === "Correo o contraseña incorrectos." && !otro.valida.sesion,
    `${otro.valida.estado}, "${otro.valida.alerta}"`,
  );
  comprobar(
    "3",
    "recibe el mismo error que una contraseña equivocada",
    otro.valida.alerta === otro.equivocada.alerta && !otro.equivocada.sesion,
    `"${otro.equivocada.alerta}"`,
  );
  const enBlanco = await conServidor(3143, { USUARIO_PERMITIDO: "   " }, (base) => entrar(base, correo, clave));
  comprobar(
    "3",
    "con USUARIO_PERMITIDO en blanco nadie entra: falla cerrado",
    enBlanco.alerta === "Correo o contraseña incorrectos." && !enBlanco.sesion,
    `${enBlanco.estado}, "${enBlanco.alerta}"`,
  );
  // El correo no existe y el dominio .invalid no recibe nada; con el registro apagado, Supabase ni lo mira.
  const supabase = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_PUBLISHABLE_KEY as string, {
    auth: { persistSession: false },
  });
  const { data, error } = await supabase.auth.signUp({
    email: "demo-comprobar-002@ejemplo.invalid",
    password: `${crypto.randomUUID()}Aa1!`,
  });
  comprobar(
    "3",
    'en "finanzas-dev" el registro de usuarios nuevos está apagado',
    !data.user && error?.code === "signup_disabled",
    error?.code ?? "sin error",
  );
}

/** Todos los archivos bajo una carpeta. */
function archivosBajo(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = path.join(dir, e.name);
    return e.isDirectory() ? archivosBajo(ruta) : [ruta];
  });
}

/** ★ 8: ningún valor del entorno en lo que recibe el navegador; ninguna clave de servicio en el entorno. */
async function nadaDelEntornoAlNavegador(base: string, variables: Record<string, string>) {
  const valores = Object.entries(variables).filter(([, v]) => v.length >= 8);
  const estaticos = archivosBajo(path.join(".next", "static"));
  const paginas = await Promise.all(
    ["/entrar", "/sin-conexion", "/sw.js", "/manifest.webmanifest"].map(async (r) =>
      (await fetch(`${base}${r}`)).text(),
    ),
  );
  const contenidos = [...estaticos.map((a) => fs.readFileSync(a, "latin1")), ...paginas];
  const filtrados = valores.filter(([, v]) => contenidos.some((c) => c.includes(v))).map(([n]) => n);
  comprobar(
    "8",
    `ningún valor de las ${valores.length} variables del servidor está en ${estaticos.length} archivos de .next/static ni en las páginas públicas`,
    valores.length >= 4 && filtrados.length === 0,
    filtrados.join(", "),
  );
  const deServicio = Object.entries(variables)
    .filter(([n, v]) => /SERVICE|SECRET/i.test(n) || v.startsWith("sb_secret_") || /service_role/.test(rolDeJwt(v)))
    .map(([n]) => n);
  comprobar(
    "8",
    "el entorno de la app no tiene ninguna clave de servicio",
    deServicio.length === 0,
    deServicio.join(", "),
  );
}

function rolDeJwt(texto: string) {
  try {
    return String(JSON.parse(Buffer.from(texto.split(".")[1], "base64url").toString("utf8")).role ?? "");
  } catch {
    return ""; // no es un JWT
  }
}

/** ★ 13: el humo contra una URL ya publicada, aquí contra el build local. */
function humoContraUrl(base: string) {
  try {
    const salida = execSync(`node scripts/humo.mjs --url ${base} --sin-sesion`, { encoding: "utf8" });
    const ultima = salida.trim().split("\n").at(-1) ?? "";
    comprobar(
      "13",
      `pnpm humo -- --url ${base} --sin-sesion`,
      ultima.includes("✓ humo: todo responde como debe."),
      ultima,
    );
  } catch (error) {
    comprobar(
      "13",
      `pnpm humo -- --url ${base} --sin-sesion`,
      false,
      String((error as { stdout?: string }).stdout ?? "").slice(-400),
    );
  }
}

async function main() {
  const variables = config({ path: ".env.local", quiet: true }).parsed ?? {};
  exigirBaseLocal(process.env.DATABASE_URL, "comprobar-002-servidor");
  const correo = process.env.HUMO_CORREO;
  const clave = process.env.HUMO_CLAVE;
  if (!correo || !clave) throw new Error("Faltan HUMO_CORREO y HUMO_CLAVE en .env.local.");

  await conServidor(3141, {}, async (base) => {
    await accionesSinSesion(base);
    await nadaDelEntornoAlNavegador(base, variables);
    humoContraUrl(base);
  });
  await unSoloUsuario(correo, clave);
}

main()
  .then(() => {
    console.log(
      fallos === 0
        ? "✓ comprobar-002-servidor: todo en verde"
        : `✗ comprobar-002-servidor: ${fallos} comprobaciones fallaron`,
    );
    process.exit(fallos === 0 ? 0 : 1);
  })
  .catch((error) => {
    console.error("✗ comprobar-002-servidor:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
