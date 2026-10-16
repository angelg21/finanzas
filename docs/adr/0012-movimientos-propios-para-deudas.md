# 0012 · Movimientos propios para deudas y préstamos

Fecha: 2026-10-15. Estado: aceptada.

## Contexto

La spec 005 registra lo que debo y lo que me deben. Si un pago a un amigo se guardara como gasto, inflaría el gastado del mes y la gráfica mensual. Si un cobro se guardara como ingreso, contaría como lo que se ganó. Pagar, prestar y cobrar cambian dinero por deuda o deuda por dinero, y el "ahorrado" (ingreso menos gasto) no debe moverse con ellos. Además, la app tiene que encontrar el sobre que aparta el dinero para cobrarle los pagos y calcularle su cuota. En Postgres, un valor de enum no se puede quitar, y uno recién añadido no se puede usar en la misma transacción (55P04). En producción, la 0004 y esta migración se aplican juntas.

## Decisión

- `tipo_movimiento` gana tres valores, cada uno con forma fija en `movimientos_forma_por_tipo`, como los cuatro de siempre (ADR 0002):
  - `pago_deuda` y `prestamo`: salen de una cuenta y de un sobre;
  - `cobro_prestamo`: entra a una cuenta y a "Por asignar".
- Los tres apuntan a una fila de la tabla nueva `deudas` por `deuda_id`, y los cuatro de siempre lo exigen nulo. El check termina en `else false`.
- `tipo_sobre` gana `deudas`, y un enum nuevo, `sentido_deuda`, distingue `debo` de `me_deben`.
- El enum de tipos de movimiento sale de `tiposDeMovimiento` en `src/lib/saldos.ts`. Ahí mismo, `efectoDe` decide con un `switch` exhaustivo qué lado de cuentas y sobres mueve cada tipo.
- Los checks comparan los enums como texto (`tipo::text`), para que la migración corra en la misma transacción que añade los valores.
- El pendiente de una deuda nunca se guarda: sale del monto inicial y de sus movimientos.

## Consecuencias

- El invariante se mantiene por construcción: los tres tipos mueven cuenta y sobre por el mismo monto en USD. Las deudas no entran en el cuadre, solo en el patrimonio neto (ADR 0006 sigue vigente).
- Toda suma de saldos tiene que contar los tres tipos: las de SQL, `saldosTras`, el efecto en `/sobres/[id]` y el signo de `FilaMovimiento`. Si un tipo nuevo falta en un mapa por tipo, no compila. Las sumas de SQL se comparan con `saldosTras` contra la base.
- Los cuatro valores nuevos quedan para siempre en la base. Si la feature se abandonara, quitarlos exige recrear el tipo y reescribir las columnas que lo usan. Mientras no haya filas que los usen, se pueden ignorar.
- Gastado, ingresos y gráficas filtran por tipo como hasta ahora (`gasto`, `ingreso`), así que los tipos nuevos quedan fuera sin tocarlas.

## Alternativas descartadas

- Pagos como `gasto` con una categoría "Deudas": cuentan como gasto del mes y en el anillo de categorías, justo lo que se quiere evitar.
- Cobros como `ingreso`: inflan lo ganado, y el reparto los trataría como un sueldo.
- Pagos como `reasignacion` más `transferencia`: dos filas por pago y ninguna dice a qué deuda va.
- Sobre Deudas de tipo `fondo`, como decía el plan: la app no lo distingue de los demás fondos, y el desglose y el aporte manual no le sirven.
- Comparar con el enum, sin `::text`: la migración falla en producción al aplicarse junto con la 0004.
