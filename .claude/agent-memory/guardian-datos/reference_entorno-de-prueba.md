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
- **`drizzle-kit generate` está denegado** por permisos, incluso con un `--config` que escribe en una copia de `drizzle/` en el scratchpad (2026-10-12). No intentar rodearlo. `drizzle-kit migrate` sí corre con el envoltorio sobre una copia. Para saber si hay cambios sin migrar, comparar `drizzle/meta/NNNN_snapshot.json` con `schema.ts` y la cadena `prevId`. Para saber si alguien editó una migración ya aplicada, comparar el `sha256sum` del `.sql` con `hash` en `drizzle.__drizzle_migrations`.
- Para lanzar dos procesos a la vez en bash, preparar primero (migrar) en una línea aparte. `a && b & c` manda a segundo plano la cadena entera, y `c` arranca antes de que termine la migración (me pasó: 42P01).
- **Llamar a una server action fuera de Next** (2026-10-12): importar `acciones.ts` por URL de archivo y llamar `registrarGasto({ronda:0, estado:"inicial"}, formData)`. Los rechazos devuelven `estado:"error"` antes de escribir. Los casos válidos insertan y después lanzan "Invariant: static generation store missing in revalidatePath". Por eso hay que medir las filas por `max(id)` y no por el resultado. Un `page.tsx` de servidor también se puede llamar con `searchParams: Promise.resolve({...})`, y luego buscar en el árbol las props (`inicial`).
- **Otros agentes escriben en la base real mientras reviso** (le pasó al revisor el 2026-10-12). Al empezar, tomar una huella con `md5(string_agg(t::text,'|' order by id))` por tabla y `last_value` de `movimientos_id_seq`. Al terminar, repetirla. Si cambió, atribuir las filas por `nota`, `creado_en` y la base a la que apuntaba la sonda.
- El que me llama puede no saber que ya revisé algo, porque `progress.md` no siempre registra mis veredictos (el de T13 no estaba). Revisar igual, pero decirlo en el informe.
- El autor sigue con las tareas siguientes mientras reviso. Comprobar la hora de modificación de los archivos revisados antes de dar el veredicto.

Ver también [[defectos-datos-encontrados]].
