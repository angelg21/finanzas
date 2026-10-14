/**
 * Reglas de acceso (spec 002): adónde se vuelve después de entrar y quién puede entrar. Sin React ni Supabase:
 * las usan la acción de /entrar y exigirSesion().
 */

/** Tabuladores, saltos de línea y demás controles: el navegador los quita de una URL antes de seguirla. */
const tieneControles = (texto: string) => [...texto].some((c) => c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f);

const origenInterno = "http://finanzas.invalid";

/**
 * La ruta a la que se vuelve después de entrar, solo si es interna: "/sobres/3?x=1" sí; "//evil.com",
 * "/\evil.com", "https://x" o "/entrar" no. Cualquier otro valor, o ninguno, lleva a "/".
 */
export function destinoSeguro(siguiente: string | null | undefined): string {
  if (!siguiente || !siguiente.startsWith("/") || siguiente.startsWith("//")) return "/";
  // El navegador lee "\" como "/" y quita los controles: "/\evil.com" y "/\t/evil.com" acaban en "//evil.com".
  if (siguiente.includes("\\") || tieneControles(siguiente)) return "/";
  // Se juzga y se devuelve la forma que deja el mismo analizador del navegador, no el texto crudo: "/.//x",
  // "/%2e//x" o "/a/..//x" se normalizan a "//x", que el navegador leería como otro dominio.
  const url = new URL(siguiente, origenInterno);
  if (url.origin !== origenInterno || url.pathname.startsWith("//")) return "/";
  if (url.pathname === "/entrar" || url.pathname === "/entrar/") return "/";
  return url.pathname + url.search + url.hash;
}

const normalizar = (correo: string | null | undefined) => (correo ?? "").trim().toLowerCase();

/**
 * Solo entra el correo de USUARIO_PERMITIDO, sin mayúsculas ni espacios en los extremos. Si falta el permitido,
 * nadie entra: falla cerrado.
 */
export function esUsuarioPermitido(correo: string | null | undefined, permitido: string | undefined): boolean {
  const esperado = normalizar(permitido);
  return esperado !== "" && normalizar(correo) === esperado;
}
