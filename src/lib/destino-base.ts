/**
 * Adónde apunta una DATABASE_URL (spec 002, criterios 10 y 11). Los scripts de base lo miran antes de conectar:
 * la demostración y los comandos de siempre solo corren contra la base de Docker de esta máquina, y los de
 * producción muestran el destino, sin credenciales, antes de pedir confirmación.
 */

const hostsLocales = new Set(["localhost", "127.0.0.1", "[::1]"]);
const modosConTls = new Set(["require", "verify-ca", "verify-full"]);

/**
 * La URL leída, o null si está mal formada o es ambigua. Dos lectores la interpretan, y tienen que ver lo mismo:
 * - new URL toma el host tras la última "@" y corta la autoridad en "/", "?" o "#". Una contraseña con esos
 *   caracteres sin escapar deja pedazos de la clave en el puerto o en la ruta: "u:123/45@host" se lee como host
 *   "u", puerto 123 y ruta "/45@host". Por eso una "@" después del host la invalida.
 * - postgres.js toma el host tras la primera "@", no corta en "#" y reparte las comas entre varios hosts. Por eso
 *   se rechaza más de una "@", cualquier "#" y cualquier ",": escapadas (%40, %23, %2C) no molestan a ninguno.
 */
function leer(url: string | undefined): URL | null {
  if (!url || url.split("@").length > 2 || url.includes("#") || url.includes(",")) return null;
  try {
    const leida = new URL(url);
    if (!/^postgres(ql)?:$/.test(leida.protocol) || !leida.hostname) return null;
    if ((leida.pathname + leida.search).includes("@")) return null;
    return leida;
  } catch {
    return null;
  }
}

/**
 * Si la URL se puede usar sin sorpresas. Una ilegible no se pasa al driver: su error de URL inválida repite la
 * cadena entera, contraseña incluida.
 */
export function esUrlLegible(url: string | undefined): boolean {
  return leer(url) !== null;
}

/** Solo localhost, 127.0.0.1 o ::1. Lo mal formado, lo ambiguo o lo ausente no es local: falla cerrado. */
export function esBaseLocal(url: string | undefined): boolean {
  const leida = leer(url);
  if (!leida) return false;
  // libpq (pg_dump, psql) se conecta al host de ?host= o ?hostaddr= aunque la URL diga localhost.
  if (leida.searchParams.has("host") || leida.searchParams.has("hostaddr")) return false;
  // En los esquemas postgres:// el host no se pasa a minúsculas solo.
  return hostsLocales.has(leida.hostname.toLowerCase());
}

/**
 * Si la URL obliga a usar TLS. postgres.js y libpq (pg_dump) leen el mismo ?sslmode=; sin él, postgres.js conecta
 * en texto plano. Repetido no vale: postgres.js usa el último y searchParams.get daría el primero.
 */
export function exigeTls(url: string | undefined): boolean {
  const modos = leer(url)?.searchParams.getAll("sslmode") ?? [];
  return modos.length === 1 && modosConTls.has(modos[0]);
}

/**
 * La URL, si es local. Si no, un error que nombra el comando y el destino sin credenciales: los comandos de
 * siempre nunca tocan una base remota; contra producción solo corren los que la nombran.
 */
export function exigirBaseLocal(url: string | undefined, comando: string): string {
  if (url && esBaseLocal(url)) return url;
  throw new Error(
    `${comando} solo corre contra la base local de Docker, y DATABASE_URL apunta a ${describirBase(url)}. ` +
      "Revisa .env.local. Contra producción solo corren pnpm db:migrate:produccion y pnpm db:seed:produccion.",
  );
}

/** "host:puerto/base", nunca con el usuario, la contraseña ni la consulta. */
export function describirBase(url: string | undefined): string {
  if (!url) return "(sin DATABASE_URL)";
  const leida = leer(url);
  if (!leida) return "(dirección no válida)";
  return `${leida.hostname}:${leida.port || "5432"}${leida.pathname}`;
}
