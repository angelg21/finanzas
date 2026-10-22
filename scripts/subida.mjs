#!/usr/bin/env node
/**
 * Tipos de lo que sube Vercel. Su build revisa los tipos solo con lo que deja pasar .vercelignore: si algo de src
 * importa un archivo que no sube, aquí `tipos` pasa y allá el despliegue falla (TS2307 con scripts/estructura.mjs,
 * 2026-10-17). Copia lo que sube a .next/subida, genera los tipos de las rutas y corre tsc ahí; los paquetes se
 * resuelven subiendo hasta el node_modules del repo. Dentro de node_modules no sirve: ahí TypeScript no lee los .mjs.
 * Lo corre `pnpm verify` antes del build.
 */
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import ignore from "ignore";

const cwd = process.cwd();
const destino = path.join(cwd, ".next", "subida");
const reglas = ignore().add(fs.readFileSync(path.join(cwd, ".vercelignore"), "utf8"));

// Lo versionado más lo nuevo sin ignorar, como el sello: lo que subirá al publicar este árbol.
const suben = execFileSync("git", ["ls-files", "-c", "-o", "--exclude-standard", "-z"], { cwd })
  .toString()
  .split("\0")
  .filter((a) => a && !reglas.ignores(a) && fs.existsSync(path.join(cwd, a)));

fs.rmSync(destino, { recursive: true, force: true });
for (const archivo of suben) {
  fs.mkdirSync(path.dirname(path.join(destino, archivo)), { recursive: true });
  fs.copyFileSync(path.join(cwd, archivo), path.join(destino, archivo));
}
console.log(`suben ${suben.length} archivos`);

const next = path.join(cwd, "node_modules", "next", "dist", "bin", "next");
const tsc = path.join(cwd, "node_modules", "typescript", "bin", "tsc");
let estado = 0;
for (const [nombre, args] of [
  ["typegen", [next, "typegen"]],
  ["tsc", [tsc, "--noEmit", "-p", "."]],
]) {
  const r = spawnSync(process.execPath, args, { cwd: destino, stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`✗ subida: falló ${nombre} con solo lo que sube Vercel. Revisa .vercelignore o el import.`);
    estado = 1;
    break;
  }
}
fs.rmSync(destino, { recursive: true, force: true });
process.exit(estado);
