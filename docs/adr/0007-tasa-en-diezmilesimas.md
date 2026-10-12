# 0007 · La tasa viaja como entero en diezmilésimas

Fecha: 2026-10-11. Estado: aceptada.

## Contexto

Un gasto en bolívares convierte entre monedas con una tasa como 241,8 Bs/USD. La base la guarda como `numeric(14,4)` y el driver la devuelve como texto. Hacer la conversión con flotantes rompe la regla de los centavos enteros. Además, `Number` acepta "1e3" o "0x10", y `Math.round(1.005 * 100)` da 100.

## Decisión

En memoria la tasa es un entero en diezmilésimas: 241,8 → 2418000, la misma precisión que la columna. `src/lib/dinero.ts` es el único sitio que convierte:

- `aTasa` y `aCentavos` leen las cifras como texto y solo admiten signo, cifras y un decimal;
- `bolivaresDesdeUsd` y `usdDesdeBolivares` multiplican y dividen en `BigInt` y redondean al centavo, con las mitades hacia arriba;
- `tasaDecimal` escribe el texto `"241.8000"` para la base, y `formatearTasa`, el que se muestra.

## Consecuencias

- Ningún monto ni ninguna tasa pasan por coma flotante en la conversión. Las pruebas de `dinero.test.ts` fijan los números de la spec 001: 2000 USDT a 241,8 son 483600 Bs; 2100 Bs a 241,8 son 868 centavos de USD.
- Los montos se escriben sin separador de miles: un punto o una coma sola es el decimal, así que "2.100" vale 2,10.
- El valor en USD de un gasto en bolívares que redondea a 0 se guarda como 1 centavo, porque la base exige montos positivos.

## Alternativas descartadas

- Flotantes con `toFixed` al final: el error aparece justo en los bordes de redondeo.
- Una librería decimal: una dependencia más para lo que caben en dos enteros y un `BigInt`.
- Guardar la tasa como entero en la base: exige una migración y no gana nada, porque `numeric(14,4)` ya es exacta.
