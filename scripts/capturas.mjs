#!/usr/bin/env node
/**
 * Capturas de pantalla para mirar la interfaz sin abrir el navegador: escritorio y ancho de celular,
 * en claro y oscuro. Usa Edge o Chrome sin ventana. Las guarda en capturas/ (fuera de git).
 *   pnpm capturas                         → contra el servidor de desarrollo en http://localhost:3000
 *   pnpm capturas http://localhost:3123   → contra otra dirección
 *   pnpm capturas -- /sobres /cuentas     → rutas concretas (por defecto: / /sobres /movimientos)
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
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

for (const tema of ["claro", "oscuro"]) {
  // Escritorio: una captura por ruta.
  for (const ruta of paginas) {
    const nombre = `escritorio-${tema}-${ruta === "/" ? "inicio" : ruta.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-")}`;
    capturar(nombre, "1440,1000", conTema(ruta, tema));
  }
  // Celular: tres iframes de 390 px uno al lado del otro, porque el navegador sin ventana no baja de 500 px.
  const marcos = paginas
    .slice(0, 3)
    .map((r) => `<iframe src="${conTema(r, tema)}"></iframe>`)
    .join("\n");
  const envoltorio = path.join(carpeta, `movil-${tema}.html`);
  fs.writeFileSync(
    envoltorio,
    `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#888;display:flex;gap:20px;padding:20px}iframe{border:0;width:390px;height:844px;background:#000}</style></head><body>${marcos}</body></html>`,
  );
  capturar(`movil-${tema}`, "1260,900", `file:///${envoltorio.replace(/\\/g, "/")}`);
}
