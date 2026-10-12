---
name: entorno-de-prueba
description: Límites del entorno al probar con datos: .env.local no se puede leer, contenedor finanzas-db, copia desechable para migraciones, sondas demo-sonda-*, sin pooler de Supabase local
metadata:
  type: reference
---

- No intentar leer `.env.local` con cat: el permiso está denegado. Las sondas lo cargan dentro del proceso con `process.loadEnvFile(".env.local")`, igual que los scripts del repo, sin imprimirlo.
- La base local es el contenedor Docker `finanzas-db` (usuario y base `finanzas`). En la misma máquina corren contenedores de otro proyecto (`supabase_*_rielco-platform`): no tocarlos, y tampoco sirven como pooler de este proyecto.
- Las sondas de escritura llevan `referencia_externa = 'demo-sonda-NNN'`. Así las borra `db:demo:limpiar` y también un `delete ... like 'demo-sonda-%'` en un finally. Para mostrar lo que la base acepta, usar `begin; ...; rollback;` en psql.
- **Probar una migración sin aplicarla a la base real** (método usado en T12, 2026-10-11):
  1. Crear una copia: `createdb finanzas_t12` y luego `pg_dump finanzas | psql finanzas_t12`, dentro del contenedor.
  2. Correr los comandos con un envoltorio en el scratchpad. El envoltorio carga `.env.local`, comprueba que el host sea localhost:5433 y la base `/finanzas`, cambia la base a `/finanzas_t12` y pasa `DATABASE_URL` por entorno. dotenv 18 no sobrescribe variables ya definidas: la salida "injected env (0)" lo confirma.
  3. Correr `drizzle-kit migrate`, `db:demo:limpiar`, `db:demo` y `db:seed` en la copia, y al final `dropdb`.
- Un script tsx en el scratchpad que importa módulos del repo debe importarlos por URL de archivo (`pathToFileURL`), o con `createRequire` apuntando al `package.json` del repo. Lo mismo vale para `drizzle-orm` y `dotenv`. Además, a `tsx` hay que pasarle la ruta con forma `C:/...`, no `/c/...`.
- Si el script usa `await` en el nivel superior, debe terminar en `.mts`; con `.ts` falla ("cjs output"). Para que tsx resuelva el alias `@/`, se corre con cwd en la raíz del repo.
- **Carreras** (método de T15, 2026-10-11): abrir una segunda conexión de postgres-js con `begin`, insertar sin confirmar y lanzar la función del repo sin esperarla. Después `pg_sleep(1)` dentro de esa transacción, y leer el resultado tras confirmar. Así se ve si la función se bloquea, falla o se adelanta.
- El autor sigue con las tareas siguientes mientras reviso. Comprobar la hora de modificación de los archivos revisados antes de dar el veredicto.

Ver también [[defectos-datos-encontrados]].
