#!/usr/bin/env node
/**
 * Gates del proyecto.
 *   node scripts/verificar.mjs fast     → tipos, lint, formato, estructura, unitarias (lo corre el hook Stop)
 *   node scripts/verificar.mjs          → lo anterior + tipos de lo que sube Vercel + build + humo (bloquea el merge)
 *   --forzar                            → repite aunque el sello esté vigente
 * Al pasar, sella el árbol para no repetir sobre el mismo código.
 */
import { spawnSync } from "node:child_process";
import { escribirSello, huellaCodigo, selloVigente } from "./sello.mjs";

const cwd = process.cwd();
const modo = process.argv.includes("fast") ? "fast" : "full";
const forzar = process.argv.includes("--forzar");

if (!forzar && selloVigente(cwd, modo)) {
  console.log(`✓ verify:${modo} ya pasó sobre este mismo código (sello vigente). Usa --forzar para repetirlo.`);
  process.exit(0);
}

const pasos = [
  ["tipos", "pnpm", ["exec", "tsc", "--noEmit"]],
  ["lint", "pnpm", ["exec", "eslint"]],
  ["formato", "pnpm", ["exec", "prettier", "--check", "."]],
  ["estructura", "node", ["scripts/estructura.mjs", "--todo"]],
  ["unitarias", "pnpm", ["exec", "vitest", "run", "--passWithNoTests"]],
];
if (modo === "full") {
  pasos.push(["subida", "node", ["scripts/subida.mjs"]]);
  pasos.push(["build", "pnpm", ["exec", "next", "build"]]);
  pasos.push(["humo", "node", ["scripts/humo.mjs"]]);
}

const inicio = Date.now();
for (const [nombre, comando, args] of pasos) {
  const t = Date.now();
  console.log(`\n▶ ${nombre}`);
  const r = spawnSync(comando, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) {
    console.error(`\n✗ verify:${modo} falló en "${nombre}". Arregla y vuelve a correr.`);
    process.exit(1);
  }
  console.log(`✓ ${nombre} (${((Date.now() - t) / 1000).toFixed(1)} s)`);
}

const huella = huellaCodigo(cwd);
escribirSello(cwd, modo, huella);
if (modo === "full") escribirSello(cwd, "fast", huella);
console.log(`\n✓ verify:${modo} en verde en ${((Date.now() - inicio) / 1000).toFixed(1)} s. Árbol sellado.`);
