# 0013 · El historial importado no mueve saldos

Fecha: 2026-11-09. Estado: aceptada.

## Contexto

El desarrollador trae 14 meses de Gestor de Gastos (feature 012): 198 gastos, 23 ingresos y una transferencia, de agosto de 2025 a octubre de 2026. El archivo trae los movimientos pero no los saldos con los que empezó cada cuenta en la app vieja, y la app nueva arrancó el 28 de septiembre de 2026 con sus saldos reales. Sumar el historial a los saldos dejaría cuentas y sobres que no son los de verdad. El desarrollador lo quiere como historial: que alimente las gráficas, Movimientos y los totales por categoría y etiqueta, sin cambiar los saldos de hoy.

## Decisión

- Lo importado como historial va en `movimientos`, con `origen = 'importado'` y una referencia que empieza por `historial-` (`src/lib/importacion.ts`). Los datos de demostración también son `importado`, con `demo-`, y siguen contando: lo que distingue al historial es la referencia.
- `efectoEnSobre`, `efectoEnCuenta` y `efectoEnCuentaUsd` (`src/db/sumas-de-saldo.ts`), de donde salen todos los saldos, dan 0 para el historial. Cuentas y sobres lo ignoran igual, así que el cuadre no cambia.
- Las gráficas, la lista de Movimientos y los acumulados lo cuentan, porque suman montos sin pasar por esas funciones.
- El historial no se abre, no se edita ni se borra desde la app (`enlaceDeEdicion`, `movimientoParaEditar`, `filaBloqueada`), y no sale en la historia de un sobre.
- El importador compara en su transacción cada saldo de cuenta y de sobre antes y después; si alguno cambia, no queda nada.

## Consecuencias

- Una suma de saldos nueva que no use esas funciones contaría el historial: toda suma de saldos pasa por ellas (spec 005, criterio 9).
- Las categorías, cuentas y etiquetas que el historial creó son normales: Zinli es una cuenta real que empieza en 0.
- Las categorías más usadas de la captura de gasto (90 días) cuentan el historial reciente: refleja lo que el desarrollador de verdad gasta.

## Alternativas descartadas

- **Sumarlo a los saldos con un ajuste de apertura por cuenta y sobre:** inventa movimientos que no existieron y que tendrían que ser gastos o ingresos, y ensucian las gráficas.
- **Una tabla aparte para el historial:** una migración y uniones en cada consulta de Movimientos, gráficas y etiquetas.
- **Un valor nuevo de `origen`:** una migración en producción antes de importar, para lo mismo que ya dice la referencia.
