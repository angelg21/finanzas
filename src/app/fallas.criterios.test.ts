/**
 * Criterio ★ 19 de la spec 002, escrito desde su texto: "Los formularios de categorías y sobres muestran el mismo
 * mensaje y no pierden la pantalla". Una acción del servidor puesta directo en un `<form>` lanza cuando falla la red o
 * la versión, y Next cambia la pantalla entera por su error; solo `conFallas` vuelve la falla un mensaje junto al
 * botón, sin reintentar (lo prueba src/lib/fallas.test.ts). Aquí se pasa por cada archivo de src/app, con sesión o
 * sin ella y también los de rutas futuras: una acción importada de un acciones.ts, con nombre, por defecto o como
 * `* as`, solo se usa dentro de `conFallas(...)`. Que la sesión vencida responda con el mismo mensaje lo comprueba
 * scripts/comprobar-002-servidor.ts contra el build.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const raiz = path.join("src", "app");

/** Salir no guarda nada: sin red no hay nada que perder ni que decir que no se guardó. */
const noGuardan = new Set(["salir"]);

/** Los archivos que pintan o envuelven formularios: todo .ts y .tsx menos las pruebas y las propias acciones. */
function archivos(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = path.join(dir, e.name);
    if (e.isDirectory()) return archivos(ruta);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) && e.name !== "acciones.ts" ? [ruta] : [];
  });
}

/**
 * Las acciones del servidor que la fuente importa de un acciones.ts; los tipos no cuentan. Importadas como
 * `* as acciones`, cada `acciones.algo` que la fuente usa cuenta como una acción.
 */
function accionesImportadas(fuente: string): string[] {
  const nombres: string[] = [];
  for (const m of fuente.matchAll(/^import\s+(?!type\b)([^;]*?)\s*from\s*["'][^"']*\/acciones["']/gm)) {
    const clausula = m[1];
    const porDefecto = /^([\w$]+)\s*(?:,|$)/.exec(clausula);
    if (porDefecto) nombres.push(porDefecto[1]);
    const espacio = /\*\s*as\s+([\w$]+)/.exec(clausula);
    if (espacio) {
      for (const uso of fuente.matchAll(new RegExp(String.raw`\b${espacio[1]}\.([\w$]+)`, "g"))) {
        nombres.push(`${espacio[1]}.${uso[1]}`);
      }
    }
    for (const parte of (/\{([^}]*)\}/.exec(clausula)?.[1] ?? "").split(",").map((p) => p.trim())) {
      if (parte && !parte.startsWith("type ")) nombres.push(parte.split(/\s+as\s+/).at(-1) ?? parte);
    }
  }
  return [...new Set(nombres)];
}

/** Cuántas veces la fuente usa la acción y cuántas de ellas fuera de `conFallas(...)`, sin contar imports ni notas. */
function usosDe(fuente: string, accion: string) {
  const codigo = fuente
    .replace(/^import\s[^;]*;/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
  const usos = [...codigo.matchAll(new RegExp(String.raw`\b${accion.replace(".", String.raw`\.`)}\b`, "g"))];
  const sueltos = usos.filter((m) => !/\bconFallas(?:<[^>()]*>)?\(\s*$/.test(codigo.slice(0, m.index)));
  return { usos: usos.length, sueltos: sueltos.length };
}

/** "archivo: acción" por cada acción que llega a un formulario sin pasar por conFallas. */
function sinFallas(ruta: string, fuente: string) {
  return accionesImportadas(fuente)
    .filter((accion) => !noGuardan.has(accion) && usosDe(fuente, accion).sueltos > 0)
    .map((accion) => `${ruta.replace(/\\/g, "/")}: ${accion}`);
}

describe("★ 19 · los formularios de categorías y sobres muestran el mismo mensaje y no pierden la pantalla", () => {
  it("la revisión distingue una acción puesta directo en el formulario de una envuelta en conFallas", () => {
    const directo = `import { borrar } from "../acciones";
export function Boton() {
  return <form action={borrar}><button>Quitar</button></form>;
}`;
    const envuelta = `import { borrar } from "../acciones";
const borrarConFallas = conFallas<Estado>(borrar, alFallar);
export function Boton() {
  const [estado, enviar] = useActionState(borrarConFallas, {});
  return <form action={enviar}><button>Quitar</button></form>;
}`;
    const ligada = `import { type Estado, agregar } from "./acciones";
const accion = conFallas(agregar.bind(null, 3), alFallar);`;
    expect(sinFallas("a.tsx", directo)).toEqual(["a.tsx: borrar"]);
    expect(sinFallas("a.tsx", envuelta)).toEqual([]);
    expect(sinFallas("a.tsx", ligada)).toEqual([]);
  });

  it("también ve las acciones importadas como `* as` o por defecto", () => {
    const espacio = `import * as acciones from "./acciones";
export function Boton() {
  const [estado, enviar] = useActionState(acciones.eliminarPartida, {});
  return <form action={enviar}><button>Quitar</button></form>;
}`;
    const espacioEnvuelta = `import * as acciones from "./acciones";
const quitar = conFallas(acciones.eliminarPartida, alFallar);`;
    const porDefecto = `import guardar, { type Estado } from "./acciones";
export function Boton() {
  return <form action={guardar}><button>Guardar</button></form>;
}`;
    expect(sinFallas("a.tsx", espacio)).toEqual(["a.tsx: acciones.eliminarPartida"]);
    expect(sinFallas("a.tsx", espacioEnvuelta)).toEqual([]);
    expect(sinFallas("a.tsx", porDefecto)).toEqual(["a.tsx: guardar"]);
  });

  it("ninguna acción de src/app llega a un formulario sin conFallas, con sesión o sin ella", () => {
    const fuentes = archivos(raiz).map((ruta) => ({ ruta, fuente: fs.readFileSync(ruta, "utf8") }));
    // Entrar está fuera de (con-sesion): si la revisión no lo viera, tampoco vería las rutas sin sesión.
    expect(fuentes.some(({ ruta }) => ruta.includes("(sin-sesion)"))).toBe(true);
    const usadas = fuentes.flatMap(({ fuente }) =>
      accionesImportadas(fuente).filter((a) => !noGuardan.has(a) && usosDe(fuente, a).usos > 0),
    );
    // Sin esto, una revisión que no encontrara nada pasaría en blanco.
    expect(usadas.length).toBeGreaterThanOrEqual(15);
    expect(fuentes.flatMap(({ ruta, fuente }) => sinFallas(ruta, fuente))).toEqual([]);
  });
});
