#!/usr/bin/env node
/**
 * Reglas de estructura del código. Cada regla existe por un defecto real o una decisión del proyecto;
 * la razón va en el mensaje. Se usa de dos formas:
 *   node scripts/estructura.mjs --todo            → revisa todo src/ (lo corre verify)
 *   node scripts/estructura.mjs <archivo> [...]   → revisa archivos concretos (lo usa el hook PostToolUse)
 * Sale con 1 si hay errores; los avisos no bloquean.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const AVISO_LINEAS = 320;
export const TECHO_LINEAS = 700;

/** Capa a la que pertenece un archivo según su ruta (ADR 0005). */
function capaDe(rel) {
  if (/(^|\/)src\/lib\//.test(rel)) return "lib";
  if (/(^|\/)src\/components\//.test(rel)) return "components";
  if (/(^|\/)src\/db\//.test(rel)) return "db";
  if (/(^|\/)src\/app\//.test(rel)) return "app";
  return null;
}

/** Módulos importados en tiempo de ejecución. Los `import type` no acoplan y no cuentan. */
function importsEnEjecucion(contenido) {
  const patron = /^import\s+(?!type\b)[^;]*?from\s+["']([^"']+)["']/gm;
  return [...contenido.matchAll(patron)].map((m) => m[1]);
}

export function revisarArchivo(ruta, contenido) {
  const hallazgos = [];
  const error = (mensaje) => hallazgos.push({ nivel: "error", mensaje });
  const aviso = (mensaje) => hallazgos.push({ nivel: "aviso", mensaje });

  const rel = ruta.replace(/\\/g, "/");
  const enSrc = /(^|\/)src\//.test(rel);
  const esTs = /\.tsx?$/.test(rel);
  const esPrueba = /\.test\.tsx?$/.test(rel);
  const esSemilla = /src\/db\/(seed|semilla-demo)\.ts$/.test(rel);
  const lineas = contenido.split("\n").length;

  if (lineas > TECHO_LINEAS) {
    error(
      `${lineas} líneas: supera el techo de ${TECHO_LINEAS}. Divide por responsabilidad, nunca por la mitad ni en un "helpers".`,
    );
  } else if (lineas > AVISO_LINEAS) {
    aviso(`${lineas} líneas: pasa de ${AVISO_LINEAS}. Comprueba que el archivo siga tratando de una sola cosa.`);
  }

  if (enSrc && esTs) {
    if (/\bdark:/.test(contenido)) {
      error(
        "Usa `dark:`. Los temas se resuelven con los tokens de globals.css; dos diseños se rechazaron por colores sueltos.",
      );
    }
    if (/className=[^\n]*#[0-9a-fA-F]{3,8}\b/.test(contenido)) {
      error("Color #hex dentro de un className. Usa los tokens de globals.css (docs/diseno.md).");
    }
    if (/catch(\s*\([^)]*\))?\s*\{\s*\}/.test(contenido)) {
      error("`catch` vacío. Maneja el error o deja un comentario que diga por qué se ignora.");
    }
    if (/:\s*any\b|\bas any\b/.test(contenido)) {
      error("`any` explícito. Tipa el valor; el esquema de Drizzle ya trae los tipos.");
    }
    if (/dangerouslySetInnerHTML/.test(contenido) && !rel.endsWith("src/app/layout.tsx")) {
      error("`dangerouslySetInnerHTML` fuera del layout. Solo el script de tema puede usarlo.");
    }
    // Las semillas construyen filas de prueba (la tasa es numeric, no dinero); el resto convierte con aCentavos.
    if (!rel.endsWith("src/lib/dinero.ts") && !esSemilla && /\b(parseFloat|toFixed)\(/.test(contenido)) {
      error(
        "`parseFloat` o `toFixed` fuera de src/lib/dinero.ts. El dinero son centavos enteros; convierte con aCentavos y formatea con formatearCentavos.",
      );
    }
    if (/db\.execute\(\s*`[^`]*\$\{/.test(contenido)) {
      error("SQL con interpolación en db.execute. Usa el constructor de consultas o `sql` con parámetros.");
    }
    if (/process\.env\.DATABASE_URL/.test(contenido) && !/src\/db\/(index|conexion-script)\.ts$/.test(rel)) {
      aviso(
        "Lee DATABASE_URL fuera de su sitio. La app conecta en src/db/index.ts; los scripts, en src/db/conexion-script.ts.",
      );
    }
    if (/NEXT_PUBLIC_[A-Z0-9_]*(KEY|SECRET|TOKEN|PASSWORD)/.test(contenido)) {
      error("Clave o secreto expuesto al navegador con NEXT_PUBLIC_.");
    }
    if (/\.(toFixed|toLocaleString)\([^)]*\)\s*\+\s*["'`] ?USD/.test(contenido)) {
      aviso("Formatea dinero con formatearCentavos, no concatenando la unidad a mano.");
    }

    // Fronteras de la arquitectura por capas (ADR 0005): app → components, db, lib · components → lib · db → lib · lib → nada.
    const capa = capaDe(rel);
    const importa = importsEnEjecucion(contenido);
    const desde = (prefijo) => importa.some((i) => i === prefijo || i.startsWith(`${prefijo}/`));
    if (capa === "lib" && ["@/db", "@/components", "@/app", "react", "next", "drizzle-orm"].some(desde)) {
      error(
        "src/lib es lógica pura: no importa base de datos, React, Next ni componentes. Así se prueba sin arrancar nada.",
      );
    }
    if (capa === "components" && ["@/db", "@/app"].some(desde)) {
      error("src/components no accede a la base ni a rutas. Recibe datos por props; la página los consulta.");
    }
    if (capa === "db" && ["@/components", "@/app", "react"].some(desde)) {
      error("src/db no conoce la interfaz. Solo esquema, conexión, consultas y operaciones.");
    }
    if (capa === "app" && !/\/acciones\.ts$/.test(rel) && desde("drizzle-orm")) {
      error("Una página no habla con Drizzle directamente. Pon la consulta en src/db/consultas.ts.");
    }
  }

  if (esPrueba) {
    aviso(
      "Archivo de pruebas. Nunca se debilita, se salta ni se borra una prueba para que el código pase: si estorba, el error está en el código o en la spec.",
    );
  }

  return hallazgos;
}

function listarTs(dir, acumulado = []) {
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const ruta = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      if (entrada.name === "node_modules" || entrada.name === ".next") continue;
      listarTs(ruta, acumulado);
    } else if (/\.tsx?$/.test(entrada.name)) {
      acumulado.push(ruta);
    }
  }
  return acumulado;
}

const esPrincipal = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (esPrincipal) {
  const args = process.argv.slice(2);
  const archivos = args.includes("--todo")
    ? listarTs(path.join(process.cwd(), "src"))
    : args.filter((a) => !a.startsWith("--")).map((a) => path.resolve(a));
  let errores = 0;
  let avisos = 0;
  for (const archivo of archivos) {
    if (!fs.existsSync(archivo)) continue;
    const hallazgos = revisarArchivo(archivo, fs.readFileSync(archivo, "utf8"));
    for (const h of hallazgos) {
      if (h.nivel === "error") errores++;
      else avisos++;
      console.log(`${h.nivel === "error" ? "✗" : "△"} ${path.relative(process.cwd(), archivo)}: ${h.mensaje}`);
    }
  }
  if (errores === 0 && avisos === 0) console.log(`✓ estructura: ${archivos.length} archivos sin hallazgos`);
  else console.log(`estructura: ${errores} errores, ${avisos} avisos`);
  process.exit(errores > 0 ? 1 : 0);
}
