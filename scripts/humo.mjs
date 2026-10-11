#!/usr/bin/env node
/**
 * Prueba de humo: levanta el build (`next start`) en un puerto aparte y comprueba que cada ruta responde.
 * Requiere la base local arriba (pnpm db:up) y un build hecho (verify lo hace antes).
 */
import { execSync, spawn } from "node:child_process";

const puerto = 3123;
const base = `http://localhost:${puerto}`;
const rutas = [
  ["/", 200],
  ["/movimientos", 200],
  ["/sobres", 200],
  ["/cuentas", 200],
  ["/nuevo", 200],
  ["/sobres/999999", 404],
];

const esWindows = process.platform === "win32";
const servidor = spawn("pnpm", ["exec", "next", "start", "-p", String(puerto)], {
  cwd: process.cwd(),
  stdio: ["ignore", "pipe", "pipe"],
  shell: esWindows,
});
let registro = "";
servidor.stdout.on("data", (d) => (registro += d));
servidor.stderr.on("data", (d) => (registro += d));

function matar() {
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

async function esperarServidor() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${base}/`);
      if (r.status) return true;
    } catch {
      // todavía no escucha
    }
    await new Promise((resolver) => setTimeout(resolver, 1000));
  }
  return false;
}

if (!(await esperarServidor())) {
  console.error("✗ humo: el servidor no respondió. ¿Está la base arriba (pnpm db:up) y el build hecho (pnpm build)?");
  console.error(registro.slice(-1200));
  matar();
  process.exit(1);
}

let fallos = 0;
for (const [ruta, esperado] of rutas) {
  const r = await fetch(`${base}${ruta}`, { redirect: "manual" });
  const ok = r.status === esperado;
  if (!ok) fallos++;
  console.log(`${ok ? "✓" : "✗"} ${ruta} → ${r.status}${ok ? "" : ` (esperado ${esperado})`}`);
}
matar();
if (fallos > 0) {
  console.error(`✗ humo: ${fallos} rutas fallaron.`);
  process.exit(1);
}
console.log("✓ humo: todas las rutas responden.");
