#!/usr/bin/env node
/**
 * Prueba de humo (spec 002, criterios 1, 7, 8, 13 y 14).
 *   pnpm humo                                   → levanta el build en un puerto aparte; sin sesión y con sesión
 *   pnpm humo -- --sin-sesion                   → lo mismo, solo sin sesión
 *   pnpm humo -- --url <origen> --sin-sesion    → contra una URL ya publicada, sin levantar nada
 *
 * Sin sesión: cada ruta con datos redirige a /entrar?siguiente=<ruta> sin datos en el cuerpo, un POST que no es
 * una acción recibe 401, responden las rutas públicas y toda respuesta trae las cabeceras de seguridad.
 * Con sesión: entra con HUMO_CORREO y HUMO_CLAVE (.env.local) por el formulario de /entrar, como un navegador sin
 * JavaScript; comprueba las cookies (HttpOnly, SameSite=Lax, Secure), que las rutas responden, y sale.
 * Sin --url requiere la base local arriba (pnpm db:up) y un build hecho (verify lo hace antes).
 */
import { execSync, spawn } from "node:child_process";
import { config } from "dotenv";

const argumentos = process.argv.slice(2).filter((a) => a !== "--");
const posicionUrl = argumentos.indexOf("--url");
const urlRemota = posicionUrl >= 0 ? argumentos[posicionUrl + 1] : undefined;
const soloSinSesion = argumentos.includes("--sin-sesion");
if (urlRemota && !soloSinSesion) {
  console.error("✗ humo: contra una URL publicada solo corre sin sesión. Usa --url <origen> --sin-sesion.");
  process.exit(1);
}

const puerto = 3123;
const base = (urlRemota ?? `http://localhost:${puerto}`).replace(/\/$/, "");

/** Criterio 1: cada una, sin sesión, redirige a /entrar con su ruta en `siguiente`. */
const conDatos = [
  "/",
  "/movimientos",
  "/sobres",
  "/sobres/3?x=1",
  "/cuentas",
  "/nuevo",
  "/nuevo/gasto",
  "/categorias",
  "/categorias/nueva",
  "/categorias/1",
  "/ruta-que-no-existe",
];
/** Lo único que responde sin sesión. */
const publicas = [
  ["/entrar", 200],
  ["/manifest.webmanifest", 200],
  ["/icon/32", 200],
  ["/icon/192", 200],
  ["/icon/512", 200],
  ["/apple-icon", 200],
  ["/icono-adaptable", 200],
];
/** Con sesión, como antes de la autenticación. */
const conSesion = [
  ["/", 200],
  ["/movimientos", 200],
  ["/sobres", 200],
  ["/cuentas", 200],
  ["/nuevo", 200],
  ["/nuevo/gasto", 200],
  ["/categorias", 200],
  ["/categorias/nueva", 200],
  ["/sobres/999999", 404],
  ["/categorias/999999", 404],
];
/** Criterio 14. */
const cabecerasEsperadas = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-robots-tag": "noindex, nofollow",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
};

let fallos = 0;
function comprobar(ok, texto, detalle = "") {
  if (!ok) fallos++;
  console.log(`${ok ? "✓" : "✗"} ${texto}${ok || !detalle ? "" : ` (${detalle})`}`);
}

function cabecerasQueFaltan(respuesta) {
  return Object.entries(cabecerasEsperadas)
    .filter(([nombre, valor]) => respuesta.headers.get(nombre) !== valor)
    .map(([nombre]) => nombre);
}

/** Cookies de la sesión, guardadas entre solicitudes como haría el navegador. */
const frasco = new Map();
function guardarCookies(respuesta) {
  for (const linea of respuesta.headers.getSetCookie()) {
    const [par] = linea.split(";");
    const nombre = par.slice(0, par.indexOf("="));
    const valor = par.slice(par.indexOf("=") + 1);
    if (!valor || /max-age=0\b/i.test(linea)) frasco.delete(nombre);
    else frasco.set(nombre, valor);
  }
}
const cabeceraCookie = () => [...frasco].map(([n, v]) => `${n}=${v}`).join("; ");

function pedir(ruta, opciones = {}) {
  return fetch(`${base}${ruta}`, {
    redirect: "manual",
    ...opciones,
    headers: { ...(frasco.size ? { cookie: cabeceraCookie() } : {}), ...opciones.headers },
  });
}

/** Los campos de un formulario de la página, como los enviaría un navegador sin JavaScript. */
function camposDe(formulario) {
  const decodificar = (t) =>
    t
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
  const datos = new FormData();
  for (const [entrada] of formulario.matchAll(/<input[^>]*>/g)) {
    const nombre = /name="([^"]*)"/.exec(entrada)?.[1];
    if (nombre) datos.append(nombre, decodificar(/value="([^"]*)"/.exec(entrada)?.[1] ?? ""));
  }
  return datos;
}
const formularios = (html) => [...html.matchAll(/<form[\s\S]*?<\/form>/g)].map((m) => m[0]);

async function sinSesion() {
  console.log(`— sin sesión, contra ${base}`);
  for (const ruta of conDatos) {
    const r = await pedir(ruta);
    const cuerpo = await r.text();
    const destino = `/entrar?siguiente=${encodeURIComponent(ruta)}`;
    const ubicacion = r.headers.get("location") ?? "";
    const ok = r.status === 307 && (ubicacion === destino || ubicacion === `${base}${destino}`) && cuerpo.length < 300;
    comprobar(ok, `${ruta} → ${r.status} a /entrar`, `${r.status} ${ubicacion}, ${cuerpo.length} bytes`);
    const faltan = cabecerasQueFaltan(r);
    if (faltan.length) comprobar(false, `${ruta}: cabeceras`, `faltan ${faltan.join(", ")}`);
  }
  for (const ruta of ["/movimientos", "/nuevo/gasto"]) {
    const r = await pedir(ruta, { method: "POST" });
    const cuerpo = await r.text();
    comprobar(r.status === 401 && cuerpo.length === 0, `POST ${ruta} → ${r.status}, sin cuerpo`);
  }
  for (const [ruta, esperado] of publicas) {
    const r = await pedir(ruta);
    await r.arrayBuffer();
    const faltan = cabecerasQueFaltan(r);
    comprobar(
      r.status === esperado && faltan.length === 0,
      `${ruta} → ${r.status} con las cabeceras`,
      faltan.length ? `faltan ${faltan.join(", ")}` : `esperado ${esperado}`,
    );
  }
}

async function entrarYSalir() {
  config({ path: ".env.local", quiet: true });
  const correo = process.env.HUMO_CORREO;
  const clave = process.env.HUMO_CLAVE;
  if (!correo || !clave) {
    comprobar(false, "con sesión: faltan HUMO_CORREO y HUMO_CLAVE en .env.local");
    return;
  }
  console.log("— con sesión");
  const [formulario] = formularios(await (await pedir("/entrar")).text());
  const datos = camposDe(formulario ?? "");
  datos.set("correo", correo);
  datos.set("clave", clave);
  const r = await pedir("/entrar", { method: "POST", body: datos });
  await r.arrayBuffer();
  const sesion = r.headers.getSetCookie().filter((c) => /^sb-[^=]+-auth-token/.test(c));
  guardarCookies(r);
  comprobar(
    r.status === 303 && r.headers.get("location") === "/",
    `entrar → ${r.status} a /`,
    `${r.headers.get("location")}`,
  );
  comprobar(sesion.length > 0, `cookie de sesión puesta (${sesion.length})`);
  for (const [atributo, patron] of [
    ["HttpOnly", /;\s*httponly/i],
    ["SameSite=Lax", /;\s*samesite=lax/i],
    ["Secure", /;\s*secure/i],
  ]) {
    comprobar(sesion.length > 0 && sesion.every((c) => patron.test(c)), `cookie de sesión ${atributo}`);
  }

  for (const [ruta, esperado] of conSesion) {
    const respuesta = await pedir(ruta);
    await respuesta.arrayBuffer();
    guardarCookies(respuesta);
    comprobar(respuesta.status === esperado, `${ruta} → ${respuesta.status}`, `esperado ${esperado}`);
  }
  const yaDentro = await pedir("/entrar");
  await yaDentro.arrayBuffer();
  comprobar(yaDentro.status === 307 && yaDentro.headers.get("location")?.endsWith("/"), "/entrar con sesión → a /");

  const inicio = await (await pedir("/")).text();
  const salir = formularios(inicio).find((f) => f.includes("$ACTION_ID_") && f.includes("Salir"));
  const s = await pedir("/", { method: "POST", body: camposDe(salir ?? "") });
  await s.arrayBuffer();
  guardarCookies(s);
  comprobar(s.status === 303 && s.headers.get("location") === "/entrar", `salir → ${s.status} a /entrar`);
  comprobar(![...frasco.keys()].some((n) => n.startsWith("sb-")), "salir borra las cookies de sesión");
  const despues = await pedir("/movimientos");
  await despues.arrayBuffer();
  comprobar(despues.status === 307, `después de salir, /movimientos → ${despues.status}`);
}

let servidor;
const esWindows = process.platform === "win32";
function matar() {
  if (!servidor) return;
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

if (!urlRemota) {
  servidor = spawn("pnpm", ["exec", "next", "start", "-p", String(puerto)], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    shell: esWindows,
  });
  let registro = "";
  servidor.stdout.on("data", (d) => (registro += d));
  servidor.stderr.on("data", (d) => (registro += d));
  let escucha = false;
  for (let i = 0; i < 60 && !escucha; i++) {
    try {
      escucha = Boolean((await fetch(`${base}/entrar`)).status);
    } catch {
      await new Promise((resolver) => setTimeout(resolver, 1000));
    }
  }
  if (!escucha) {
    console.error("✗ humo: el servidor no respondió. ¿Está la base arriba (pnpm db:up) y el build hecho (pnpm build)?");
    console.error(registro.slice(-1200));
    matar();
    process.exit(1);
  }
}

try {
  await sinSesion();
  if (!soloSinSesion) await entrarYSalir();
} finally {
  matar();
}
if (fallos > 0) {
  console.error(`✗ humo: ${fallos} comprobaciones fallaron.`);
  process.exit(1);
}
console.log("✓ humo: todo responde como debe.");
