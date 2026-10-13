---
name: rls-supabase
description: Spec 002 criterio 9 (2026-10-13): RLS sin políticas en las 6 tablas; la app depende de ser DUEÑA; en local no se ejerce RLS (finanzas es superusuario); fallo silencioso con un rol ajeno; huecos (vistas, deriva en vivo) y comprobaciones exigibles en producción
metadata:
  type: project
---

Migración 0003 (T2 de 002): seis `ENABLE ROW LEVEL SECURITY`, ninguna política, sin `FORCE`. APTO PARA MIGRAR el 2026-10-13 (revisado antes de que se aplicara en local).

**Why:** la API de datos de Supabase entra como anon/authenticated, que no son dueños: con RLS y sin políticas ven 0 filas, y un insert falla con 42501. La app entra con su cadena de conexión y solo funciona porque su rol es el DUEÑO de las tablas (sin FORCE, el dueño no está sujeto a RLS).

**How to apply:**

- En local, el rol `finanzas` es superusuario, BYPASSRLS y dueño. Por eso "la app local funciona tras migrar" no prueba nada sobre RLS. Lo que sí lo prueba es una copia con un dueño NOSUPERUSER NOBYPASSRLS: demo, semilla e invariante 539300 = 539300 (medido el 2026-10-13).
- **Fallo silencioso** (medido en la copia): un rol que no es dueño y tiene GRANT ve el invariante en 0 = 0 ("cuadra"), `db:demo:limpiar` dice "0 movimientos borrados" con 118 filas presentes, y los update y delete afectan 0 filas sin error. Solo el insert falla (42501). Si alguien propone un rol de mínimo privilegio para la app (la auditoría podría hacerlo), es NO APLICAR salvo que ese rol sea el dueño o haya políticas para él.
- `FORCE ROW LEVEL SECURITY` rompería a un dueño sin BYPASSRLS (medido: 5 → 0 filas). Si una migración lo añade, es NO APLICAR.
- Supabase: el pooler en modo transacción (`postgres.<ref>`) entra como el rol `postgres`, y la migración por conexión directa crea las tablas con dueño `postgres`. Son el mismo rol. El migrador de drizzle aplica todas las pendientes en UNA transacción (`pg-core/dialect.js`, `migrate`), así que en una base nueva nunca se confirman tablas sin RLS.
- Exigir en T3/T15 (comando de producción o `docs/despliegue.md`) una comprobación en vivo tras migrar: dueño = `current_user`, `relrowsecurity` = t y `relforcerowsecurity` = f en todas las tablas de public, y `has_schema_privilege('anon','drizzle','USAGE')` = f. La prueba `schema.test.ts` solo mira el código: no ve un DISABLE hecho desde el panel.
- Hueco de `schema.test.ts`: no detecta vistas (`pgView`, medido). Una vista en public, por defecto sin security_invoker, corre con los permisos del dueño y salta el RLS. Si llega una vista: `securityInvoker: true` y ampliar la prueba. Además, la prueba solo cubre `schema.ts`; si `drizzle.config.ts` pasa a usar un glob, quedan fuera las tablas de otros archivos.
- `drizzle.__drizzle_migrations` no tiene RLS y no hace falta: un rol con GRANT en public recibió "permission denied for schema drizzle".

Ver también [[defectos-datos-encontrados]] y [[entorno-de-prueba]].
