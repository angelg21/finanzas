# 012 · Importar el historial de Gestor de Gastos

Fecha: 2026-11-09. Estado: construida (por pedido del desarrollador, "rápido"; falta verificar y revisar).

## Para qué

Traer los 14 meses de la app vieja (Gestor de Gastos, "Daily Expenses 4") para ver la tendencia en las gráficas y los totales por categoría y etiqueta, sin tocar los saldos reales de hoy. El desarrollador exportó el .xlsx a `data/respaldos/` (ignorado por git).

## Trazabilidad al plan

Sección 6, fase 1, "Importador de Gestor de Gastos", y sección 7, "Migración desde Gestor de Gastos". Decisiones del desarrollador del 2026-11-09: todo es historial (no cambia saldos ni sobres de hoy); "Ahorro Earn" es Binance; "Zelle" es la Cuenta prima; Zinli es una cuenta nueva que seguirá usando; las categorías que falten se crean; "Comida en la calle" va a "Comida fuera" y "Casa" a "Hogar"; el boleto de Dani no se importa (ya es un préstamo). ADR 0013.

## Criterios de aceptación

1. ★ Dado el .xlsx de Gestor de Gastos, cuando se importa, entonces entra cada gasto, ingreso y transferencia del archivo menos los omitidos, con la cuenta, la categoría y la etiqueta del mapeo (`src/lib/mapeo-gestor-de-gastos.ts`): "Ahorro Earn" y "Binance" en Binance (USDT), "Zelle" en Cuenta prima, "Banco de Venezuela" en Bolívares con sus dos montos, "Zinli" en una cuenta Zinli (USD, billetera) que se crea. Las categorías van a la que ya existe sin importar mayúsculas ni acentos, o se crean con su icono y color; igual las etiquetas (SAX, KumIA, Rielco, Rafael G).
2. ★ Ningún saldo de cuenta ni de sobre cambia, ni el cuadre: el importador lo comprueba en su transacción y, si cambia, no queda nada.
3. ★ Se omite, con su motivo, lo que ya está en la app (un gasto o ingreso del mismo día, tipo y monto en dólares, como el sueldo de SAX del 30 de septiembre) y lo pedido en el mapeo (el boleto de Dani). Correrlo otra vez no duplica.
4. ★ Lo que no se lee sin adivinar es un error y no se importa nada: otras columnas, fracciones de centavo, fechas futuras, otra divisa, una cuenta sin equivalente.
5. Lo importado sale en Movimientos, en las gráficas por mes y por categoría y en el acumulado de su etiqueta; no se abre, no se edita ni se borra, y no sale en la historia de un sobre.
6. ★ Antes de escribir muestra todo: cuántos movimientos y de qué fechas, cada cuenta y categoría vieja con la suya (y cuáles se crean), las etiquetas nuevas y lo que se salta. Solo escribe al teclear "importar". En producción lo corre el desarrollador con `pnpm db:importar:produccion <archivo>`, con la cadena oculta.

## Pantallas

Ninguna nueva. Las filas importadas se ven en `/movimientos` como las demás, sin enlace. Zinli aparece en las cuentas con saldo 0: lo que tenga hoy se registra una vez (Transferir desde Binance, o un ingreso "Saldo inicial").

## Datos

Sin migración. Las filas van en `movimientos` con `origen = 'importado'` y referencia `historial-<hoja>-<fecha>-<centavos>-<n>`, única por el índice de (origen, referencia). Gastos con sobre "Gastos del mes", ingresos con "Por asignar" (la forma por tipo lo pide; no cuentan). `src/db/sumas-de-saldo.ts` da 0 para esas filas. Crea en producción la cuenta Zinli y las categorías y etiquetas que falten.

## Fuera de alcance

Una pantalla para subir el archivo, otras fuentes o exportaciones, reparto histórico, editar el historial desde la app, y el saldo de hoy de Zinli.

## Pruebas antes del código

`src/lib/importacion.test.ts`: leer las hojas (fecha de Excel, centavos, bolívares, notas), rechazar lo que no se lee, el mapeo de cuentas y monedas, categorías por nombre y creadas una vez, lo omitido y su motivo, referencias estables, transferencias entre monedas y entre lo que aquí es la misma cuenta, etiquetas, cuenta sin equivalente.

## Riesgos y decisiones

- Construida sin esperar la lectura de la spec, por pedido del desarrollador. Quedan `/f-verify 012` y `/f-review 012`.
- Una suma de saldos que no pase por `sumas-de-saldo.ts` contaría el historial (ADR 0013).
- Lo "ya anotado" se detecta por día, tipo y monto: dos gastos legítimos iguales el mismo día se verían en la lista de omitidos antes de confirmar.
