# 0006 · La cuenta de la prima cuenta en el cuadre

Fecha: 2026-10-11. Estado: aceptada.

## Contexto

El plan y el ADR 0002 definían el invariante sobre las "cuentas propias", y la cuenta de la prima tiene `es_propia = false`. Pero el desarrollador gasta desde ella y cambia a bolívares desde ella (observación 1 en `docs/observaciones.md`, spec 001). Con la regla vieja, un gasto desde esa cuenta resta del sobre y no de las cuentas propias: `/cuentas` marcaría "No cuadra" sin que haya error alguno. El dinero que la app registra ahí es del desarrollador aunque la cuenta no lo sea.

## Decisión

El invariante es: **la suma de los sobres es igual a la suma en USD de todas las cuentas**, también la de la prima. `es_propia = false` queda como marca legal ("a nombre de mi prima") y para las reglas del plan sobre esa cuenta, no como exclusión. La captura de gasto la ofrece como cualquier otra cuenta en dólares, pero nunca la preselecciona.

## Consecuencias

- `/cuentas` suma todas las cuentas en el total y en la verificación (spec 001, criterio 16).
- Se ajustan la regla dura de `CLAUDE.md`, la sección 4 del plan y los comentarios de `src/db/schema.ts`. El ADR 0002 sigue vigente en todo lo demás.
- Las consultas de saldos filtran cuentas y sobres activos. Una cuenta o un sobre que se desactive con saldo descuadra, así que **solo se archiva con saldo cero**. Lo hará cumplir la pantalla de administrar cuentas (observación 3), que hoy no existe.
- Un ingreso que cae en la cuenta de la prima entra en "Por asignar" como cualquier otro, sin truco de tránsito.

## Alternativas descartadas

- Prohibir gastos desde la cuenta de la prima: el desarrollador lo rechazó; la app no puede limitar lo que pasa en la realidad.
- Modelar cada gasto desde ella como transferencia a una cuenta propia y gasto: dos filas por gasto y un saldo ficticio, solo para salvar una definición.
- Pasarla a `es_propia = true`: borra la marca legal, que el plan quiere visible.
