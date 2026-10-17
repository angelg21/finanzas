/**
 * Criterio ★ 2 de la spec 002, escrito desde su texto: cada acción y cada página con datos verifican la sesión como
 * primera instrucción, sin fiarse del proxy, y una regla de estructura lo exige en todo acciones.ts y en toda página
 * fuera de (sin-sesion), también en las futuras. Aquí se prueba la regla con archivos inventados en una ruta que
 * todavía no existe, y se pasa por todo src/app. Que una acción real, llamada sin sesión, pida entrar y no escriba
 * nada lo comprueba scripts/comprobar-002.ts contra el build.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { revisarArchivo } from "../../scripts/estructura.mjs";

const errores = (ruta: string, contenido: string): string[] =>
  revisarArchivo(ruta, contenido)
    .filter((h: { nivel: string }) => h.nivel === "error")
    .map((h: { mensaje: string }) => h.mensaje);

const acciones = "src/app/(con-sesion)/futura/acciones.ts";
const pagina = "src/app/(con-sesion)/futura/[id]/page.tsx";
/** La directiva de las acciones, armada aquí para que la regla no tome este archivo por uno de acciones. */
const directiva = `"${["use", "server"].join(" ")}";`;

describe("★ 2 · cada acción exige la sesión por su cuenta, también las de rutas nuevas", () => {
  it("una acción que empieza con exigirSesion pasa", () => {
    const archivo = `${directiva}
export async function guardar(datos: FormData) {
  await exigirSesion();
  await escribir(datos);
}`;
    expect(errores(acciones, archivo)).toEqual([]);
  });

  it("una acción con estado que empieza con leerSesion y responde sin hacer nada más pasa", () => {
    const archivo = `${directiva}
export async function guardar(previo: Estado, datos: FormData): Promise<Estado> {
  const sesion = await leerSesion();
  if (!sesion) {
    return { ronda: previo.ronda + 1, error: mensajeDeFalla("sesion") };
  }
  return escribir(datos);
}`;
    expect(errores(acciones, archivo)).toEqual([]);
  });

  it("una acción sin la sesión, o con la sesión después de otra instrucción, no pasa y se nombra", () => {
    const sinSesion = `${directiva}
export async function borrar(datos: FormData) {
  await eliminar(Number(datos.get("id")));
}`;
    const tarde = `${directiva}
export async function borrar(datos: FormData) {
  const id = Number(datos.get("id"));
  await exigirSesion();
  await eliminar(id);
}`;
    for (const archivo of [sinSesion, tarde]) {
      expect(errores(acciones, archivo)).toEqual([expect.stringContaining("La acción borrar")]);
    }
  });

  it("una acción que escribe antes de responder sin sesión no pasa", () => {
    const archivo = `${directiva}
export async function guardar(previo: Estado, datos: FormData): Promise<Estado> {
  const sesion = await leerSesion();
  if (!sesion) {
    await escribir(datos);
    return previo;
  }
  return previo;
}`;
    expect(errores(acciones, archivo)).toEqual([expect.stringContaining("La acción guardar")]);
  });

  it("una acción exportada de otra forma, que la regla no vería, no pasa", () => {
    const archivo = `${directiva}
export const borrar = async (datos: FormData) => {
  await eliminar(Number(datos.get("id")));
};`;
    expect(errores(acciones, archivo).length).toBeGreaterThan(0);
  });

  it("la rama sin sesión solo responde: cualquier otra llamada, con o sin await, no pasa (revisión de la 002)", () => {
    const conVoid = `${directiva}
export async function guardar(previo: Estado, datos: FormData): Promise<Estado> {
  const sesion = await leerSesion();
  if (!sesion) {
    void escribir(datos);
    return previo;
  }
  return previo;
}`;
    const enElReturn = `${directiva}
export async function guardar(previo: Estado, datos: FormData): Promise<Estado> {
  const sesion = await leerSesion();
  if (!sesion) return escribir(datos);
  return previo;
}`;
    for (const archivo of [conVoid, enElReturn]) {
      expect(errores(acciones, archivo)).toEqual([expect.stringContaining("La acción guardar")]);
    }
  });

  it("export * desde un archivo de acciones no pasa: la regla no vería lo que reexporta (revisión de la 002)", () => {
    const archivo = `${directiva}
export * from "./otras-acciones";`;
    expect(errores(acciones, archivo).length).toBeGreaterThan(0);
  });

  it("una acción de servidor fuera de src/app no pasa: allí la regla de la sesión no la vería (revisión de la 002)", () => {
    const archivo = `${directiva}
export async function borrarTodo(id: number) {
  await db.execute("delete");
}`;
    for (const ruta of ["src/db/acciones.ts", "src/lib/x.ts", "src/components/x.tsx"]) {
      expect(errores(ruta, archivo)).toEqual([expect.stringContaining("fuera de src/app")]);
    }
  });

  it("la directiva de servidor fuera de acciones.ts también se revisa", () => {
    const archivo = `${directiva}
export async function borrar(datos: FormData) {
  await eliminar(Number(datos.get("id")));
}`;
    expect(errores("src/app/(con-sesion)/futura/otra-cosa.ts", archivo)).toEqual([
      expect.stringContaining("La acción borrar"),
    ]);
  });
});

describe("★ 2 · cada página con datos exige la sesión, también las de rutas nuevas", () => {
  it("una página que empieza con exigirSesion pasa", () => {
    const archivo = `export default async function Pagina({ params }: PageProps<"/futura/[id]">) {
  await exigirSesion();
  const datos = await leer((await params).id);
  return <p>{datos}</p>;
}`;
    expect(errores(pagina, archivo)).toEqual([]);
  });

  it("una página sin la sesión, con la sesión en segundo lugar o síncrona no pasa", () => {
    const sinSesion = `export default async function Pagina() {
  const datos = await leer();
  return <p>{datos}</p>;
}`;
    const tarde = `export default async function Pagina() {
  const datos = await leer();
  await exigirSesion();
  return <p>{datos}</p>;
}`;
    const sincrona = `export default function Pagina() {
  return <p>hola</p>;
}`;
    for (const archivo of [sinSesion, tarde, sincrona]) {
      expect(errores(pagina, archivo)).toEqual([expect.stringContaining("La página no empieza con")]);
    }
  });

  it("solo lo de (sin-sesion) responde sin sesión", () => {
    const archivo = `export default function Pagina() {
  return <p>Sin conexión</p>;
}`;
    expect(errores("src/app/(sin-sesion)/futura/page.tsx", archivo)).toEqual([]);
  });
});

/** El cuerpo de la función que empieza en `inicio`: después de sus parámetros, con paréntesis anidados. */
function cuerpoDe(contenido: string, inicio: number) {
  let i = contenido.indexOf("(", inicio);
  for (let abiertos = 0; i < contenido.length; i++) {
    if (contenido[i] === "(") abiertos++;
    else if (contenido[i] === ")" && --abiertos === 0) break;
  }
  return contenido.slice(contenido.indexOf("{", i) + 1).trimStart();
}

/** Todos los .ts y .tsx de src/app, sin las pruebas. */
function archivosDeApp(dir = path.join(process.cwd(), "src", "app")): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = path.join(dir, entrada.name);
    if (entrada.isDirectory()) return archivosDeApp(ruta);
    return /\.tsx?$/.test(entrada.name) && !/\.test\.tsx?$/.test(entrada.name) ? [ruta] : [];
  });
}

describe("★ 2 · en el código de hoy", () => {
  const conSesion = archivosDeApp()
    .map((ruta) => path.relative(process.cwd(), ruta).replace(/\\/g, "/"))
    .filter((ruta) => !ruta.includes("/(sin-sesion)/"));
  const accionesDeHoy = conSesion.filter((ruta) => ruta.endsWith("/acciones.ts"));
  const paginasDeHoy = conSesion.filter((ruta) => ruta.endsWith("/page.tsx"));

  it("encuentra las acciones y las páginas", () => {
    expect(accionesDeHoy.length).toBeGreaterThanOrEqual(10);
    expect(paginasDeHoy.length).toBeGreaterThanOrEqual(15);
  });

  it.each([...accionesDeHoy, ...paginasDeHoy])("%s pasa la regla de la sesión", (ruta) => {
    const sobreSesion = errores(ruta, fs.readFileSync(ruta, "utf8")).filter((m) => /sesi[oó]n/.test(m));
    expect(sobreSesion).toEqual([]);
  });

  it("cada función async exportada de cada acciones.ts empieza por la sesión, leída sin la regla", () => {
    for (const ruta of accionesDeHoy) {
      const contenido = fs.readFileSync(ruta, "utf8");
      const exportadas = [...contenido.matchAll(/^export\s+async\s+function\s+(\w+)/gm)];
      expect(exportadas.length, ruta).toBeGreaterThan(0);
      for (const exportada of exportadas) {
        expect(cuerpoDe(contenido, exportada.index), `${ruta}: ${exportada[1]}`).toMatch(
          /^(?:const \w+ = )?await (?:exigirSesion|leerSesion)\(\);/,
        );
      }
    }
  });
});
