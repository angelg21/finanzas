#!/usr/bin/env node
/** PostToolUse en Edit y Write: pasa Prettier al archivo tocado. Silencioso; si falla, lo dirá verify. */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { leerEntrada } from "./comun.mjs";

const entrada = leerEntrada();
const archivo = String(entrada.tool_input?.file_path ?? "");
if (!archivo || !fs.existsSync(archivo)) process.exit(0);
if (!/\.(ts|tsx|mjs|js|json|css|md)$/.test(archivo)) process.exit(0);
if (/node_modules|\.next|drizzle[\\/]meta/.test(archivo)) process.exit(0);

spawnSync("pnpm", ["exec", "prettier", "--write", "--log-level", "silent", archivo], {
  cwd: entrada.cwd || process.cwd(),
  stdio: "ignore",
  shell: process.platform === "win32",
});
process.exit(0);
