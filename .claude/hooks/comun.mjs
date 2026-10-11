/** Utilidades compartidas por los hooks: leer la entrada, correr comandos, localizar la feature activa. */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export function leerEntrada() {
  try {
    const texto = fs.readFileSync(0, "utf8");
    return texto.trim() ? JSON.parse(texto) : {};
  } catch {
    return {};
  }
}

export function git(args, cwd) {
  try {
    return execSync(`git ${args}`, { cwd, stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "";
  }
}

export function responder(objeto) {
  process.stdout.write(JSON.stringify(objeto));
}

/** La feature con etapas sin marcar, o null. Lee docs/features/NNN-slug/progress.md. */
export function featureActiva(cwd) {
  const carpeta = path.join(cwd, "docs", "features");
  if (!fs.existsSync(carpeta)) return null;
  const candidatas = fs
    .readdirSync(carpeta, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{3}-/.test(d.name))
    .map((d) => d.name)
    .sort();
  for (const nombre of candidatas.reverse()) {
    const ruta = path.join(carpeta, nombre, "progress.md");
    if (!fs.existsSync(ruta)) continue;
    const texto = fs.readFileSync(ruta, "utf8");
    const etapas = [
      ...texto.matchAll(/^- \[( |x)\] (Spec|Construida|Validada|Verificada|Revisada|Fusionada)[^\n]*/gim),
    ];
    const fusionada = etapas.some((m) => /Fusionada/i.test(m[2]) && m[1] === "x");
    if (fusionada) continue;
    const tareas = [...texto.matchAll(/^- \[( |x)\] (T\d+)[^\n]*/gm)];
    const hechas = tareas.filter((m) => m[1] === "x").length;
    const siguiente = tareas.find((m) => m[1] === " ");
    const pendiente = etapas.find((m) => m[1] === " ");
    return {
      nombre,
      numero: nombre.slice(0, 3),
      tareasHechas: hechas,
      tareasTotal: tareas.length,
      siguienteTarea: siguiente ? siguiente[0].replace(/^- \[ \] /, "") : null,
      siguienteEtapa: pendiente ? pendiente[2] : null,
    };
  }
  return null;
}

export function comandoSiguiente(feature) {
  if (!feature) return "/f-spec <idea> para empezar una feature, o cambio directo si cabe en una frase";
  const n = feature.numero;
  switch (feature.siguienteEtapa) {
    case "Spec":
      return `leer y corregir docs/features/${feature.nombre}/spec.md; luego /f-build ${n}`;
    case "Construida":
      return `/f-build ${n}`;
    case "Validada":
      return `mirar las pantallas en el navegador y anotarlo en progress.md; luego /f-verify ${n}`;
    case "Verificada":
      return `/f-verify ${n}`;
    case "Revisada":
      return `/f-review ${n}`;
    case "Fusionada":
      return `/f-ship ${n}`;
    default:
      return `/f-status`;
  }
}
