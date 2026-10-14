#!/usr/bin/env node
/**
 * PreToolUse en Bash y PowerShell (auditoría T14 de la feature 002, hallazgo 4).
 * Niega los comandos que nombren archivos con secretos: los de entorno (salvo .env.example), la cadena de producción
 * en ~/.finanzas/produccion.env y la carpeta .vercel, más los comandos de Vercel que bajan variables a disco. Lo que
 * el agente lee queda en la transcripción, que se guarda en disco y viaja al proveedor del modelo: una búsqueda
 * descuidada, o una instrucción escondida en algo que lea, no puede imprimir la cadena de producción.
 * Los scripts del repo leen esos archivos por dentro (humo, capturas, conexion-script) sin nombrarlos en el comando.
 */
import { leerEntrada, responder } from "./comun.mjs";

const entrada = leerEntrada();
const herramienta = entrada.tool_name ?? "";
const comando = String(entrada.tool_input?.command ?? "");

if (!["Bash", "PowerShell"].includes(herramienta) || !comando) process.exit(0);

const prohibidos = [
  { patron: /(^|[^\w.])\.env(?!\.example\b)(\.[\w-]+)*\b/i, que: "un archivo de entorno" },
  { patron: /produccion\.env/i, que: "la cadena de producción" },
  { patron: /(^|[^\w])\.finanzas([\\/]|\b)/i, que: "la carpeta de la cadena de producción" },
  { patron: /(^|[^\w])\.vercel([\\/]|\b)/i, que: "la carpeta .vercel" },
  { patron: /\bvercel\s+(env\s+pull|pull|build)\b/i, que: "un comando de Vercel que baja variables a disco" },
];

const encontrado = prohibidos.find(({ patron }) => patron.test(comando));
if (encontrado) {
  responder({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: `El comando nombra ${encontrado.que}. Los secretos no pasan por la transcripción: si un script los necesita, que los lea por dentro sin mostrarlos.`,
    },
  });
}
process.exit(0);
