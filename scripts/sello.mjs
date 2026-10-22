/**
 * Sello de verificación: huella del código tal como está ahora. Si el sello guardado coincide,
 * verify ya pasó sobre este mismo árbol y no hace falta repetirlo. Vive en node_modules/.cache, fuera de git.
 */
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/** Solo lo que afecta al resultado de verify. Los documentos no rompen el build. */
const RAICES = [
  "src",
  "drizzle",
  "scripts",
  "package.json",
  "pnpm-lock.yaml",
  "tsconfig.json",
  "next.config.ts",
  ".vercelignore",
  "eslint.config.mjs",
  "postcss.config.mjs",
  "vitest.config.mts",
  ".prettierrc",
];

export function archivosDeCodigo(cwd) {
  const salida = execSync("git ls-files -c -o --exclude-standard -z", { cwd }).toString();
  return salida
    .split("\0")
    .filter(Boolean)
    .filter((a) => RAICES.some((r) => a === r || a.startsWith(`${r}/`)))
    .sort();
}

export function huellaCodigo(cwd) {
  const h = crypto.createHash("sha1");
  for (const archivo of archivosDeCodigo(cwd)) {
    try {
      const st = fs.statSync(path.join(cwd, archivo));
      h.update(`${archivo}:${st.size}:${Math.round(st.mtimeMs)}\n`);
    } catch {
      // borrado entre el listado y el stat: no cuenta
    }
  }
  return h.digest("hex");
}

const carpeta = (cwd) => path.join(cwd, "node_modules", ".cache", "finanzas");

export function leerSello(cwd, modo) {
  try {
    return JSON.parse(fs.readFileSync(path.join(carpeta(cwd), `sello-${modo}.json`), "utf8"));
  } catch {
    return null;
  }
}

export function escribirSello(cwd, modo, huella) {
  fs.mkdirSync(carpeta(cwd), { recursive: true });
  fs.writeFileSync(
    path.join(carpeta(cwd), `sello-${modo}.json`),
    JSON.stringify({ huella, fecha: new Date().toISOString() }),
  );
}

export function selloVigente(cwd, modo) {
  const sello = leerSello(cwd, modo);
  return Boolean(sello && sello.huella === huellaCodigo(cwd));
}
