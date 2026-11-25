---
name: revision-014-pagar-deuda
description: Spec 014 (pagar deuda desde cualquier sobre, con categoría opcional): 7ee2b1f SEGURO DE APLICAR (2026-11-25), 0010 con sha 8e1edf9c…; tres bajas abiertas (carrera de categoría, texto de deshacer, importador) y la cuota que ya cambia dentro del mes
metadata:
  type: project
---

**7ee2b1f, auditado en main el 2026-11-25: SEGURO DE APLICAR.** El pago con categoría sigue siendo un solo `pago_deuda`; `cuentaComoGasto` (en `consultas.ts`) decide qué cuenta como gasto.

Medido en copias `finanzas_g014_*`, ya borradas. La real quedó con la misma huella.

- **0010:** sha256 `8e1edf9cd4a0a35b…` = el hash de la real, y `when` = `created_at`. Es igual, sentencia por sentencia, a lo que genera el snapshot 0009 contra `schema.ts`, y quedan 0 pendientes contra el 0010. Entre los snapshots solo cambia ese check. En una copia con la 0010 revertida, `drizzle-kit migrate` la aplica, el check queda `convalidated` y da 524300 = 524300. El orden de despliegue no rompe nada: el código nuevo sin migrar solo falla el pago con categoría (23514).
- **Escritor:** se rechazan los pagos desde Por asignar, desde un sobre inactivo o inexistente, y con una categoría de ingreso, archivada o inexistente. Un cobro con categoría da 23514. En todos los casos, +0 filas. El reintento distingue la categoría y el sobre.
- **Consultas:** un pago de 150 desde Gastos con categoría da −15000 en Gastos, 0 en Deudas y −15000 en el pendiente, y +15000 en gastado, en la gráfica y en el anillo. Sale en Gastos y no en Mover. Sin categoría, al revés. Deshacer devuelve todo y el cuadre se mantiene.
- **Categorías:** una usada solo por un pago se archiva en vez de borrarse (`tipo-fijo`).
- **Mover contra pago:** con el pago dormido, Mover espera unos 825 ms y ve el saldo ya pagado (`sinSaldo`), 3 de 3. No hay ciclo de candados: nadie toma (3,·) y después (5,·).

**Abiertos (Baja):**

1. `exigirCategoriaDeGasto` lee la categoría sin candado. Si la categoría cambia a ingreso entre esa lectura y el insert, queda un pago con categoría de ingreso: 4 de 4 con orden forzado. Ese pago entra en el anillo de Gastos, pero el filtro `?categoria` lo rechaza. Con `.for("share")` en un mutante: `tipo-fijo` 4 de 4.
2. El texto de deshacer (`movimientos/[id]/page.tsx:89`) dice "vuelve … al sobre Deudas", aunque el dinero vuelve al sobre de origen.
3. El importador (`importar.ts:35`, `:40`) no ve los pagos con categoría como ya anotados, así que puede duplicar ese gasto en los totales.

**Info:**

- Un pago desde otro sobre baja la cuota de Deudas dentro del mes (medido: 81000 → 73500). El comentario de `reparto.ts:134` ya no se cumple siempre.
- La acción valida el sobre y la categoría antes de buscar el reintento.

**Why:** ahora el gasto se define por tipo y categoría, no solo por el tipo. Cada consulta nueva de gastos tiene que usar `cuentaComoGasto`.

**How to apply:** en las features siguientes, buscar `tipo = 'gasto'` o `eq(movimientos.tipo, "gasto")` en las sumas o en la deduplicación. Si alguien pone etiquetas en los pagos, revisar el check `movimientos_etiqueta_solo_gasto_ingreso`. Herramientas en [[entorno-de-prueba]]. Ver también [[defectos-datos-encontrados]] y [[revision-005-deudas]].
