---
name: revision-008-etiquetas
description: Spec 008 (etiquetas): migración 0006 SEGURO DE APLICAR (2026-10-17, sha 56bd5d69…, commit 85f3dd0); respaldo antes de migrar falla con el código nuevo; etiquetas sin marca demo; checks por orden alfabético
metadata:
  type: project
---

**Migración `0006_cultured_pretty_boy.sql`: SEGURO DE APLICAR (2026-10-17).** La revisé antes de que se aplicara en ninguna base. sha256 `56bd5d694215d631…`, snapshot `6a1a8818…`, `when` 1792258505083. El autor hizo commit (85f3dd0) a mitad de la revisión, con los mismos bytes. Si al aplicarla en local el `hash` de `__drizzle_migrations` es otro, alguien la editó.

Medido en copias `finanzas_g008_*`, ya borradas:

- Las 7 sentencias son idénticas a `generateMigration(0005_snapshot, schema)`, y quedan 0 pendientes contra la 0006. El check `movimientos_forma_por_tipo` es idéntico en los dos snapshots, y los enums no cambian.
- **Copia con forma de producción:** dueño `g008_dueno` NOSUPERUSER NOBYPASSRLS, montada con `createdb -O` y `pg_dump --no-owner --no-privileges | psql -U g008_dueno`. El migrador real tarda 28 ms en una sola transacción, y `revisarEstadoBase` da 12 de 12 OK (8 tablas, 7 de 7 migraciones).
- **Sondas:**
  - Una etiqueta en los 5 tipos que no la admiten da 23514; en gasto e ingreso entra.
  - Etiqueta inexistente: 23503. Borrar una etiqueta en uso: 23503. Clave repetida: 23505 `etiquetas_clave_unica`.
  - Un rol ajeno con GRANT ve 0 filas, y su insert da un error de RLS.
- **Semilla y demo:** idénticas con el código nuevo y con el de `main`, 524300 = 524300, huellas 0dcb6db0 / 34cc5c52. `main` lee, inserta y borra contra la base migrada (no hay `select *`).
- **Base vacía:** `drizzle-kit migrate` de 7 migraciones, semilla y demo, con el mismo resultado.
- **Bloqueos:** con una transacción de la app abierta 2 s, la migración espera y un gasto nuevo hace cola detrás de ella (≈1,7 s); después se guarda, sin errores. Una vez obtenido el candado, ≈110 ms con 300 mil filas; ≈11 ms con los datos de hoy.

**Hallazgos (ninguno bloquea aplicar):**

- **Media, operativo.** `respaldo.ts` recorre `tablasDelEsquema`. Con el código de la 008 contra una base en la 0005 (producción antes de migrar), da "relation etiquetas does not exist", sale con código 1 y deja el volcado como `.sql.sin-comprobar`. El `respaldo.ts` de `main` sobre la misma copia pasa, y el nuevo sobre la copia migrada también. `docs/despliegue.md` pide respaldar y luego migrar, así que hay que respaldar desde `main` ANTES de fusionar, o corregir `resumir`. Seguramente pasó igual con la 0005 (deudas) el 2026-10-16; no lo verifiqué.
- Tras migrar, la huella por tabla de `movimientos` cambia (284be9cc → bd7580d2) con los mismos datos, porque `t::text` incluye la columna nueva. No comparar el respaldo de antes con el de después por esa huella.
- **Baja.** `etiquetas` no tiene `referencia`, y `db:demo:limpiar` no la toca. `comprobar-008` (prevista en la spec) dejaría etiquetas para siempre en la base local, porque no hay forma de borrarlas desde la app. Hay que exigir nombres `demo-…` y borrarlas en un finally, o correrla en una copia.
- **Info.**
  - Postgres evalúa los checks por orden alfabético de nombre: una fila que rompe los dos informa `movimientos_etiqueta_solo_gasto_ingreso`. Ningún código usa el nombre de una 23514.
  - La base acepta nombre y clave vacíos, y una clave que no corresponde al nombre; solo lo frena `nombreDeEtiqueta`.
  - `editarGasto` y `editarIngreso` reciben `etiquetaId` con `null` por defecto: quien no lo pase borra la etiqueta. Hoy los dos llamadores lo pasan.

**Why:** producción tiene datos reales desde el 2026-10-17 y está en la 0005. Esta es la primera migración que se aplica sobre datos reales del desarrollador.

**How to apply:**

- En `/f-review` de 008, comprobar si se corrigió el respaldo o se documentó el orden (respaldo desde `main` antes de fusionar).
- Si se escribe `comprobar-008`, exigir su limpieza.
- En el importador, validar el nombre y la clave de las etiquetas con `nombreDeEtiqueta`.
- Herramientas, en `fff6d62f…/scratchpad/g008/`:
  - `diff-snapshot.cts <snap> [sql]`;
  - `migrar-g008.mts`;
  - `sonda-checks.sql`;
  - `bloqueos.mts`;
  - `viejo-lee.cts`.

Ver también [[defectos-datos-encontrados]], [[respaldo-produccion]], [[rls-supabase]] y [[entorno-de-prueba]].
