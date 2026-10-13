/**
 * Adónde apunta una DATABASE_URL (spec 002, criterios 10 y 11). Los scripts de base lo miran antes de conectar:
 * la demostración y los comandos de siempre solo corren contra la base de Docker de esta máquina, y los de
 * producción muestran el destino, sin credenciales, antes de pedir confirmación.
 */

const hostsLocales = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * La URL leída, o null si está mal formada o es ambigua. Una contraseña con "/", "?" o "#" sin escapar corta
 * la autoridad antes de tiempo: "u:123/45@host" se lee como host "u", puerto 123 y ruta "/45@host". Por eso una
 * "@" después del host la invalida: lo que se ve como puerto o como ruta puede ser la contraseña.
 */
function leer(url: string | undefined): URL | null {
  if (!url) return null;
  try {
    const leida = new URL(url);
    if (!/^postgres(ql)?:$/.test(leida.protocol) || !leida.hostname) return null;
    if ((leida.pathname + leida.search + leida.hash).includes("@")) return null;
    return leida;
  } catch {
    return null;
  }
}

/** Solo localhost, 127.0.0.1 o ::1. Lo mal formado, lo ambiguo o lo ausente no es local: falla cerrado. */
export function esBaseLocal(url: string | undefined): boolean {
  const leida = leer(url);
  if (!leida) return false;
  // libpq (pg_dump, psql) se conecta al host de ?host= o ?hostaddr= aunque la URL diga localhost.
  if (leida.searchParams.has("host") || leida.searchParams.has("hostaddr")) return false;
  // En los esquemas postgres:// el host no se pasa a minúsculas solo; las comas son varios hosts.
  return hostsLocales.has(leida.hostname.toLowerCase());
}

/** "host:puerto/base", nunca con el usuario, la contraseña ni la consulta. */
export function describirBase(url: string | undefined): string {
  if (!url) return "(sin DATABASE_URL)";
  const leida = leer(url);
  if (!leida) return "(dirección no válida)";
  return `${leida.hostname}:${leida.port || "5432"}${leida.pathname}`;
}
