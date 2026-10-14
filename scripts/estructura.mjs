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

/** Variables NEXT_PUBLIC_ que pueden llegar al navegador (spec 002, criterio 8). Hoy, ninguna. */
const PUBLICAS_PERMITIDAS = [];

/**
 * Lo que sigue a la llave que abre el cuerpo de la función que empieza en `inicio`: salta los parámetros, con sus
 * paréntesis anidados, y el tipo de retorno. Con un tipo de retorno literal ({ ... }) se confunde y la regla falla:
 * mejor un tipo con nombre.
 */
function cuerpoDesde(contenido, inicio) {
  let i = contenido.indexOf("(", inicio);
  if (i < 0) return "";
  for (let abiertos = 0; i < contenido.length; i++) {
    if (contenido[i] === "(") abiertos++;
    else if (contenido[i] === ")" && --abiertos === 0) break;
  }
  const llave = contenido.indexOf("{", i);
  return llave < 0 ? "" : contenido.slice(llave + 1).trimStart();
}

/**
 * Si el cuerpo empieza verificando la sesión (spec 002, criterio 2): `await exigirSesion();`, que redirige, o, en
 * las acciones con estado, `const sesion = await leerSesion();` seguido de un `if (!sesion)` que responde con
 * `return` sin hacer nada más (criterio 19: el formulario muestra el mensaje y no pierde la pantalla).
 */
const empiezaConSesion = (cuerpo) =>
  /^(?:const \w+ = )?await exigirSesion\(\);/.test(cuerpo) ||
  /^const (\w+) = await leerSesion\(\);\s*if \(!\1\)\s*(?:return\b|\{(?:(?!await)[^}])*\breturn\b)/.test(cuerpo);

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

    // Spec 002, criterio 2: cada acción y cada página con datos verifican la sesión por su cuenta, sin fiarse del
    // proxy, cuyo matcher o una ruta movida pueden dejarlas sin cubrir.
    // Lo de (sin-sesion) es lo único que responde sin sesión: /entrar, cuya acción la crea, y /sin-conexion.
    if (capa === "app" && /\/acciones\.ts$/.test(rel) && !/\/\(sin-sesion\)\//.test(rel)) {
      for (const accion of contenido.matchAll(/^export\s+async\s+function\s+(\w+)/gm)) {
        if (!empiezaConSesion(cuerpoDesde(contenido, accion.index))) {
          error(
            `La acción ${accion[1]} no empieza verificando la sesión (\`await exigirSesion();\` o \`leerSesion\` con su \`if (!sesion) return\`).`,
          );
        }
      }
      if (/^export\s+(?:const|let|var|function|default|\{)/m.test(contenido)) {
        error("acciones.ts solo exporta funciones async con nombre, para que la regla de la sesión las vea todas.");
      }
    }
    if (capa === "app" && /\/page\.tsx$/.test(rel) && !/\/\(sin-sesion\)\//.test(rel)) {
      const pagina = /^export\s+default\s+async\s+function\b/m.exec(contenido);
      if (!pagina || !empiezaConSesion(cuerpoDesde(contenido, pagina.index))) {
        error(
          "La página no empieza con `await exigirSesion();` en su función async por defecto. Sin sesión solo responde lo de (sin-sesion).",
        );
      }
    }
  }

  // Spec 002, criterio 8: ninguna variable llega al navegador. El cliente de Supabase vive solo en el servidor.
  if (enSrc || /(^|\/)next\.config\.[cm]?[jt]s$/.test(rel)) {
    for (const [nombre] of contenido.matchAll(/NEXT_PUBLIC_[A-Z0-9_]*/g)) {
      if (!PUBLICAS_PERMITIDAS.includes(nombre)) {
        error(
          `${nombre}: Next la mete en el código del navegador. Ninguna variable es pública (lista de permitidas vacía).`,
        );
      }
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
    ? [...listarTs(path.join(process.cwd(), "src")), path.join(process.cwd(), "next.config.ts")]
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
