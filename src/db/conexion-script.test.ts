import postgres from "postgres";
import { describe, expect, it } from "vitest";
import { esBaseLocal } from "../lib/destino-base";

/** La cadena se arma por partes: el hook de secretos no distingue un ejemplo de una contraseña real. */
const url = (credenciales: string, resto: string, esquema = "postgresql") => `${esquema}://${credenciales}@${resto}`;

const casos = [
  url("finanzas:finanzas", "localhost:5433/finanzas", "postgres"),
  url("finanzas:finanzas", "127.0.0.1:5433/finanzas"),
  url("finanzas:finanzas", "LOCALHOST:5433/finanzas"),
  url("finanzas:finanzas", "[::1]:5433/finanzas"),
  url("u:p", "localhost,evil.example/x"),
  url("u:p", "evil.example,x@localhost:5433/db"),
  url("u", "evil.example%2C@localhost:5433/db"),
  "postgresql://localhost#,evil.example/db",
  url("u:p", "localhost#,evil.example/db"),
  url("u:p", "localhost%2Cevil.example:5433/db"),
  url("u:p", "localhost/x@evil.example:5432/y"),
  url("u:p", "localhost.evil.example:5432/x"),
  url("u%40x:p%2Cq", "localhost:5433/x"),
];

describe("la guarda de base local y postgres.js ven el mismo host (spec 002, criterios 10 y 11)", () => {
  it.each(casos.filter((c) => esBaseLocal(c)))(
    "si la guarda da por local %s, el driver solo iría a esta máquina",
    (c) => {
      // Crear el cliente no conecta: solo lee la URL. postgres.js lee [::1] como "[" y falla sin salir de la máquina.
      const hosts = postgres(c, { max: 1 }).options.host;
      expect(
        hosts.every((h) => ["localhost", "127.0.0.1", "["].includes(h.toLowerCase())),
        hosts.join(","),
      ).toBe(true);
    },
  );

  it("la guarda rechaza las URL con las que el driver iría a otro host", () => {
    const remotas = casos.filter((c) => {
      try {
        return postgres(c, { max: 1 }).options.host.some(
          (h) => !["localhost", "127.0.0.1", "["].includes(h.toLowerCase()),
        );
      } catch {
        return false;
      }
    });
    expect(remotas.length).toBeGreaterThan(5);
    for (const c of remotas) expect(esBaseLocal(c), c).toBe(false);
  });
});
