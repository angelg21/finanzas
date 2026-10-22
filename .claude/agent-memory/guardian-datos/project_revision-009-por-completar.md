---
name: revision-009-por-completar
description: Spec 009 (gastos por completar): 0007 NO APLICAR (2026-10-22, sha b761eafe, commit 9234cd3) por un check que deja pasar NULL; venta compartida de "varios" rota por borrar/editar de 006; categoría del pendiente sin validar en varios; qué repetir en la segunda vuelta
metadata:
  type: project
---

**Migración `0007_loud_epoch.sql` (tabla `gastos_por_completar`): NO APLICAR (2026-10-22).** sha256 `b761eafe23fe…`, `when` 1792690330468, en el commit 9234cd3 con los mismos bytes. Al revisar, la base local seguía en la 0006 (hash 56bd5d69) y producción también. El autor confirmó T2 a T7 (75eee43) mientras yo revisaba, sin migrar la local.

**Motivo: el check `gastos_por_completar_monto` no hace lo que dice.** `(m is null and mo is null) or (m > 0 and mo::text in (...))` da NULL con monto sin moneda y con moneda sin monto, y un CHECK con NULL pasa. Medido: los dos casos y un update que quita la moneda entran. Con monto sin moneda, `nuevo/gasto/page.tsx:41-42` abre "Completar" en "dolares" con el monto prellenado: 1500 Bs se registrarían como 1500 USD. Redacción medida que sí rechaza los 5 casos malos: `(m is null) = (mo is null) and (m is null or (m > 0 and mo::text in ('VES','USD')))`. drizzle-kit la genera igual en memoria. Hay dos caminos: drop + regenerar la 0007 (no está aplicada en ninguna base ni publicada), o una 0008 con DROP/ADD CONSTRAINT.

Todo lo demás de la migración, medido en copias `finanzas_g009_*` (ya borradas):

- 4 de 4 sentencias idénticas a `generateMigration(0006, schema)`; 0 pendientes contra la 0007; check de forma y enums idénticos.
- Migrador real como dueño NOSUPERUSER: una transacción de 16 ms; `revisarEstadoBase` 13 de 13 OK; las 8 tablas existentes con la misma huella (la de `movimientos` no cambia, a diferencia de la 0006).
- `respaldo.ts` de la rama antes de migrar ("todavía no existe") y después, también con filas. El de `main` vuelca la tabla pero no la compara.
- RLS: un rol ajeno con GRANT ve 0 filas, update y delete afectan 0 y el insert falla.
- Demo y semilla: 524300 = 524300, huellas 0dcb6db0/34cc5c52 (121 movimientos). Una base vacía migrada desde cero da el mismo esquema (md5 2425a01c).
- Bloqueos: la FK toma SHARE ROW EXCLUSIVE sobre `categorias`. Con un gasto en vuelo, la migración no espera; con una edición de categoría en vuelo, espera, y un gasto nuevo entra en 34 ms.

**Hallazgos del escritor y de las acciones (T3/T6/T7):**

- **Alta.** Una sola venta para varios gastos choca con 006. `idDeReferencia("captura-X-gasto-<pid>")` devuelve X, y `ventaBloqueada` encuentra la venta compartida. Medido: borrar UN gasto del grupo borra la venta de los tres (Binance +100 USDT, Bolívares −2200 Bs), y editar uno a "vendiendo 25" encoge la venta de los dos. El cuadre se mantiene en los dos casos, así que "No cuadra" no lo ve.
- **Media.** `completarVariosAccion:69` usa `p.categoriaId` sin validarlo. Medido: un gasto con categoría de ingreso y otro con una archivada. Raíz: `actualizarCategoria` y `eliminarCategoria` solo cuentan movimientos; borrar una categoría con pendientes da 23503 y un mensaje genérico.
- **Media.** El mismo id de captura con otros pendientes devuelve `nueva:false` y la acción redirige a "completados" sin guardar nada (medido). El reintento con montos cambiados no es silencioso: la acción ya responde "Alguno ya se completó".
- Bien (medido): dos veces el mismo, 20 de 20; contra descartar, nunca los dos; con orden forzado, B espera más de 300 ms. **Mutante sin `for update`: descartar=true y gasto=1 en 5 de 5.** Varios con uno que falta, 0 escrito; un fallo a mitad, 0 escrito.
- Info: `anotarPorCompletar` toma cualquier choque como "ya estaba", sin comparar. La base acepta fecha 0050/2099, referencia vacía o en mayúsculas, monto > 2^53 y una categoría de ingreso. El JSDoc de `reglasReparto` quedó huérfano encima de la tabla nueva (schema.ts:264-268).

**Why:** es la primera tabla que no es dinero pero desemboca en dinero. Su check y su venta compartida tocan escritores de 001 y 006 que no sabían de ella.

**How to apply:** en la segunda vuelta, repetir `g009/sonda-checks.sql` (casos 4, 5 y 21 → 23514), `sonda-009.mts venta-compartida venta-editar` y `accion-varios-cat.cts`. Si se regenera la 0007, comprobar el sha nuevo y que la local no la tenga aplicada. Herramientas en `fff6d62f…/scratchpad/g009/`.

Ver también [[defectos-datos-encontrados]], [[revision-006-editar]], [[captura-idempotente]], [[respaldo-produccion]] y [[entorno-de-prueba]].
