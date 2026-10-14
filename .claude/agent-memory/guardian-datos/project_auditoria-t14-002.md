---
name: auditoria-t14-002
description: Auditoría completa T14 de 002 (2026-10-14) antes del primer despliegue; veredicto NO APLICAR hasta exigir TLS en la conexión de la app; ensayo del despliegue medido en vanilla y en la imagen de Supabase
metadata:
  type: project
---

T14 de 002, sobre adb227d, el 2026-10-14. Veredicto: **NO APLICAR todavía**. Bloquea una sola cosa: `src/db/index.ts` no exige TLS (ver [[defectos-datos-encontrados]]). Todo lo demás es seguro para el primer despliegue.

**Medido (sirve de referencia para T15 y para la próxima auditoría):**

- `schema.ts` contra `0003_snapshot.json`: 0 sentencias pendientes. Cálculo hecho en memoria con `drizzle-kit/api`, ver [[entorno-de-prueba]]. La cadena `prevId` es coherente. El `hash` de las 4 migraciones en la base real es igual al sha256 de los `.sql`. Ninguna migración se tocó en git después de crearse.
- Ensayo del primer despliegue en una base vacía con dueño NOSUPERUSER NOBYPASSRLS:
  - el migrador programático aplica 0000-0003 en un solo `begin`/`commit` (visto con `log_statement=all`), y `revisarEstadoBase` da 10 de 10 ✓;
  - `pg_dump --schema-only` sale idéntico al de la base real, salvo la clave de `\restrict`;
  - la semilla da 5 cuentas, 7 sobres, 15 categorías y 6 reglas (40 + 30 + 30 = 100 %); corrida dos veces, el contenido no cambia;
  - el cuadre arranca en 0 = 0;
  - con la acción real (gasto en dólares, vendiendo, desde el saldo en Bs, desde la prima, Inversión con confirmación, reintento) queda en −7089 = −7089, con las cuentas en negativo;
  - las 22 manipulaciones se rechazan con 0 filas;
  - `db:demo:limpiar` no borra `captura-*`.
- El mismo ensayo sobre la imagen de Supabase 17.6.1.171, entrando como `postgres`, dio los mismos números. Detalle de roles en [[rls-supabase]].
- La demo en una copia de la real: huella del autor 6819eb1d…, cuadre 539300 = 539300, idempotente.
- `respaldo.ts` se ensayó sobre la copia de producción: 9 de 9 ✓.

**Why:** el criterio 13 de la spec 002 pide cerrar cada hallazgo, o aceptarlo con un ADR, antes de que Vercel reciba la cadena de conexión. Para eso hay que saber cuáles bloquean y cuáles se pueden aceptar.

**How to apply:** en T15, comprobar que `index.ts` exige TLS (o que "Enforce SSL" se comprobó rechazando una conexión sin TLS) antes de pegar `DATABASE_URL` en Vercel. Comprobar también `select version()` (PG 18), que el pooler de transacción funcione con `db.transaction` (categorías) y que la nota de la prima en la semilla se haya corregido antes de `db:seed:produccion`, si el desarrollador lo decide. Si llegan cambios a `fondos.ts` o a las acciones de sobres, repetir el caso S8 (partida gigante) con `t14/acciones.cts`.
