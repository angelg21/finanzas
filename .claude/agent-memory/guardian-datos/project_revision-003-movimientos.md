---
name: revision-003-movimientos
description: Feature 003 (movimientos por categoría): T3 APTO el 2026-10-14 con mediciones; qué vigilar en T5/T6, f-verify y f-review de 003
metadata:
  type: project
---

**T3 de 003, APTO el 2026-10-14** (sin commitear al revisar; `consultas.ts` y `movimientos-del-periodo.ts`, ambos de las 20:37).

Mediciones en una copia con demo, más 17 bordes y 450 filas de lista larga, todo igual centavo por centavo que el SQL a mano:

- **Gastos de octubre de 2026:** 33597 en 7 movimientos.
- **Si se contaran mal:** sin filtrar el tipo, Comida daría 169524 en lugar de 9522; sumando los Bs, el mes daría 1029275.
- **Bordes:** 31 oct y 1 nov, la semana del 28 dic al 3 ene, y el domingo 25.
- **Lista larga:** 200 de 450, con el total del mes y el de cada día completos (146025).
- **Volumen:** con 300 000 filas, las tres consultas usan `movimientos_fecha_idx`. El mes tarda 0,6 ms.
- **Inicio y `/sobres/[id]`:** la salida de HEAD contra la del árbol da las mismas filas y valores; solo se suman 4 campos.

**Why:** 003 es solo lectura, pero es la pantalla que responde "¿en qué gasté?". Un total mal sumado no se nota.

**How to apply:**

- `resumenPorDia` reemplazó a `contarMovimientosDelPeriodo`. La spec ya lo registra.
- La validación del tipo de categoría (criterio 6) no la hace `leerFiltros`. La página la hace contra el resultado de `totalesPorCategoria` (visto en el borrador de T5, a las 20:42). Si alguien la quita, una categoría de ingreso en Gastos deja la lista vacía, sin caer en "Todas".
- En Mover, el total de cada día mezcla transferencias y reasignaciones: es dinero real y propósito sumados. Hay que decidirlo en T6.
- Residuales informativos: ver [[defectos-datos-encontrados]].
