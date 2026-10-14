#!/usr/bin/env node
/**
 * Capturas de pantalla para mirar la interfaz sin abrir el navegador: escritorio y ancho de celular,
 * en claro y oscuro. Usa Edge o Chrome sin ventana. Las guarda en capturas/ (fuera de git), una por ruta.
 * El celular se emula por DevTools (390 × 844): la app no se deja meter en un iframe (X-Frame-Options: DENY).
 *   pnpm capturas                         → contra el servidor de desarrollo en http://localhost:3000
 *   pnpm capturas http://localhost:3123   → contra otra dirección
 *   pnpm capturas -- /sobres /cuentas     → rutas concretas (por defecto: / /sobres /movimientos)
 */
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const base = args.find((a) => a.startsWith("http")) ?? "http://localhost:3000";
const rutas = args.filter((a) => a.startsWith("/"));
const paginas = rutas.length ? rutas : ["/", "/sobres", "/movimientos"];

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

const carpeta = path.join(process.cwd(), "capturas");
fs.mkdirSync(carpeta, { recursive: true });

function capturar(nombre, tamano, url) {
  const destino = path.join(carpeta, `${nombre}.png`);
  execFileSync(
    navegador,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--virtual-time-budget=10000",
      `--window-size=${tamano}`,
      `--screenshot=${destino}`,
      url,
    ],
    { stdio: "ignore" },
  );
  console.log(`✓ ${path.relative(process.cwd(), destino)}`);
}

function conTema(ruta, tema) {
  return `${base}${ruta}${ruta.includes("?") ? "&" : "?"}tema=${tema}`;
}

const nombreDe = (ruta) =>
  ruta === "/"
    ? "inicio"
    : ruta
        .replace(/^\//, "")
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/-$/, "");

// Escritorio: una captura por ruta, con el tamaño de ventana.
for (const tema of ["claro", "oscuro"]) {
  for (const ruta of paginas) capturar(`escritorio-${tema}-${nombreDe(ruta)}`, "1440,1000", conTema(ruta, tema));
}

/**
 * Celular: el navegador sin ventana no baja de 500 px, así que el ancho de 390 se emula por el protocolo de DevTools
 * (Emulation.setDeviceMetricsOverride), con el WebSocket que trae Node.
 */
async function capturarCelular() {
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
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
    await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    for (const tema of ["claro", "oscuro"]) {
      for (const ruta of paginas) {
        await cdp("Page.navigate", { url: conTema(ruta, tema) });
        await espera(2500);
        const { data } = await cdp("Page.captureScreenshot", { format: "png" });
        const destino = path.join(carpeta, `movil-${tema}-${nombreDe(ruta)}.png`);
        fs.writeFileSync(destino, Buffer.from(data, "base64"));
        console.log(`✓ ${path.relative(process.cwd(), destino)}`);
      }
    }
    ws.close();
  } finally {
    proceso.kill();
  }
}
await capturarCelular();
