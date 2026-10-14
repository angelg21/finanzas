---
name: guardas-produccion
description: Spec 002 criterios 10 y 11 (T3, 2026-10-13: NO APTO y luego APTO tras correcciones): guardas de base local, comandos :produccion, migrador programático igual a drizzle-kit; huecos medidos, cuáles se cerraron y los residuales para T15
metadata:
  type: project
---

T3 de 002 (sin commit al revisar, 2026-10-13): `exigirBaseLocal` en `lib/destino-base.ts`, `db/conexion-script.ts` (urlLocal, urlDeEntorno, urlProduccion, conectar, terminarConError), `db/estado-base.ts` y `db/migrar-produccion.ts`. Primera vuelta: NO APTO. Segunda vuelta, el mismo día: APTO.

**Cerrado en la segunda vuelta (medido):**

- `leer` rechaza más de una `@`, cualquier `#` y cualquier `,`. `conexion-script.test.ts` compara la guarda con `postgres(url).options.host` y falla contra la versión vieja en los 4 casos (lo medí con la unión de mutación).
- `conectar` y `urlProduccion` rechazan una URL ilegible: CLAVE aparece 0 veces.
- `exigeTls` exige `sslmode`.
- `isTTY`: si la respuesta llega por una tubería, se niega.
- `revisarEstadoBase` detecta una tabla de más, una tabla que falta, RLS apagado, FORCE, `anon` con USAGE y una migración menos.

**Residuales, sin bloquear:**

- `terminarConError` no imprime la causa de un AggregateError: con ECONNREFUSED el mensaje viene vacío y la línea "Causa" no sale.
- `?sslmode=require&sslmode=disable` pasa `exigeTls` y postgres-js usa `ssl:false`, porque gana la última.
- Una vista en public no la marca nadie.
- ~~`settings.json` sin deny para `Read(./.env.produccion.local)` ni para los `:produccion`~~. Cerrado en db17a31 (visto el 2026-10-13): deny para Read y para los tres `pnpm db:*:produccion*`. Sigue abierto que `pnpm exec tsx src/db/<x>.ts --produccion` no coincide con el deny: el único guardia es isTTY.
- **Tercer lector de la URL: libpq** (T4, pg_dump). Repetía la clave en su error con `%` sin escapar o `%00`. Cerrado en la segunda vuelta de T4: `leer` los rechaza, con prueba medida contra mutaciones, y además pg_dump ya no recibe la clave en la URL (va en PGPASSWORD). Ver [[respaldo-produccion]].
- `isTTY` en la terminal del desarrollador no está medido.
- `src/db/index.ts` (la app) no valida la URL.

**Why:** el guardia es lo único que separa un `pnpm db:seed` o `db:demo` de la base real de Supabase, y la producción nace con T15. Un error aquí no se ve hasta que hay filas demo en producción o una clave en una transcripción.

**How to apply (lo medido, para la siguiente revisión):**

- **Migrador.** drizzle-kit 0.31.11 importa el MISMO archivo `drizzle-orm/postgres-js/migrator.cjs` (0.45.3) con `max: 1`. Reconoce por `created_at` = `when` del journal; el `hash` se guarda pero nunca se compara. Todas las pendientes van en una transacción; el esquema y la tabla de control se crean fuera. Medido en copias: huella `hash:created_at` 03537d13... igual en la real (kit), en una migrada por el programático y en una mixta (0000-0002 programático, 0003 kit); `pg_dump --schema-only` idéntico (27bb6e9e...); una 0004 que falla deja 0 tablas, 0 enums y 0 filas de control.
- **postgres-js no lee la URL como WHATWG.** Toma el host tras la PRIMERA `@`, no corta en `#` y, si ve una coma, usa varios hosts en orden. Cuatro URL pasaron `exigirBaseLocal` y postgres-js iría primero a un host remoto: dos `@` con coma, dos `@` con `%2C`, y `localhost#,remoto` con o sin credenciales. Se mide sin conectar con `postgres(url).options.host`. Corrección pedida: en `leer`, null si hay más de una `@`, una `#` o una coma.
- **Fuga de clave medida.** Una URL que `new URL` rechaza (clave con `/`, `?` o `#` sin escapar) hace que postgres-js lance ERR_INVALID_URL con `input` = la URL entera, y `console.error(e)` la imprime. Medido en `db:demo:limpiar`. Por construcción, igual en `db:seed:produccion`: `urlProduccion` muestra "(dirección no válida)" y acepta igual. Los errores del driver (28P01, ECONNREFUSED, ENOTFOUND) no traen la clave (medido).
- **Confirmación.** `printf 'produccion\n' | ...` la pasa (isTTY=false), y `.claude/settings.json` permite `Bash(pnpm *)` sin preguntar. No hay deny para `Read(./.env.produccion.local)`. Con stdin cerrado, con "no" o sin salto de línea final se cancela (medido).
- **TLS.** Sin `sslmode` en la URL, postgres-js usa `ssl: false` (medido en options). Hay que exigir `sslmode=require` en producción.
- **Red.** Esta máquina solo tiene IPv6 de enlace local (fe80::, ipconfig 2026-10-13). La conexión directa de Supabase (solo IPv6 sin el complemento de pago, según su documentación; no medido) no llegará. Para migrar, sembrar y respaldar, el pooler en modo sesión (puerto 5432, usuario `postgres.<ref>`), que es el mismo rol dueño. La spec dice "conexión directa": hay que corregirla en T15.
- `migrar-produccion.ts` imprime solo `e.message`: un fallo de red sale como "Failed query: CREATE SCHEMA IF NOT EXISTS "drizzle"" y el ECONNREFUSED o el motivo SQL quedan en `cause` (medido). Además, sus comprobaciones pasan con 0 tablas.
- `drizzle-kit push --url ...` no carga `drizzle.config.ts` (CLI y config son excluyentes, leído en el código, no ejecutado): salta el guardia si alguien escribe la URL.

Ver también [[rls-supabase]], [[defectos-datos-encontrados]] y [[entorno-de-prueba]].
