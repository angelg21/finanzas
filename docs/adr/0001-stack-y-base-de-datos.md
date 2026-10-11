# 0001 · Stack: Next.js, Drizzle y PostgreSQL

Fecha: 2026-10-02. Estado: aceptada.

## Contexto

App web progresiva personal, un solo desarrollador, debe caber en capas gratuitas y correr primero en el celular. El plan (sección 4) ya fijaba la dirección.

## Decisión

Next.js 16 con TypeScript y Tailwind 4; Drizzle ORM sobre PostgreSQL. Local: Postgres 17 en Docker (puerto 5433). Producción prevista: Postgres en Supabase y despliegue en Vercel. Montos en centavos enteros, columnas en snake_case generadas desde nombres camelCase.

## Consecuencias

- Las migraciones las genera drizzle-kit a partir de `src/db/schema.ts` y se versionan en `drizzle/`. Nunca se edita una migración ya aplicada.
- La conexión usa `prepare: false` para ser compatible con el pooler de Supabase.
- Las páginas son componentes de servidor que consultan la base directamente; las mutaciones son server actions.

## Alternativas descartadas

- SQLite local: no sirve para una PWA que se usa desde el celular y la computadora a la vez.
- Prisma: más pesado y con generación de cliente; Drizzle da SQL explícito y tipos sin paso extra.
