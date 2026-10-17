---
name: revision-006-editar
description: Spec 006 (editar o borrar gasto/ingreso): T3 (87c916b, blob c05ec631 en 220878f) SEGURO DE APLICAR el 2026-10-17; candado (3,PA) medido con mutante; hallazgos de defensa (plan con ids/campos de más), cuenta archivada, ids > int4
metadata:
  type: project
---

**T3 de 006, `src/db/editar-movimientos.ts` + `idDeReferencia`: SEGURO DE APLICAR (2026-10-17).** Sin migración. Mientras revisaba entró 220878f (T4 a T6), que en `src/db` solo cambia el retorno de `vistaPreviaDeBorrado` a `{ plan, reparto }` (lectura). Medí el blob c05ec631 (el de HEAD) en la copia `finanzas_g006_t3`, ya borrada.

Medido (sonda `fff6d62f…/scratchpad/t3/sonda-t3.mts <gastos|ingresos|atomico|carreras|lento|bordes|archivada>`):

- Gasto: las 5 transiciones de forma de pago conservan id, origen y referencia; la venta se crea con `captura-<id>-transferencia`, se actualiza (misma fila, nota conservada) o se borra. Cuadre igual en cada paso. Demo (origen `importado`): se edita sola; a vendiendo da error sin escribir.
- Ingreso: reparto intacto al editar; bajar más de PA da el mensaje y +0; borrar se lleva solo sus reasignaciones (no las de repartir ni apartar).
- Ids de otro tipo dan `noExiste` en los cuatro escritores.
- Triggers que fallan a mitad: 5 de 5 sin nada a medias.
- Carreras: 20 rondas por par, sin negativos ni errores. Con orden forzado (trigger `pg_sleep` en la fila de A, B a los 150 ms), B esperó 20 de 20. **Mutante sin el candado: PA en −1000 en 20 de 20.** El candado (3, sobreDestinoId) es lo que sostiene el criterio 5.
- Demo en copia fresca: limpiar + demo dos veces da 524300 = 524300, huella 0dcb6db0… / 34cc5c52…

**Hallazgos (ninguno bloquea):**

- **Baja, defensa.** El escritor confía en el plan. Con un plan fabricado: borra una venta demo ajena por `venta.id`, convierte el gasto en transferencia y escribe `referenciaExterna` y `creadoEn` de más (spread en `.set`). Las acciones de hoy no llegan ahí: el plan sale de lib. Es el mismo patrón que `editarDeuda` en T7 de 005.
- **Baja, futuro.** Editar o borrar un movimiento de una cuenta archivada con saldo 0 la deja con saldo oculto. Medido: diferencia de 500. Hoy no hay forma de archivar.
- **Baja.** Un id entre 2^31 y 2^53 pasa `isSafeInteger` en `page.tsx` y en `idDe`, y da 22003: un 500 en vez del 404.
- **Info.** Una referencia en mayúsculas (solo por SQL o el importador) no encuentra la venta y crea una segunda.
- **Info.** Si se borra el gasto, el reintento de la captura original lo vuelve a meter (+2).

**Why:** desde 006, editar y borrar son la única vía para corregir datos de producción. Un plan mal armado borra filas ajenas sin que nada lo frene.

**How to apply:** en `/f-review` de 006, comprobar si el `set` va campo por campo y si se usan los ids leídos bajo el candado. Cuando llegue archivar cuentas o sobres, exigir que no se pueda editar ni borrar lo que los toca, o que no se archive con historial. Con el chat (origen `telegram`), `idDeReferencia` exige `origen = manual`: una venta del chat quedaría huérfana al editar.

Ver también [[defectos-datos-encontrados]], [[captura-idempotente]] y [[revision-005-deudas]].
