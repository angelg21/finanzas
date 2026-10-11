#!/usr/bin/env node
/**
 * PreToolUse en Edit y Write.
 *   - Niega escribir archivos .env (salvo .env.example) y contenido con pinta de secreto.
 *   - Escala a humano tocar migraciones ya generadas (drizzle/) y la configuración del propio arnés.
 */
import path from "node:path";
import { leerEntrada, responder } from "./comun.mjs";

const entrada = leerEntrada();
const herramienta = entrada.tool_name ?? "";
const datos = entrada.tool_input ?? {};
const archivo = String(datos.file_path ?? "").replace(/\\/g, "/");
const contenido = String(datos.content ?? datos.new_string ?? "");
const nombre = path.basename(archivo);

function decidir(decision, razon) {
  responder({
    hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: decision, permissionDecisionReason: razon },
  });
  process.exit(0);
}

if (!["Edit", "Write"].includes(herramienta) || !archivo) process.exit(0);

if (/^\.env/.test(nombre) && nombre !== ".env.example") {
  decidir("deny", `No se escriben archivos de entorno (${nombre}). Los secretos los pone la persona a mano.`);
}

const patronesSecreto = [
  /sk-[A-Za-z0-9_-]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /ghp_[A-Za-z0-9]{30,}/,
  /-----BEGIN (RSA|OPENSSH|EC|PGP) PRIVATE KEY/,
  /postgres(ql)?:\/\/[^:\s/]+:[^@\s]+@(?!localhost|127\.0\.0\.1)/,
  /\b[0-9]{9,10}:[A-Za-z0-9_-]{35}\b/, // token de bot de Telegram
];
if (patronesSecreto.some((p) => p.test(contenido))) {
  decidir("deny", "El contenido parece incluir una clave o secreto. Van en .env.local, nunca en el código.");
}

if (/(^|\/)drizzle\/.+\.(sql|json)$/.test(archivo)) {
  decidir(
    "ask",
    "Editar una migración o su metadato ya generado puede desincronizar la base. Las migraciones salen de pnpm db:generate; confirma si de verdad quieres tocar este archivo.",
  );
}

if (/(^|\/)\.claude\/settings(\.local)?\.json$/.test(archivo)) {
  decidir("ask", "Cambiar la configuración del arnés (permisos y hooks) requiere confirmación de la persona.");
}

process.exit(0);
