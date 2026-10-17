/**
 * Criterio ★ 8 de la spec 002, escrito desde su texto: ningún secreto llega al navegador. No hay variables
 * públicas de Next y una regla lo vigila con una lista de permitidas vacía; el cliente de Supabase solo se crea en el
 * servidor; la clave de servicio no existe ni en la app ni en el repositorio. Que el build no lleve al navegador
 * ninguno de los valores del entorno lo comprueba scripts/comprobar-002.ts; los atributos de las cookies de sesión
 * (HttpOnly, SameSite=Lax y Secure en producción), pnpm humo con sesión, contra el build.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { revisarArchivo } from "../../scripts/estructura.mjs";

const errores = (ruta: string, contenido: string): string[] =>
  revisarArchivo(ruta, contenido)
    .filter((h: { nivel: string }) => h.nivel === "error")
    .map((h: { mensaje: string }) => h.mensaje);

const raiz = process.cwd();
/** El prefijo, armado aquí para que la regla no lo encuentre en esta prueba. */
const PUBLICA = `${["NEXT", "PUBLIC"].join("_")}_`;

/** Todos los .ts y .tsx de src, sin las pruebas, con la ruta relativa a la raíz. */
function archivosDeSrc(dir = path.join(raiz, "src")): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = path.join(dir, entrada.name);
    if (entrada.isDirectory()) return archivosDeSrc(ruta);
    if (!/\.tsx?$/.test(entrada.name) || /\.test\.tsx?$/.test(entrada.name)) return [];
    return [path.relative(raiz, ruta).replace(/\\/g, "/")];
  });
}
const leer = (ruta: string) => fs.readFileSync(path.join(raiz, ruta), "utf8");
const fuentes = archivosDeSrc();

describe("★ 8 · ninguna variable pública, con una regla que lo vigila", () => {
  it("la regla rechaza cualquier variable pública en src, también en una ruta nueva: la lista de permitidas está vacía", () => {
    for (const nombre of ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "X"].map((n) => PUBLICA + n)) {
      const archivo = `export const valor = process.env.${nombre};\n`;
      expect(errores("src/components/futura.tsx", archivo), nombre).toEqual([expect.stringContaining(nombre)]);
      expect(errores("src/lib/futura.ts", archivo), nombre).toEqual([expect.stringContaining(nombre)]);
    }
  });

  it("la regla también mira next.config.ts, donde `env` las metería en el navegador", () => {
    const archivo = `export default { env: { ${PUBLICA}CLAVE: process.env.CLAVE } };\n`;
    expect(errores("next.config.ts", archivo)).toEqual([expect.stringContaining(`${PUBLICA}CLAVE`)]);
  });

  it("hoy no hay ninguna en src ni en next.config.ts", () => {
    const conPublicas = [...fuentes, "next.config.ts"].filter((ruta) => leer(ruta).includes(PUBLICA));
    expect(conPublicas).toEqual([]);
  });

  it("next.config.ts no pasa variables del servidor al navegador con `env`", () => {
    expect(leer("next.config.ts")).not.toMatch(/^\s*env\s*:/m);
  });
});

/** Los módulos del proyecto que importa un archivo, resueltos a su ruta; los de paquetes, tal cual. */
function importsDe(ruta: string): string[] {
  const contenido = leer(ruta);
  const especificadores = [
    ...contenido.matchAll(/^import\s+(?!type\b)[^;]*?from\s+["']([^"']+)["']/gm),
    ...contenido.matchAll(/^import\s+["']([^"']+)["']/gm),
    ...contenido.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g),
  ].map((m) => m[1]);
  return especificadores.map((e) => {
    const base = e.startsWith("@/")
      ? path.join("src", e.slice(2))
      : e.startsWith(".")
        ? path.join(path.dirname(ruta), e)
        : null;
    if (!base) return e;
    const candidata = [".ts", ".tsx", "/index.ts", "/index.tsx", ""]
      .map((ext) => (base + ext).replace(/\\/g, "/"))
      .find((c) => fuentes.includes(c));
    return candidata ?? e;
  });
}

/** Una acción de servidor llega al navegador como referencia, no como código: ahí se corta el recorrido. */
const esDeServidor = (ruta: string) => /^\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\s*)*["']use server["']/.test(leer(ruta));
const esDeCliente = (ruta: string) => /^\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\s*)*["']use client["']/.test(leer(ruta));

/** Todo lo que el navegador recibe desde un componente de cliente: sus imports, y los de ellos. */
function alcanzadoDesde(inicio: string): Set<string> {
  const vistos = new Set<string>();
  const pendientes = [inicio];
  while (pendientes.length > 0) {
    const actual = pendientes.pop() as string;
    if (vistos.has(actual)) continue;
    vistos.add(actual);
    if (!fuentes.includes(actual) || (actual !== inicio && esDeServidor(actual))) continue;
    pendientes.push(...importsDe(actual));
  }
  return vistos;
}

describe("★ 8 · el cliente de Supabase solo se crea en el servidor", () => {
  const clientes = fuentes.filter(esDeCliente);

  it("encuentra los componentes de cliente", () => {
    expect(clientes.length).toBeGreaterThanOrEqual(10);
  });

  it("solo src/app/supabase.ts crea un cliente, y es de servidor", () => {
    const creadores = fuentes.filter((ruta) => /create(Server|Browser)Client\(|createClient\(/.test(leer(ruta)));
    expect(creadores).toEqual(["src/app/supabase.ts"]);
    expect(leer("src/app/supabase.ts")).not.toMatch(/createBrowserClient|createClient\(/);
    expect(esDeCliente("src/app/supabase.ts")).toBe(false);
  });

  it.each(clientes)("%s no lleva al navegador ni Supabase ni sus variables", (cliente) => {
    const alcanzados = [...alcanzadoDesde(cliente)];
    expect(alcanzados.filter((m) => m.startsWith("@supabase/") || m === "src/app/supabase.ts")).toEqual([]);
    const conVariables = alcanzados
      .filter((m) => fuentes.includes(m) && (m === cliente || !esDeServidor(m)))
      .filter((m) => /process\.env\.(SUPABASE|DATABASE|USUARIO|HUMO)/.test(leer(m)));
    expect(conVariables).toEqual([]);
  });
});

describe("★ 8 · la clave de servicio no existe ni en la app ni en el repositorio", () => {
  const versionados = execFileSync("git", ["ls-files", "-z"], { cwd: raiz, encoding: "utf8" })
    .split("\0")
    .filter((ruta) => ruta && fs.existsSync(path.join(raiz, ruta)) && fs.statSync(path.join(raiz, ruta)).isFile());

  /** El rol que declara un JWT, si el texto lo es. */
  function rolDeJwt(jwt: string): string | null {
    try {
      const carga = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"));
      return typeof carga?.role === "string" ? carga.role : null;
    } catch {
      return null; // no era un JWT
    }
  }

  it("encuentra los archivos del repositorio", () => {
    expect(versionados.length).toBeGreaterThan(100);
  });

  it("ningún archivo versionado trae una clave secreta de Supabase ni un JWT de service_role", () => {
    const hallazgos: string[] = [];
    for (const ruta of versionados) {
      const contenido = fs.readFileSync(path.join(raiz, ruta), "utf8");
      if (/sb_secret_[A-Za-z0-9_-]{16,}/.test(contenido)) hallazgos.push(`${ruta}: sb_secret_`);
      for (const [jwt] of contenido.matchAll(/eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+/g)) {
        if (rolDeJwt(jwt) === "service_role") hallazgos.push(`${ruta}: JWT de service_role`);
      }
    }
    expect(hallazgos).toEqual([]);
  });

  it("la app no lee ninguna variable de servicio o secreta", () => {
    const lectores = fuentes.filter((ruta) => /process\.env\.\w*(SERVICE|SECRET)\w*/.test(leer(ruta)));
    expect(lectores).toEqual([]);
    expect(fs.readFileSync(path.join(raiz, ".env.example"), "utf8")).not.toMatch(/SERVICE|SECRET/);
  });
});
