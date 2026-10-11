#!/usr/bin/env node
/**
 * Stop: el turno no cierra con código tocado y verify:fast en rojo.
 *   - Si el sello está vigente (nada cambió desde el último verde), no hace nada.
 *   - Si verify:fast falla, bloquea el cierre y devuelve el final de la salida como motivo.
 *   - Tras tres intentos en la misma sesión cede, avisando que el árbol quedó roto.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { selloVigente } from "../../scripts/sello.mjs";
import { git, leerEntrada, responder } from "./comun.mjs";

const entrada = leerEntrada();
const cwd = entrada.cwd || process.cwd();
const sesion = String(entrada.session_id ?? "sin-sesion").replace(/[^a-zA-Z0-9_-]/g, "");

if (!git("rev-parse --is-inside-work-tree", cwd)) process.exit(0);
if (!fs.existsSync(path.join(cwd, "node_modules"))) process.exit(0);
if (selloVigente(cwd, "fast")) process.exit(0);

const carpeta = path.join(cwd, "node_modules", ".cache", "finanzas");
fs.mkdirSync(carpeta, { recursive: true });
const contador = path.join(carpeta, `gate-${sesion}.txt`);
const intentos = fs.existsSync(contador) ? Number(fs.readFileSync(contador, "utf8")) || 0 : 0;

if (intentos >= 3) {
  fs.writeFileSync(contador, "0");
  process.stdout.write(
    "Gate: tres intentos sin verde. Cedo, pero el árbol queda con verify:fast en rojo; dilo explícitamente.",
  );
  process.exit(0);
}

const resultado = spawnSync("node", ["scripts/verificar.mjs", "fast"], {
  cwd,
  encoding: "utf8",
  shell: process.platform === "win32",
  timeout: 540_000,
});
const salida = `${resultado.stdout ?? ""}${resultado.stderr ?? ""}`;

if (resultado.status === 0) {
  if (fs.existsSync(contador)) fs.unlinkSync(contador);
  process.exit(0);
}

fs.writeFileSync(contador, String(intentos + 1));
const cola = salida.split("\n").filter(Boolean).slice(-40).join("\n");
responder({
  decision: "block",
  reason: `verify:fast en rojo (intento ${intentos + 1} de 3). Arregla la causa, no la prueba; luego vuelve a cerrar el turno.\n\n${cola}`,
});
