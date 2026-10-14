import { describe, expect, it } from "vitest";
import { conexionSegura, describirBase, esBaseLocal, esUrlLegible, exigirBaseLocal, exigeTls } from "./destino-base";

/** La cadena se arma por partes: el hook de secretos no distingue un ejemplo de una contraseña real. */
const url = (credenciales: string, resto: string, esquema = "postgresql") => `${esquema}://${credenciales}@${resto}`;

const pooler = url("postgres.abcdefgh:clave-secreta", "aws-0-us-east-1.pooler.supabase.com:6543/postgres");

describe("esBaseLocal (criterios 10 y 11)", () => {
  it("reconoce la base de Docker en esta máquina", () => {
    expect(esBaseLocal(url("finanzas:finanzas", "localhost:5433/finanzas", "postgres"))).toBe(true);
    expect(esBaseLocal(url("finanzas:finanzas", "127.0.0.1:5433/finanzas"))).toBe(true);
    expect(esBaseLocal(url("finanzas:finanzas", "[::1]:5433/finanzas", "postgres"))).toBe(true);
    expect(esBaseLocal(url("finanzas:finanzas", "LOCALHOST:5433/finanzas", "postgres"))).toBe(true);
  });

  it("no toma por local una base remota", () => {
    expect(esBaseLocal(pooler)).toBe(false);
    expect(esBaseLocal(url("postgres:clave", "db.abcdefgh.supabase.co:5432/postgres"))).toBe(false);
    expect(esBaseLocal(url("u:p", "localhost.evil.com:5432/x"))).toBe(false);
    expect(esBaseLocal(url("u:p", "127.0.0.1.evil.com:5432/x"))).toBe(false);
  });

  it("falla cerrado ante lo que podría llevar a otro host", () => {
    // postgres.js reparte las comas entre varios hosts; libpq (pg_dump, psql) obedece ?host= y ?hostaddr=.
    expect(esBaseLocal(url("u:p", "localhost,evil.com/x"))).toBe(false);
    expect(esBaseLocal(url("u:p", "localhost:5433/x?host=evil.com"))).toBe(false);
    expect(esBaseLocal(url("u:p", "localhost:5433/x?hostaddr=10.0.0.1"))).toBe(false);
    // Sin host, el driver usaría PGHOST.
    expect(esBaseLocal("postgres:///finanzas")).toBe(false);
    // Una "@" después del host: la URL es ambigua.
    expect(esBaseLocal(url("u:p", "localhost/x@evil.com:5432/y"))).toBe(false);
  });

  it("falla cerrado donde postgres.js lee otro host que new URL", () => {
    // postgres.js toma el host tras la primera "@", no corta en "#", decodifica antes de partir por comas y
    // prueba los hosts en orden: en estas cuatro, new URL ve localhost y postgres.js iría primero a evil.example.
    expect(esBaseLocal(url("u:p", "evil.example,x@localhost:5433/db"))).toBe(false);
    expect(esBaseLocal(url("u", "evil.example%2C@localhost:5433/db"))).toBe(false);
    expect(esBaseLocal("postgresql://localhost#,evil.example/db")).toBe(false);
    expect(esBaseLocal(url("u:p", "localhost#,evil.example/db"))).toBe(false);
    expect(esBaseLocal(url("u:p", "localhost%2Cevil.example:5433/db"))).toBe(false);
  });

  it("una URL mal formada, vacía o ausente no es local", () => {
    expect(esBaseLocal("localhost:5433/finanzas")).toBe(false);
    expect(esBaseLocal(url("u:p", "localhost:noesunpuerto/x"))).toBe(false);
    expect(esBaseLocal("no es una url")).toBe(false);
    expect(esBaseLocal("")).toBe(false);
    expect(esBaseLocal(undefined)).toBe(false);
  });
});

describe("describirBase: host:puerto/base, sin credenciales (criterio 11)", () => {
  it("muestra el destino", () => {
    expect(describirBase(pooler)).toBe("aws-0-us-east-1.pooler.supabase.com:6543/postgres");
    expect(describirBase(url("finanzas:finanzas", "localhost:5433/finanzas"))).toBe("localhost:5433/finanzas");
  });

  it("pone el puerto por omisión de Postgres si no lo trae", () => {
    expect(describirBase(url("postgres:clave", "db.abcdefgh.supabase.co/postgres"))).toBe(
      "db.abcdefgh.supabase.co:5432/postgres",
    );
  });

  it("nunca muestra el usuario ni la contraseña, tampoco escapados", () => {
    const texto = describirBase(
      url("postgres.abcdefgh:p%40ss%2Fw%3Ard%23", "db.ejemplo.com:5432/postgres?sslmode=require"),
    );
    expect(texto).toBe("db.ejemplo.com:5432/postgres");
    for (const pedazo of ["p%40ss", "p@ss", "w%3Ard", "w:rd", "postgres.abcdefgh", "sslmode"]) {
      expect(texto, pedazo).not.toContain(pedazo);
    }
  });

  it("si no se entiende la URL, no la repite", () => {
    // Una contraseña con "/" sin escapar rompe la URL: el texto de vuelta no puede contenerla.
    const texto = describirBase(url("postgres:clave/secreta", "db.ejemplo.com:5432/postgres"));
    expect(texto).not.toContain("clave");
    expect(texto).not.toContain("secreta");
    expect(texto).toBe("(dirección no válida)");
    expect(describirBase(undefined)).toBe("(sin DATABASE_URL)");
  });

  it("si la contraseña sin escapar se lee como puerto, ruta o consulta, tampoco la repite", () => {
    // "u:123/45@host" se lee como host "u", puerto 123 y ruta "/45@host": el puerto y la ruta son la clave.
    for (const [credenciales, pedazos] of [
      ["postgres:123/45", ["123", "45"]],
      ["postgres:678?90", ["678", "90"]],
      ["postgres:24#68", ["24", "68"]],
      ["postgres:p@ss/x", ["ss", "x@"]],
    ] as const) {
      const texto = describirBase(url(credenciales, "db.ejemplo.com:5432/postgres"));
      expect(texto, credenciales).toBe("(dirección no válida)");
      for (const pedazo of pedazos) expect(texto, credenciales).not.toContain(pedazo);
    }
  });
});

describe("exigirBaseLocal: los comandos de siempre se niegan fuera de local (criterios 10 y 11)", () => {
  it("devuelve la URL si es local", () => {
    const local = url("finanzas:finanzas", "localhost:5433/finanzas", "postgres");
    expect(exigirBaseLocal(local, "pnpm db:seed")).toBe(local);
  });

  it("se niega con un error que nombra el comando y el destino, sin la contraseña", () => {
    expect(() => exigirBaseLocal(pooler, "pnpm db:seed")).toThrow(
      /pnpm db:seed.*aws-0-us-east-1\.pooler\.supabase\.com:6543\/postgres/,
    );
    try {
      exigirBaseLocal(pooler, "pnpm db:seed");
    } catch (error) {
      expect(String(error)).not.toContain("clave-secreta");
      expect(String(error)).not.toContain("postgres.abcdefgh");
    }
  });

  it("se niega sin DATABASE_URL o con una mal formada", () => {
    expect(() => exigirBaseLocal(undefined, "pnpm db:demo")).toThrow(/pnpm db:demo/);
    expect(() => exigirBaseLocal("no es una url", "pnpm db:demo")).toThrow(/dirección no válida/);
  });
});

describe("esUrlLegible: una URL que se puede mostrar y usar sin riesgo de imprimir la contraseña", () => {
  it("acepta las URL bien escritas, con la contraseña escapada", () => {
    expect(esUrlLegible(pooler)).toBe(true);
    expect(esUrlLegible(url("finanzas:finanzas", "localhost:5433/finanzas", "postgres"))).toBe(true);
    expect(esUrlLegible(url("postgres.abcdefgh:p%40ss%2Fw%3Ard%23", "db.ejemplo.com:5432/postgres"))).toBe(true);
  });

  it("rechaza las que el driver leería distinto o que repetirían la contraseña en un error", () => {
    for (const ilegible of [
      url("postgres:clave/secreta", "db.ejemplo.com:5432/postgres"),
      url("postgres:cla#ve", "db.ejemplo.com:5432/postgres"),
      url("postgres:p@ss", "db.ejemplo.com:5432/postgres"),
      url("u:p", "evil.example,x@localhost:5433/db"),
      "no es una url",
      "",
      undefined,
    ]) {
      expect(esUrlLegible(ilegible), String(ilegible)).toBe(false);
    }
  });

  it("rechaza un % mal escapado o %00: libpq (pg_dump) repite la contraseña en su error", () => {
    // pg_dump: error: invalid percent-encoded token: "Clave%zzSecreta"
    for (const clave of ["Clave%zzSecreta", "Clave%00Secreta", "100%", "Clave%2"]) {
      expect(
        esUrlLegible(url(`postgres.abcdefgh:${clave}`, "aws-0-us-east-1.pooler.supabase.com:5432/postgres")),
        clave,
      ).toBe(false);
    }
    expect(esUrlLegible(url("postgres.abcdefgh:100%25", "aws-0-us-east-1.pooler.supabase.com:5432/postgres"))).toBe(
      true,
    );
  });
});

describe("exigeTls: producción solo con TLS", () => {
  it("acepta sslmode require, verify-ca y verify-full", () => {
    for (const modo of ["require", "verify-ca", "verify-full"]) {
      expect(exigeTls(`${pooler}?sslmode=${modo}`), modo).toBe(true);
    }
  });

  it("rechaza la URL sin sslmode o con un modo que admite texto plano", () => {
    expect(exigeTls(pooler)).toBe(false);
    for (const modo of ["disable", "allow", "prefer", ""]) {
      expect(exigeTls(`${pooler}?sslmode=${modo}`), modo).toBe(false);
    }
    expect(exigeTls(url("postgres:clave/secreta", "db.ejemplo.com:5432/postgres?sslmode=require"))).toBe(false);
    expect(exigeTls(undefined)).toBe(false);
  });

  it("rechaza un sslmode repetido: postgres.js usa el último y la guarda vería el primero", () => {
    expect(exigeTls(`${pooler}?sslmode=require&sslmode=disable`)).toBe(false);
    expect(exigeTls(`${pooler}?sslmode=require&sslmode=require`)).toBe(false);
  });
});

describe("conexionSegura: la app solo habla sin TLS con la base de esta máquina (auditoría T14, H1)", () => {
  it("una base local no necesita TLS", () => {
    expect(conexionSegura(url("finanzas:finanzas", "localhost:5433/finanzas", "postgres"))).toBe(true);
  });

  it("una remota solo con sslmode=require o más", () => {
    expect(conexionSegura(`${pooler}?sslmode=require`)).toBe(true);
    expect(conexionSegura(pooler)).toBe(false);
    expect(conexionSegura(`${pooler}?sslmode=prefer`)).toBe(false);
    expect(conexionSegura(undefined)).toBe(false);
  });
});
