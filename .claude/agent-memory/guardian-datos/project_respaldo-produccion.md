---
name: respaldo-produccion
description: Spec 002 criterio 12 (T4, 2026-10-13: NO APTO y luego APTO): respaldo con pg_dump del contenedor y restauración en finanzas_restauracion; qué trae un volcado de Supabase, fugas de clave cerradas, comparación por huellas, residuales para T14/T15
metadata:
  type: project
---

T4 de 002: `src/db/respaldo.ts` + `db:respaldo:produccion`. Primera vuelta (2026-10-13): NO APTO, por dos fugas de la clave de producción, la comparación vacía con 0 movimientos y la limpieza a medias. Segunda vuelta, el mismo día: APTO.

**Volcado de Supabase → Postgres 17 vanilla (medido con la sonda de la imagen de Supabase, ver [[entorno-de-prueba]]):**

- Con `--schema=public --schema=drizzle --no-owner --no-privileges`: 0 publicaciones, 0 event triggers, 0 extensiones, 0 privilegios por defecto, 0 GRANT. Solo `CREATE SCHEMA public` (con `--schema` sí se emite, de ahí el `drop schema public`), su COMMENT y 6 ENABLE RLS.
- `--no-privileges` es necesario: sin él vienen 56 GRANT (19 a anon) y la restauración falla porque falta un rol.
- pg_dump 17.11 escribe `\restrict`/`\unrestrict`. Solo lo restaura psql 17.6 o más nuevo.
- pg_dump con un rol sujeto a RLS falla con código 1, mientras un SELECT de ese rol ve 0 filas: RLS no puede vaciar un volcado sin que se note.
- Una extensión instalada en public no se vuelca, y la restauración falla en voz alta.
- El `postgres` de Supabase tiene `search_path="$user", public, extensions` por rol. Las consultas sin esquema funcionan.

**Cómo quedó en la segunda vuelta (medido):**

- La clave va en `PGPASSWORD` y la URL sin ella en `URL_RESPALDO`, las dos por `-e NOMBRE`. En modo `--produccion`, contra la sonda con TLS y clave aleatoria: `docker top` muestra `--dbname=postgresql://postgres@…?sslmode=require`; la clave aparece 0 veces en los argumentos del contenedor, en docker.exe, en la salida y en el archivo; el usuario postgres recibe "Permission denied" en el environ. Con una clave equivocada, el error de libpq no la muestra. Una clave con `/ ? # @ , % + espacio ñ` bien escapada entra igual por pg_dump y por postgres-js.
- `leer` rechaza `%` sin dos hexadecimales y `%00`. En producción, `%zz`, `%00` y `100%` se rechazan antes de conectar. La prueba nueva falla contra HEAD y contra la mutación sin `|%00`.
- La comparación cubre cada tabla de `tablasDelEsquema` (`count` y md5 de `t::text` con timezone UTC), los movimientos por tipo y las migraciones (`count`, `max(created_at)`). La huella detectó un cambio de nota en cuentas que el conteo y las sumas por tipo no veían. Con 0 movimientos salen 7 líneas. Las huellas coinciden entre la sonda Supabase y la restaurada vanilla.
- try/finally con dropdb. El volcado se escribe como `.sql.sin-comprobar` (`wx`) y se renombra solo si cuadra. Si pg_dump falla, no queda archivo; si falla la restauración o la comparación, queda `.sin-comprobar` y la base se borra.

**Why:** el respaldo es lo único que protege el historial real. La clave de producción no debe llegar a ningún lugar que liste procesos, porque otros agentes tienen `docker exec finanzas-db *` permitido.

**How to apply (residuales que el autor anotó para T14/T15):**

- La restauración corre como superusuario `finanzas`. Un esquema manipulado podría ejecutar código durante la restauración. Se mitiga con un rol NOSUPERUSER.
- `pnpm exec tsx src/db/respaldo.ts --produccion` no coincide con el deny; el único guardia es isTTY.
- `auth.users` queda fuera del respaldo.
- Si Supabase crea el proyecto en PG 18, pg_dump 17 se niega: mirar `select version()` en T15.
- pg_dump por el pooler real en modo sesión no está medido. El contenedor resuelve el pooler a una IPv4.
- Si cambia algo en la restauración, repetir el modo `--produccion` contra la sonda con TLS (método en [[entorno-de-prueba]]).

Ver también [[guardas-produccion]], [[rls-supabase]] y [[defectos-datos-encontrados]].
