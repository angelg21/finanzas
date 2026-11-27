# 015 · Dividir Inversión: largo plazo y negocios

Fecha: 2026-11-26. Estado: construida.

## Para qué

El sobre Inversión mezcla dos trabajos distintos: lo que algún día va al bróker a largo plazo (S&P 500, oro, renta
variable) y lo que sirve para negocios que aparecen ahora. Juntos, el dinero de un negocio sale del ahorro de largo
plazo sin que se note. El desarrollador quiere separarlos para saber cuánto destina a cada uno y administrarlos mejor.

## Trazabilidad al plan

Plan, sección 2 (tabla de sobres: "Inversión · Aportes al bróker · Intocable") y sección 3 (inversión). Cambio aprobado
por el desarrollador el 2026-11-26: Inversión pasa a ser "Inversión a largo plazo", sigue intocable, y se crea el sobre
"Negocios", libre, que recibe un tercio del porcentaje que hoy va a Inversión. El plan se actualiza en esta feature.

Decisiones del desarrollador: Negocios es libre (sin confirmación al usarlo); el saldo actual de Inversión queda en
largo plazo y Negocios arranca en 0 (si quiere pasar algo, lo hace con Mover); la regla se divide 2/3 y 1/3.

## Criterios de aceptación

1. ★ Dado `pnpm db:dividir-inversion` sin aplicar, entonces muestra lo que cambiará (nombre, sobre nuevo, reglas antes y
   después) y no escribe nada.
2. ★ Dado el script aplicado, entonces el sobre de inversión se llama "Inversión a largo plazo" y conserva su saldo y su
   historial; existe "Negocios" con saldo 0; la regla se divide con el mismo total (30 % → 20 % y 10 %); ningún saldo de
   sobre ni de cuenta cambia y el cuadre se mantiene. Si algo cambiara, no queda nada.
3. ★ Dado el script aplicado dos veces, entonces la segunda dice que ya está dividido y no cambia nada.
4. Dado un sobre de inversión que el desarrollador ya renombró, entonces el script no le cambia el nombre; sin regla
   activa, Negocios queda sin regla.
5. ★ Dada la división de la regla, entonces largo plazo + negocios suman exactamente lo de antes, también con valores que
   no son múltiplos de 3, en porcentaje y en fijo.
6. Dado Negocios, entonces se usa como cualquier sobre libre: se elige al registrar un gasto o al pagar una deuda, se mueve,
   se aparta y se presta desde él sin confirmación. Inversión a largo plazo sigue pidiendo confirmación.
7. Dado Sobres, entonces Negocios lleva su icono y su descripción, y aparece en Reglas de reparto para editar su regla.
8. ★ Dada `pnpm db:seed` en una base nueva, entonces crea los dos sobres con 20 % y 10 %; en una base que ya tiene sus
   sobres, aunque estén renombrados, no duplica ninguno: los reconoce por su tipo.

## Pantallas

- Sobres: Negocios con el icono `BriefcaseBusiness`, la descripción "Oportunidades de negocio de ahora: se usa cuando
  aparece una." y el tono 3 del anillo (el de las metas: Inversión lleva el 2 y van seguidos). Inversión a largo plazo
  conserva "Intocable".
- Sin pantallas nuevas: Reglas de reparto, Mover, la captura y el pago de deuda ya ofrecen todo sobre libre.

## Datos

- `tipo_sobre` gana el valor `negocios`. Migración generada con `pnpm db:generate`.
- Los datos existentes cambian con un script propio, idempotente y con vista previa, como el importador:
  `pnpm db:dividir-inversion` (local; `--aplicar` sin preguntar) y `pnpm db:dividir-inversion:produccion` (lo corre el
  desarrollador; pide la cadena oculta y que escriba "dividir"). En una transacción: renombra, crea Negocios, divide la
  regla y compara todos los saldos antes y después.
- La semilla reconoce los sobres base por su tipo, no por su nombre: base nueva con los dos sobres; base existente sin
  duplicados. La demostración busca Inversión por tipo.

## Fuera de alcance

- Partir el saldo actual (se hace a mano con Mover), metas o topes para Negocios, registrar ganancias de un negocio
  (por ahora, un ingreso) y crear sobres desde la interfaz.

## Pruebas antes del código

`src/lib/dividir-inversion.test.ts`: `dividirRegla` (2/3 y 1/3 con el mismo total, redondeo, fijo y porcentaje) y
`planDeDivision` (qué cambia según el estado: sin dividir, ya dividido, renombrado, sin regla, sin sobre de inversión).

## Riesgos y decisiones

- La semilla crea por nombre: renombrar "Inversión" en producción y volver a sembrar la duplicaría. Por eso la semilla
  pasa a reconocer los sobres base por tipo (los tipos base son únicos), y el cambio de datos va en un script aparte.
- La orden de la regla nueva va justo después de la de inversión; el reparto aplica los porcentajes en proporción, así
  que el orden entre ellos no cambia los montos.
