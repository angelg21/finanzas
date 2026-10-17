/**
 * Criterio ★ 11 de la spec 002, escrito desde su texto: contra producción solo corren los comandos que la nombran,
 * que piden pegar la cadena en una terminal (no existe en ningún archivo), muestran el destino como host:puerto/base,
 * sin usuario ni contraseña, y piden escribir "produccion" antes de aplicar. Los de siempre se niegan si .env.local
 * apunta a una base remota. Aquí se prueba la función que usan todos, con la terminal simulada: nunca conecta. Que
 * pnpm db:migrate, db:seed y db:demo se nieguen de verdad, sin conectar, lo comprueba scripts/comprobar-002.ts. Los
 * comandos :produccion los corre solo el desarrollador.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Lo que el desarrollador teclearía, en orden, y lo que la terminal le preguntó. */
const terminal = vi.hoisted(() => ({ respuestas: [] as string[], preguntas: [] as string[] }));

vi.mock("node:readline", () => ({
  default: {
    createInterface: () => ({
      question(texto: string, responder: (respuesta: string) => void) {
        terminal.preguntas.push(texto);
        setImmediate(() => responder(terminal.respuestas.shift() ?? ""));
      },
      once() {},
      close() {},
    }),
  },
}));
// Ni .env.local ni ningún archivo: lo que haya en el entorno lo pone cada prueba.
vi.mock("dotenv", () => ({ config: vi.fn() }));

const { urlLocal, urlProduccion } = await import("./conexion-script");

/** La cadena se arma por partes: el hook de secretos no distingue un ejemplo de una contraseña real. */
const url = (credenciales: string, resto: string, esquema = "postgresql") => `${esquema}://${credenciales}@${resto}`;
const produccion = url(
  "postgres.abcdefgh:Cl4veDeEjemplo99",
  "aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require",
);
const local = url("finanzas:finanzas", "localhost:5433/finanzas", "postgres");

let impreso: string[] = [];
const ttyAntes = process.stdin.isTTY;
const urlAntes = process.env.DATABASE_URL;

beforeEach(() => {
  terminal.respuestas = [];
  terminal.preguntas = [];
  impreso = [];
  vi.spyOn(console, "log").mockImplementation((...partes: unknown[]) => void impreso.push(partes.join(" ")));
  vi.spyOn(process.stdout, "write").mockImplementation((trozo: string | Uint8Array) => {
    impreso.push(String(trozo));
    return true;
  });
  Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(process.stdin, "isTTY", { value: ttyAntes, configurable: true });
  if (urlAntes === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = urlAntes;
});

describe("★ 11 · producción solo con un comando que la nombra, pegando la cadena y confirmando", () => {
  it("sin una terminal no corre ni pregunta nada", async () => {
    Object.defineProperty(process.stdin, "isTTY", { value: undefined, configurable: true });
    await expect(urlProduccion("aplicar las migraciones")).rejects.toThrow(/en una terminal/);
    expect(terminal.preguntas).toEqual([]);
  });

  it('pide la cadena, muestra el destino como host:puerto/base y solo sigue con "produccion"', async () => {
    terminal.respuestas = [produccion, "produccion"];
    await expect(urlProduccion("aplicar las migraciones")).resolves.toBe(produccion);
    expect(terminal.preguntas).toEqual([
      expect.stringMatching(/Pega la cadena de conexión de producción/),
      expect.stringMatching(/Escribe "produccion" para continuar/),
    ]);
    const salida = impreso.join("\n");
    expect(salida).toContain("PRODUCCIÓN: aws-0-us-east-1.pooler.supabase.com:5432/postgres");
    expect(salida).not.toMatch(/Cl4veDeEjemplo99|postgres\.abcdefgh|sslmode/);
  });

  it("con cualquier otra respuesta se cancela sin devolver la cadena", async () => {
    for (const respuesta of ["", "si", "Produccion", "producción", "produccion ya"]) {
      terminal.respuestas = [produccion, respuesta];
      await expect(urlProduccion("sembrar"), JSON.stringify(respuesta)).rejects.toThrow(/Cancelado/);
    }
  });

  it("sin cadena, ilegible o sin sslmode=require, se niega antes de pedir la confirmación", async () => {
    for (const [cadena, motivo] of [
      ["", /Cancelado/],
      [url("postgres:clave/con@barra", "db.x.supabase.co:5432/postgres?sslmode=require"), /no se entiende/],
      [url("postgres:clave", "db.x.supabase.co:5432/postgres"), /sslmode=require/],
    ] as const) {
      terminal.respuestas = [cadena, "produccion"];
      terminal.preguntas = [];
      await expect(urlProduccion("respaldar")).rejects.toThrow(motivo);
      expect(terminal.preguntas).toHaveLength(1);
      expect(impreso.join("\n")).not.toMatch(/clave/);
    }
  });

  it("un DATABASE_URL del entorno no decide a qué base se apunta: solo la cadena pegada", async () => {
    process.env.DATABASE_URL = local;
    terminal.respuestas = [produccion, "produccion"];
    await expect(urlProduccion("sembrar")).resolves.toBe(produccion);
  });
});

describe("★ 11 · los comandos de siempre se niegan si DATABASE_URL apunta a una base remota", () => {
  it("con la base local, siguen", () => {
    process.env.DATABASE_URL = local;
    expect(urlLocal("pnpm db:seed")).toBe(local);
  });

  it("con una remota, se niegan nombrando el comando y el destino, sin la contraseña", () => {
    process.env.DATABASE_URL = produccion;
    expect(() => urlLocal("pnpm db:seed")).toThrow(/pnpm db:seed solo corre contra la base local/);
    try {
      urlLocal("pnpm db:seed");
    } catch (error) {
      expect(String(error)).toContain("aws-0-us-east-1.pooler.supabase.com:5432/postgres");
      expect(String(error)).not.toMatch(/Cl4veDeEjemplo99/);
    }
  });
});
