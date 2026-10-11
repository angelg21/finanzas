# 0002 · Modelo de sobres con "Por asignar" y reasignaciones

Fecha: 2026-10-02. Estado: aceptada.

## Contexto

El plan exige el invariante "la suma de los sobres es igual a la suma de los saldos en dólares de las cuentas propias". Un ingreso se reparte entre varios sobres según reglas, y ese reparto debe quedar auditable.

## Decisión

Cada ingreso entra a una cuenta y al sobre del sistema "Por asignar". El reparto se registra como movimientos de tipo `reasignacion` entre sobres, que no tocan cuentas. Las transferencias entre cuentas no tocan sobres. Un `check` en la base obliga a que cada tipo de movimiento tenga exactamente los campos que le corresponden. Los bolívares pertenecen siempre al sobre de gastos del mes; la tasa es un campo del movimiento.

## Consecuencias

- El invariante se cumple por construcción y se verifica en la pantalla Cuentas.
- "Por asignar" debe quedar en cero tras cada reparto; un saldo ahí es dinero sin trabajo y la app lo señala.
- Los saldos nunca se guardan: siempre se calculan desde los movimientos.

## Alternativas descartadas

- Guardar el saldo en cada sobre y cuenta: se desincroniza y rompe el invariante sin que nadie lo note.
- Un ingreso con "hijos" de reparto en otra tabla: más tablas para lo mismo que una reasignación.
