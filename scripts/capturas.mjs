#!/usr/bin/env node
/**
 * Capturas de pantalla para mirar la interfaz sin abrir el navegador: escritorio (1440 × 1000) y celular
 * (390 × 844), en claro y oscuro, una por ruta. Usa Edge o Chrome sin ventana, manejado por el protocolo de DevTools
 * con el WebSocket que trae Node: el celular se emula, porque el navegador sin ventana no baja de 500 px y la app no
 * se deja meter en un iframe (X-Frame-Options: DENY). Si .env.local trae HUMO_CORREO y HUMO_CLAVE, entra primero
 * con el usuario de prueba, porque sin sesión toda pantalla con datos redirige a /entrar. Las guarda en capturas/.
 *   pnpm capturas                         → contra el servidor de desarrollo en http://localhost:3000
 *   pnpm capturas http://localhost:3123   → contra otra dirección
 *   pnpm capturas -- /sobres /cuentas     → rutas concretas (por defecto: / /sobres /movimientos)
 * En Git Bash, las rutas que empiezan por / se convierten en rutas de Windows: MSYS_NO_PATHCONV=1 node scripts/…
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const base = (args.find((a) => a.startsWith("http")) ?? "http://localhost:3000").replace(/\/$/, "");
const rutas = args.filter((a) => a.startsWith("/"));
const paginas = rutas.length ? rutas : ["/", "/sobres", "/movimientos"];
const tamanos = {
  escritorio: { width: 1440, height: 1000, mobile: false },
  movil: { width: 390, height: 844, mobile: true },
};

const candidatos = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];
const navegador = candidatos.find((c) => fs.existsSync(c));
if (!navegador) {
  console.error("No encontré Edge ni Chrome para capturar.");
  process.exit(1);
}

try {
  process.loadEnvFile(".env.local");
} catch {
  // Sin .env.local se captura sin sesión: solo /entrar y /sin-conexion muestran algo propio.
}

const carpeta = path.join(process.cwd(), "capturas");
fs.mkdirSync(carpeta, { recursive: true });

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const conTema = (ruta, tema) => `${base}${ruta}${ruta.includes("?") ? "&" : "?"}tema=${tema}`;
const nombreDe = (ruta) =>
  ruta === "/"
    ? "inicio"
    : ruta
        .replace(/^\//, "")
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/-$/, "");

const perfil = fs.mkdtempSync(path.join(os.tmpdir(), "capturas-"));
const puerto = 9400 + Math.floor(Math.random() * 400);
const proceso = spawn(
  navegador,
  [
    "--headless=new",
    "--hide-scrollbars",
    `--remote-debugging-port=${puerto}`,
    `--user-data-dir=${perfil}`,
    "--no-first-run",
    "about:blank",
  ],
  { stdio: "ignore" },
);

try {
  let pagina;
  for (let i = 0; i < 40 && !pagina; i++) {
    try {
      pagina = (await (await fetch(`http://localhost:${puerto}/json/list`)).json()).find((t) => t.type === "page");
    } catch {
      await espera(250);
    }
  }
  const ws = new WebSocket(pagina.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  let id = 0;
  const pendientes = new Map();
  ws.addEventListener("message", (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pendientes.has(d.id)) pendientes.get(d.id)(d.result);
  });
  const cdp = (method, params = {}) =>
    new Promise((r) => {
      pendientes.set(++id, r);
      ws.send(JSON.stringify({ id, method, params }));
    });
  await cdp("Page.enable");

  if (process.env.HUMO_CORREO && process.env.HUMO_CLAVE) {
    await cdp("Page.navigate", { url: `${base}/entrar` });
    await espera(2500);
    const credenciales = JSON.stringify([process.env.HUMO_CORREO, process.env.HUMO_CLAVE]);
    await cdp("Runtime.evaluate", {
      expression: `(() => { const [c, k] = ${credenciales}; const f = document.querySelector("form"); f.querySelector("[name=correo]").value = c; f.querySelector("[name=clave]").value = k; f.requestSubmit(); })()`,
    });
    await espera(3500);
    console.log("con sesión del usuario de prueba");
  }

  for (const [nombreTamano, tamano] of Object.entries(tamanos)) {
    await cdp("Emulation.setDeviceMetricsOverride", { ...tamano, deviceScaleFactor: tamano.mobile ? 2 : 1 });
    for (const tema of ["claro", "oscuro"]) {
      for (const ruta of paginas) {
        await cdp("Page.navigate", { url: conTema(ruta, tema) });
        await espera(2500);
        const { data } = await cdp("Page.captureScreenshot", { format: "png" });
        const destino = path.join(carpeta, `${nombreTamano}-${tema}-${nombreDe(ruta)}.png`);
        fs.writeFileSync(destino, Buffer.from(data, "base64"));
        console.log(`✓ ${path.relative(process.cwd(), destino)}`);
      }
    }
  }
  ws.close();
} finally {
  proceso.kill();
}
