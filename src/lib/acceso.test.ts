import { describe, expect, it } from "vitest";
import { destinoSeguro, esUsuarioPermitido } from "./acceso";

describe("destinoSeguro: solo rutas internas (criterio 4)", () => {
  it("deja pasar las rutas internas, con su consulta", () => {
    expect(destinoSeguro("/nuevo/gasto")).toBe("/nuevo/gasto");
    expect(destinoSeguro("/sobres/3?x=1")).toBe("/sobres/3?x=1");
    expect(destinoSeguro("/")).toBe("/");
  });

  it("manda a / lo que saldría a otro sitio", () => {
    for (const siguiente of ["//evil.com", "/\\evil.com", "https://x", "javascript:alert(1)", "evil.com"]) {
      expect(destinoSeguro(siguiente), siguiente).toBe("/");
    }
  });

  it("manda a / lo que el navegador limpia hasta convertirlo en //", () => {
    // El navegador quita tabuladores y saltos de línea de una URL: "/\t/evil.com" llega como "//evil.com".
    for (const siguiente of ["/\t/evil.com", "/\n/evil.com", "/\r/evil.com", " //evil.com", "/a\\..\\\\evil.com"]) {
      expect(destinoSeguro(siguiente), JSON.stringify(siguiente)).toBe("/");
    }
  });

  it("no vuelve a /entrar, para no dar vueltas", () => {
    for (const siguiente of ["/entrar", "/entrar/", "/entrar?siguiente=/sobres", "/entrar#x"]) {
      expect(destinoSeguro(siguiente), siguiente).toBe("/");
    }
  });

  it("sin destino, va a /", () => {
    expect(destinoSeguro("")).toBe("/");
    expect(destinoSeguro(null)).toBe("/");
    expect(destinoSeguro(undefined)).toBe("/");
  });
});

describe("esUsuarioPermitido: un solo usuario (criterio 3)", () => {
  const permitido = "dueno@correo.com";

  it("acepta el correo permitido, sin mayúsculas ni espacios en los extremos", () => {
    expect(esUsuarioPermitido("dueno@correo.com", permitido)).toBe(true);
    expect(esUsuarioPermitido("Dueno@Correo.COM", permitido)).toBe(true);
    expect(esUsuarioPermitido("  dueno@correo.com ", permitido)).toBe(true);
    expect(esUsuarioPermitido("dueno@correo.com", "  DUENO@correo.com\n")).toBe(true);
  });

  it("rechaza cualquier otro correo, aunque contenga al permitido", () => {
    expect(esUsuarioPermitido("otro@correo.com", permitido)).toBe(false);
    expect(esUsuarioPermitido("xdueno@correo.com", permitido)).toBe(false);
    expect(esUsuarioPermitido("dueno@correo.com.evil.com", permitido)).toBe(false);
    expect(esUsuarioPermitido("dueno@correo.com,otro@correo.com", permitido)).toBe(false);
  });

  it("falla cerrado si falta el permitido o el correo", () => {
    expect(esUsuarioPermitido("dueno@correo.com", undefined)).toBe(false);
    expect(esUsuarioPermitido("dueno@correo.com", "")).toBe(false);
    expect(esUsuarioPermitido("dueno@correo.com", "   ")).toBe(false);
    expect(esUsuarioPermitido("", "")).toBe(false);
    expect(esUsuarioPermitido(undefined, undefined)).toBe(false);
    expect(esUsuarioPermitido(null, permitido)).toBe(false);
    expect(esUsuarioPermitido("", permitido)).toBe(false);
  });
});

describe("destinoSeguro: lo que el navegador normaliza a // también se rechaza (auditoría T14, hallazgo 1)", () => {
  it("rechaza los puntos y las barras que acaban en otro dominio", () => {
    for (const siguiente of [
      "/.//evil.com",
      "/%2e//evil.com",
      "/%2E%2E//evil.com",
      "/a/..//evil.com",
      "/././/evil.com/x",
    ]) {
      expect(destinoSeguro(siguiente), siguiente).toBe("/");
    }
  });

  it("no vuelve a /entrar aunque llegue disfrazada", () => {
    for (const siguiente of ["/./entrar", "/a/../entrar", "/%2e/entrar?x=1"]) {
      expect(destinoSeguro(siguiente), siguiente).toBe("/");
    }
  });

  it("devuelve la ruta ya normalizada, no el texto crudo", () => {
    expect(destinoSeguro("/a/../sobres")).toBe("/sobres");
    expect(destinoSeguro("/./movimientos?x=1#y")).toBe("/movimientos?x=1#y");
  });
});
