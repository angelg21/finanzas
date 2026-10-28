# 011 · Transferir entre cuentas, con la comisión

Fecha: 2026-10-28. Estado: construida (por pedido del desarrollador, antes de que lea la spec; falta verificar y revisar).

## Para qué

El desarrollador pasa dinero entre sus cuentas (por ejemplo de la cuenta de su prima a Binance) y a veces le cobran una comisión. Hasta ahora la app no tenía cómo registrarlo: las cuentas quedaban con saldos que no eran los reales y la comisión no se veía.

## Trazabilidad al plan

Sección 4 ("Mover dinero entre cuentas es una transferencia, no cambia los sobres") y sección 6, fase 1: "faltan administrar cuentas (observación 3) y los movimientos entre cuentas". La comisión es la parte que no estaba escrita: se registra como un gasto, que es lo que es. El plan se actualiza en esta feature.

## Criterios de aceptación

1. ★ Dado dos cuentas en dólares (USD, USDT o USDC) distintas, cuando registro que de la primera salió X y a la segunda llegó Y, con Y ≤ X, entonces se guarda una transferencia de Y (la primera baja Y y la segunda sube Y; si las monedas difieren, guarda lo recibido en la moneda de destino, 1 a 1) y, si X > Y, un gasto de comisión de X − Y desde la primera, del sobre elegido (Gastos del mes por defecto), en la categoría "Comisiones", que se crea la primera vez. La primera cuenta baja X en total; los sobres solo cambian por la comisión; el cuadre se mantiene.
2. ★ "Cuánto llegó" vacío es igual a lo que salió: sin comisión ni sobre. No puede pasar de lo que salió. Las dos cuentas, distintas y en dólares: los bolívares no entran (eso es la venta de USDT del gasto en bolívares). El sobre de la comisión acepta gastos (ni Por asignar ni Deudas). Montos de 0,01 en adelante, como en la captura de gasto; fecha hoy o un día anterior.
3. ★ Un reintento con el mismo id de captura no duplica. La acción empieza con la sesión y pasa por `conFallas`.
4. La transferencia sale en Movimientos, pestaña Mover, como "Cuenta prima → Binance" (y "recibe 99,00 USDT" si cambia la moneda); la comisión, como un gasto más, que se edita y se borra como cualquier gasto sin tocar la transferencia.
5. ★ Tocar la transferencia abre `/movimientos/[id]` con "Deshacer transferencia": deshacerla borra la transferencia y su comisión en una transacción, y las cuentas y el sobre vuelven a como estaban. La venta de USDT de un gasto en bolívares nunca se abre ni se deshace así.
6. Al guardar, vuelve a `/cuentas` con la `Pildora` `positiva` "Transferido". `/cuentas` tiene el enlace "Transferir" en "Mis cuentas".

## Pantallas

- `/nuevo/transferir`: el selector de Registrar con "Transferir" (Gasto · Ingreso · Deuda · Mover · Transferir) y una `Tarjeta` de 6 columnas centradas, como Mover: "De" y "A" en `SelectorPildoras` con el saldo de cada cuenta en su moneda, ninguna elegida; "Cuánto salió" y "Cuánto llegó" en `CampoMonto` con la moneda de cada cuenta ("Vacío si llegó lo mismo"); con JavaScript, la línea en `texto-2` "Comisión: 1,00 USD. Se registra como un gasto, en Comisiones."; "La comisión sale de" en `SelectorPildoras` con Gastos del mes elegido; `SelectorFecha`; nota; botón "Transferir". Sin JavaScript, lo mismo con radios y campos.
- `/nuevo`: la tarjeta "Transferir" ("Entre cuentas, con la comisión si la hubo."), en una rejilla de 3 columnas en escritorio.
- `/movimientos/[id]` de una transferencia: título "Cuenta prima → Binance", el monto, "Transferencia · comisión 1,00 USD · fecha · nota" y "Deshacer transferencia" con la confirmación de la 006 ("Sí, deshacer").

## Datos

Sin tablas, columnas ni migración: `transferencia` ya existe (`movimientos_forma_por_tipo` pide las dos cuentas distintas y sin sobres). Las filas llevan referencias propias de la captura, `captura-<id>-envio` (la transferencia) y `captura-<id>-comision` (el gasto), distintas de la venta de un gasto en bolívares (`-transferencia` junto a `-gasto`), para que editar o borrar ese gasto nunca tome una transferencia por su venta. La categoría de gasto "Comisiones" (icono porcentaje, color pizarra) se crea en la misma transacción la primera vez; si ya hay una que se llama igual sin importar mayúsculas ni acentos, se usa esa. Sin cambios en semillas ni en la demo.

## Fuera de alcance

Bolívares (es la venta del gasto en bolívares), editar una transferencia (se deshace y se registra otra vez), una comisión cobrada aparte en la cuenta de destino como su propio movimiento, tasas o conversiones que no sean 1 a 1, administrar cuentas (observación 3), y avisar si la cuenta de origen queda en negativo (no se impide, como en un gasto).

## Pruebas antes del código

`src/lib/transferencias.ts`, `prepararTransferencia`, con `transferencias.test.ts`: la transferencia y la comisión con sus columnas; el efecto en cuentas y sobres con `saldosTras`; sin comisión; misma moneda; lo que llegó no pasa de lo que salió; cuentas distintas y en dólares; el sobre de la comisión; montos y fecha.

## Riesgos y decisiones

- Construida y publicada antes de que el desarrollador lea la spec, por su pedido ("fuera del pipeline largo, lo antes posible"), como la 007. Quedan `/f-verify 011` y `/f-review 011`.
- La comisión se registra en la cuenta de origen: el resultado en las cuentas es el mismo que si se cobrara en destino (sale X, llega Y), y así un solo gasto lo explica.
