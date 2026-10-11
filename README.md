# finanzas

App web personal de finanzas basada en sobres: cada dólar tiene un trabajo.

- `docs/plan-financiero-y-app.md`: plan financiero, diseño de la app, fases y migración. Es la fuente de verdad del proyecto.
- `docs/diseno.md`: sistema visual. Tokens, tipografía, piezas base y reglas que sigue toda pantalla.
- `docs/referencias/`: las dos capturas que definen el diseño (estructura y colores).
- `docs/WORKFLOW.md`: cómo se construye la app: pipeline en cinco etapas, gates, hooks y subagentes. El resumen operativo está en `CLAUDE.md`.
- `docs/features/`: una spec y un progreso por funcionalidad. `docs/adr/`: decisiones de arquitectura.
- El código de la app se agregará en este mismo repo a partir de la fase 1.

## Desarrollo

Requisitos: Node 22, pnpm 10 y Docker.

```bash
pnpm install          # dependencias
pnpm db:up            # Postgres 17 local en Docker, puerto 5433
cp .env.example .env.local
pnpm db:migrate       # aplica las migraciones de drizzle/
pnpm db:seed          # cuentas, sobres, categorías y reglas iniciales
pnpm db:demo          # opcional: movimientos de ejemplo (se borran con pnpm db:demo:limpiar)
pnpm dev              # http://localhost:3000
```

Cambios al modelo de datos: editar `src/db/schema.ts`, correr `pnpm db:generate` y luego `pnpm db:migrate`. Las migraciones se versionan en `drizzle/`.

Gates: `pnpm verify:fast` (tipos, lint, formato, estructura, unitarias) y `pnpm verify` (lo anterior más build y humo de rutas). `pnpm capturas` genera capturas de escritorio y celular en ambos temas dentro de `capturas/`.

Stack: Next.js 16 con TypeScript, Tailwind 4, Drizzle ORM sobre PostgreSQL. En producción la base vive en Supabase y la app en Vercel.
