#!/usr/bin/env node
/** PostToolUse en Edit y Write: devuelve al agente los hallazgos de estructura del archivo tocado. */
import fs from "node:fs";
import path from "node:path";
import { revisarArchivo } from "../../scripts/estructura.mjs";
import { leerEntrada, responder } from "./comun.mjs";

const entrada = leerEntrada();
const cwd = entrada.cwd || process.cwd();
const archivo = String(entrada.tool_input?.file_path ?? "");
if (!archivo || !fs.existsSync(archivo) || !/\.tsx?$/.test(archivo)) process.exit(0);
if (!/(^|[\\/])src[\\/]/.test(path.relative(cwd, archivo) || archivo)) process.exit(0);

const hallazgos = revisarArchivo(archivo, fs.readFileSync(archivo, "utf8"));
if (hallazgos.length === 0) process.exit(0);

const relativo = path.relative(cwd, archivo);
const texto = hallazgos.map((h) => `${h.nivel === "error" ? "✗" : "△"} ${h.mensaje}`).join("\n");
responder({
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: `Estructura de ${relativo}:\n${texto}\nLos ✗ hacen fallar verify; corrígelos antes de seguir.`,
  },
});
