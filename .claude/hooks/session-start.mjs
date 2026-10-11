#!/usr/bin/env node
/** SessionStart: el mismo briefing en cada sesión. Lo que imprime entra al contexto. */
import fs from "node:fs";
import path from "node:path";
import { selloVigente } from "../../scripts/sello.mjs";
import { comandoSiguiente, featureActiva, git, leerEntrada } from "./comun.mjs";

const entrada = leerEntrada();
const cwd = entrada.cwd || process.cwd();

const rama = git("branch --show-current", cwd) || "(sin git)";
const cambios = git("status --porcelain", cwd);
const nCambios = cambios ? cambios.split("\n").length : 0;
const feature = featureActiva(cwd);

let pendientesInterfaz = 0;
try {
  const obs = fs.readFileSync(path.join(cwd, "docs", "observaciones.md"), "utf8");
  const secciones = obs.split(/^## /m).slice(1);
  pendientesInterfaz = secciones.filter(
    (s) => !/\*\*Hecho\*\*|\*\*Cambio en la interfaz\*\*|\*\*Cambio\*\*/.test(s),
  ).length;
} catch {
  // sin archivo de observaciones
}

let sello = "pendiente";
try {
  sello = selloVigente(cwd, "fast") ? "verify:fast vigente" : "verify:fast pendiente";
} catch {
  // sin node_modules todavía
}

const lineas = [
  `Briefing finanzas · ${new Date().toISOString().slice(0, 10)}`,
  `Rama: ${rama}${nCambios ? ` · ${nCambios} archivos con cambios sin commit` : " · árbol limpio"}`,
  feature
    ? `Feature activa: ${feature.nombre} · ${feature.tareasHechas}/${feature.tareasTotal} tareas${feature.siguienteTarea ? ` · siguiente: ${feature.siguienteTarea}` : ""}`
    : "Feature activa: ninguna",
  `Siguiente paso: ${comandoSiguiente(feature)}`,
  `Gate: ${sello}`,
  pendientesInterfaz ? `Observaciones de interfaz sin resolver: ${pendientesInterfaz} (docs/observaciones.md)` : null,
  "Reglas: una sesión, una feature; /clear entre etapas; sin spec no se codifica (CLAUDE.md).",
].filter(Boolean);

process.stdout.write(lineas.join("\n"));
