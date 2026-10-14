/**
 * Estado de una base después de migrar, medido en la base real y no en el código (spec 002, criterio 9):
 * - las tablas de public son exactamente las que exporta el esquema;
 * - cada una tiene RLS, no lleva FORCE y es de quien conecta, porque la app entra como dueña;
 * - anon no entra al esquema drizzle;
 * - están aplicadas todas las migraciones del journal.
 * Con cero tablas, con una de más o con una migración pendiente, no da la base por buena.
 */
import fs from "node:fs";
import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import type postgres from "postgres";
import * as schema from "./schema";

type EstadoTabla = { tabla: string; dueno: boolean; rls: boolean; forzado: boolean };
export type Comprobacion = { ok: boolean; texto: string };

const tablasDelEsquema = Object.values(schema)
  .filter((valor) => is(valor, PgTable))
  .map((tabla) => getTableConfig(tabla).name);

const si = (valor: boolean) => (valor ? "sí" : "no");

export async function revisarEstadoBase(conexion: postgres.Sql): Promise<Comprobacion[]> {
  const tablas = await conexion<EstadoTabla[]>`
    select relname as tabla, pg_get_userbyid(relowner) = current_user as dueno,
           relrowsecurity as rls, relforcerowsecurity as forzado
    from pg_class
    where relnamespace = 'public'::regnamespace and relkind = 'r'
    order by relname`;
  // El case evita preguntar por anon donde no existe, como en la base local.
  const [{ anonEnDrizzle }] = await conexion<{ anonEnDrizzle: boolean }[]>`
    select case when exists (select 1 from pg_roles where rolname = 'anon')
                then has_schema_privilege('anon', 'drizzle', 'USAGE') else false end as "anonEnDrizzle"`;
  // Una vista corre con los permisos de su dueño y salta RLS, salvo con security_invoker; una materializada, siempre.
  const vistas = await conexion<{ vista: string }[]>`
    select relname as vista from pg_class
    where relnamespace = 'public'::regnamespace
      and (relkind = 'm' or (relkind = 'v' and not coalesce('security_invoker=true' = any(reloptions), false)))
    order by relname`;
  const [{ aplicadas }] = await conexion<{ aplicadas: number }[]>`
    select count(*)::int as aplicadas from drizzle.__drizzle_migrations`;
  const enJournal: number = JSON.parse(fs.readFileSync("drizzle/meta/_journal.json", "utf8")).entries.length;

  const nombres = tablas.map((t) => t.tabla);
  const faltan = tablasDelEsquema.filter((n) => !nombres.includes(n));
  const sobran = nombres.filter((n) => !tablasDelEsquema.includes(n));
  return [
    ...tablas.map((t) => ({
      ok: t.dueno && t.rls && !t.forzado,
      texto: `${t.tabla}: dueña ${si(t.dueno)}, RLS ${si(t.rls)}, FORCE ${si(t.forzado)}`,
    })),
    {
      ok: faltan.length === 0 && sobran.length === 0,
      texto: `${nombres.length} tablas en public, ${tablasDelEsquema.length} en el esquema${faltan.length ? `; faltan ${faltan.join(", ")}` : ""}${sobran.length ? `; sobran ${sobran.join(", ")}` : ""}`,
    },
    {
      ok: vistas.length === 0,
      texto: vistas.length
        ? `vistas que saltan RLS: ${vistas.map((v) => v.vista).join(", ")} (usa security_invoker)`
        : "ninguna vista salta RLS",
    },
    { ok: !anonEnDrizzle, texto: `anon ${anonEnDrizzle ? "puede" : "no puede"} entrar al esquema drizzle` },
    { ok: aplicadas === enJournal, texto: `${aplicadas} de ${enJournal} migraciones aplicadas` },
  ];
}
