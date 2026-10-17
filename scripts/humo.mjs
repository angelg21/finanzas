#!/usr/bin/env node
/**
 * Prueba de humo (spec 002, criterios 1, 7, 8, 13 y 14).
 *   pnpm humo                                   → levanta el build en un puerto aparte; sin sesión y con sesión
 *   pnpm humo -- --sin-sesion                   → lo mismo, solo sin sesión
 *   pnpm humo -- --url <origen> --sin-sesion    → contra una URL ya publicada, sin levantar nada
 *
 * Sin sesión: cada ruta con datos redirige a /entrar?siguiente=<ruta> sin datos en el cuerpo, un POST que no es
 * una acción va con 303 a /entrar, responden las rutas públicas y toda respuesta trae las cabeceras de seguridad.
 * Con sesión: entra con HUMO_CORREO y HUMO_CLAVE (.env.local) por el formulario de /entrar, como un navegador sin
 * JavaScript; comprueba las cookies (HttpOnly, SameSite=Lax, Secure), que las rutas responden, y sale.
 * Sin --url requiere la base local arriba (pnpm db:up) y un build hecho (verify lo hace antes).
 */
import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
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
  "/nuevo/ingreso",
  "/nuevo/deuda",
  "/nuevo/deuda?deuda=1",
  "/sobres/repartir",
  "/sobres/reglas",
  "/categorias",
  "/categorias/nueva",
  "/categorias/1",
  "/deudas",
  "/deudas/nueva",
  "/deudas/prestar",
  "/deudas/apartar",
  "/deudas/1",
  "/deudas/1/editar",
  "/ruta-que-no-existe",
];
/** Lo único que responde sin sesión. */
const publicas = [
  ["/entrar", 200],
  ["/sin-conexion", 200],
  ["/sw.js", 200],
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
  ["/nuevo/ingreso", 200],
  ["/nuevo/deuda", 200],
  // Una deuda que no existe no se elige: la página responde con las listas.
  ["/nuevo/deuda?deuda=999999", 200],
  ["/sobres/repartir", 200],
  ["/sobres/reglas", 200],
  ["/categorias", 200],
  ["/categorias/nueva", 200],
  ["/deudas", 200],
  ["/deudas/nueva", 200],
  ["/deudas/prestar", 200],
  ["/deudas/apartar", 200],
  ["/sobres/999999", 404],
  ["/categorias/999999", 404],
  ["/deudas/999999", 404],
  ["/deudas/999999/editar", 404],
  ["/deudas/abc", 404],
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
  // Un POST que no es una acción (así llega un formulario enviado sin JavaScript) va a /entrar sin datos.
  for (const ruta of ["/movimientos", "/nuevo/gasto"]) {
    const r = await pedir(ruta, { method: "POST" });
    const cuerpo = await r.text();
    const ubicacion = r.headers.get("location") ?? "";
    comprobar(
      r.status === 303 && ubicacion.includes(`/entrar?siguiente=${encodeURIComponent(ruta)}`) && cuerpo.length < 300,
      `POST ${ruta} → ${r.status} a /entrar`,
      `${r.status} ${ubicacion}`,
    );
  }
  // Un POST con la cabecera de una acción y la de RSC: el proxy no lo distingue de una acción (Next le quita rsc y
  // ?_rsc) y Next renderiza la página. Lo frena exigirSesion: la respuesta trae la redirección a /entrar y ningún
  // dato (ADR 0011). Next contesta primero con un 307 a ?_rsc; se sigue, como haría un atacante.
  {
    const cabecerasRsc = { "next-action": "x", rsc: "1" };
    let r = await pedir("/sobres/18", { method: "POST", headers: cabecerasRsc });
    const rsc = r.headers.get("location") ?? "";
    if (r.status === 307 && rsc.includes("_rsc")) {
      await r.arrayBuffer();
      r = await pedir(rsc.replace(base, ""), { method: "POST", headers: cabecerasRsc });
    }
    const cuerpo = await r.text();
    const cortada = /NEXT_REDIRECT[^"]*\/entrar/.test(cuerpo) && !/Centavos|<title/.test(cuerpo);
    comprobar(cortada, `POST /sobres/18 con next-action y rsc → ${r.status}, cortada por la sesión y sin datos`);
  }
  // Otros métodos no pasan ni con la cabecera de una acción: Next renderizaría la página (auditoría T14, hallazgo 2).
  for (const metodo of ["PUT", "PATCH", "DELETE"]) {
    const r = await pedir("/sobres/3", { method: metodo, headers: { "next-action": "x" } });
    const cuerpo = await r.text();
    comprobar(
      r.status === 405 && !cuerpo.includes("<title"),
      `${metodo} /sobres/3 con next-action → ${r.status}, sin página`,
      `${r.status}, ${cuerpo.length} bytes`,
    );
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
  if (!urlRemota) await rutasDelBuildSinSesion();
}

/**
 * Criterio 1, también para las rutas que se agreguen después: todas las que trae el build, no solo las de la lista.
 * Fuera de las públicas, cada una redirige a /entrar sin datos. Solo contra el build local, que tiene el manifiesto.
 */
async function rutasDelBuildSinSesion() {
  const manifiesto = JSON.parse(fs.readFileSync(".next/app-path-routes-manifest.json", "utf8"));
  const rutas = [...new Set(Object.values(manifiesto))]
    .filter((ruta) => !ruta.startsWith("/_"))
    .map((ruta) => ruta.replace("[__metadata_id__]", "32").replace(/\[[^\]]+\]/g, "1"));
  const responden = publicas.map(([ruta]) => ruta);
  let redirigen = 0;
  for (const ruta of rutas.filter((r) => !responden.includes(r))) {
    const r = await pedir(ruta);
    const cuerpo = await r.text();
    const ubicacion = r.headers.get("location") ?? "";
    const ok =
      r.status === 307 && ubicacion.endsWith(`/entrar?siguiente=${encodeURIComponent(ruta)}`) && cuerpo.length < 300;
    if (ok) redirigen++;
    else
      comprobar(
        false,
        `${ruta} (del build) → ${r.status} a /entrar`,
        `${r.status} ${ubicacion}, ${cuerpo.length} bytes`,
      );
  }
  const publicasDelBuild = rutas.filter((r) => responden.includes(r)).length;
  comprobar(
    redirigen + publicasDelBuild === rutas.length && rutas.length > 0,
    `las ${rutas.length} rutas del build: ${publicasDelBuild} públicas y ${redirigen} redirigen a /entrar`,
  );
}

/** Criterio 14: el service worker nunca se guarda en caché y lleva su propia CSP. */
async function cabecerasDelServiceWorker() {
  const r = await pedir("/sw.js");
  await r.arrayBuffer();
  const esperadas = {
    "cache-control": "no-cache, no-store, must-revalidate",
    "content-security-policy": "default-src 'self'; script-src 'self'",
  };
  for (const [nombre, valor] of Object.entries(esperadas)) {
    comprobar(r.headers.get(nombre) === valor, `/sw.js ${nombre}`, `${r.headers.get(nombre)}`);
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
  await cabecerasDelServiceWorker();
  if (!soloSinSesion) await entrarYSalir();
} finally {
  matar();
}
if (fallos > 0) {
  console.error(`✗ humo: ${fallos} comprobaciones fallaron.`);
  process.exit(1);
}
console.log("✓ humo: todo responde como debe.");
