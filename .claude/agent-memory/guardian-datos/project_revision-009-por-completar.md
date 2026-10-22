---
name: revision-009-por-completar
description: Spec 009 (gastos por completar): 1.ª vuelta 0007 NO APLICAR (check con NULL); 2.ª vuelta 0007+0008 SEGURO DE APLICAR (2026-10-22, 0d8904e); residuales: el último gasto hereda la venta compartida, conteo antes del candado, id reusado en carrera
metadata:
  type: project
---

**1.ª vuelta (2026-10-22, hasta 75eee43): 0007 NO APLICAR.** El check `gastos_por_completar_monto` con `or` daba NULL con monto sin moneda o moneda sin monto, y NULL aprueba un CHECK. Más tres hallazgos del escritor: venta compartida de "varios" rota por borrar/editar de 006 (alta), categoría del pendiente sin validar en varios (media), id de captura reusado con otros pendientes da "completados" sin guardar (media).

**2.ª vuelta (2026-10-22, commit 0d8904e): 0007 + 0008 SEGURO DE APLICAR.** El autor no editó la 0007 (sha `b761eafe…` igual) y añadió `0008_elite_swarm.sql` (sha `45773b93…`, `when` 1792691455813): DROP + ADD del check con `(m is null) = (mo is null) and (m is null or (m > 0 and mo in ('VES','USD')))`. Medido en copias `finanzas_g009_v2_*` (ya borradas):

- 0008 = `generateMigration(0007_snapshot, schema)` (2 de 2); 0 pendientes contra 0008; cadena prevId 0006→0007→0008 bien.
- Migrador real, dueño NOSUPERUSER: las dos en UNA transacción (~19 ms), hashes iguales al sha de cada archivo, `revisarEstadoBase` 13 OK (9 tablas, 9 de 9).
- Esquema `pg_dump -s` idéntico (md5 3ece2fd32269, 328 líneas) entre: 0006+0007+0008, 0006+0007 regenerada de cero, y base vacía 0000..0008.
- Check: casos 4, 5 y 21 → 23514; tabla de verdad sin ningún NULL.
- Base con solo la 0007 y una fila a medias: la 0008 falla con 23514, rollback, la fila queda y `revisarEstadoBase` dice "8 de 9". Fallo seguro.
- Respaldo de la rama: antes ("todavía no existe") y después (3 filas, 9 migraciones) en verde.
- Demo y semilla: 524300 = 524300, huellas 0dcb6db0/34cc5c52.
- Arreglos medidos: venta compartida intacta al borrar uno (Bolívares +1500 Bs de vuelto) y al editar a "saldo" o "dolares"; editar a "vendiendo" → error `vendido`. `{otra:true}` con otros pendientes (0 escrito, 2 de 2 siguen), y el reintento real sigue en `nueva:false`; doble envío simultáneo 20 de 20 "nueva + ya(3)", nunca "otra". Categoría: varios rechaza la de ingreso y la archivada; `actualizarCategoria` da "tipo-fijo" y `eliminarCategoria` archiva.
- Regresión: fases de la 1.ª vuelta iguales; sonda T3 de 006 (gastos, carreras, bordes) en verde salvo B3 (mayúsculas, residual conocido). `verify:fast --forzar` 930 de 930.

**Residuales de la 2.ª vuelta (no bloquean):**

- **Baja.** `ventaBloqueada` decide "compartida" por cuántos gastos quedan, no por cómo nació. Borrados todos menos uno, el último hereda la venta entera: editar a "vendiendo 30" encoge la de 100 USDT (Binance +70, Bolívares −2800 Bs) y borrarlo la borra. Cuadra, y la pantalla lo anuncia. Arreglo sugerido: decidir por la referencia (`gasto-<n>`/`gasto-resto` = de varios).
- **Info.** El conteo va antes del `for update` de la venta. Dos borrados simultáneos de los dos últimos dejan la venta sin gastos (20 de 20); uno tras otro, la borran.
- **Info.** Mismo id, otros pendientes, a la vez (solo con id fabricado): vendiendo 9 de 10 "ya(3)" por el catch de 23505; dólares 10 de 10 entran los dos grupos. Nada se pierde.
- **Info.** `categoriasConUso` no cuenta pendientes: la página dice "se borrará del todo" y el escritor archiva.

**Why:** primera tabla que no es dinero pero desemboca en dinero. Su venta compartida toca escritores de 001 y 006 que no la conocían.

**How to apply:** en `/f-review` de 009, mirar si se cerró "el último hereda la venta" y comprobar que la base local y producción aplican las dos juntas (hash `45773b93…` en `__drizzle_migrations`). Herramientas en `fff6d62f…/scratchpad/g009/` (1.ª) y `g009v2/` (`sonda-v2.mts`, `gen-sql.cts`).

Ver también [[defectos-datos-encontrados]], [[revision-006-editar]], [[captura-idempotente]], [[respaldo-produccion]] y [[entorno-de-prueba]].
