# 007 · Deshacer pagos y cobros, etiquetas con #, y mover entre sobres

Fecha: 2026-10-17. Estado: aprobada (el desarrollador pidió los tres arreglos "ya, sin perder tiempo en pruebas; haz el cambio y anota las pruebas para después").

## Para qué

Tres arreglos que el desarrollador necesita al empezar a usar la app en producción:

1. Registró sin querer que le pagaron una deuda y no lo puede revertir.
2. Quiere marcar los ingresos por cliente con un numeral (#SAX, #Rielco) y filtrarlos.
3. Quiere mover dinero entre sobres; si sale de Inversión, la app debe advertir y pedir confirmación.

## Trazabilidad al plan

Fase 1, "Cuentas, categorías, movimientos con nota" y "Sobres con reglas de reparto". Se juntan en una sola feature por pedido del desarrollador. Decisiones tomadas por el agente sin preguntar, por ese mismo pedido; se pueden corregir después:

- deshacer vale para pagos y cobros de deudas, no para préstamos (se piden después si hacen falta);
- una etiqueta es cualquier palabra con # en la nota, sin distinguir mayúsculas; filtra la lista y su total, no el anillo;
- mover entre sobres nunca deja el origen en negativo; mover entre cuentas sigue fuera (feature de cuentas).

## Criterios de aceptación

**Deshacer un pago o un cobro**

1. ★ Dado un pago o un cobro de una deuda, cuando toco su fila (en el historial de la deuda o en Movimientos), entonces veo `/movimientos/[id]` con lo que fue y "Deshacer pago" o "Deshacer cobro", que pide confirmación.
2. ★ Deshacer borra el movimiento en una transacción con el candado de la deuda. Un pago devuelve el dinero a su cuenta y al sobre Deudas, y la deuda vuelve a tener ese pendiente. Un cobro saca el dinero de la cuenta y de "Por asignar", con su candado; si "Por asignar" no alcanza porque ya se repartió, no se deshace y lo dice: "Por asignar tiene X; le faltan Y".
3. ★ El cuadre entre sobres y cuentas se mantiene, y una deuda "pagada" o "cobrada" vuelve a abierta si le queda pendiente.

**Etiquetas con #**

4. Una palabra que empieza con # en la nota de cualquier movimiento es una etiqueta (#SAX, #Rielco); "#sax" y "#SAX" son la misma.
5. En `/movimientos`, debajo del periodo, las etiquetas usadas en el periodo y la pestaña, como píldoras. Tocar una filtra la lista y el total de arriba ("#sax · 1.200,00 USD"); tocarla otra vez la quita. El anillo sigue siendo el del periodo. Se combina con el filtro por categoría.
6. ★ `?etiqueta=` inválido (vacío, con espacios o símbolos, de más de 30) no filtra y la página no falla; nunca llega a una consulta sin validar.

**Mover entre sobres**

7. ★ En `/nuevo/mover` (Registrar → Mover, y "Mover" en `/sobres`): de qué sobre, a qué sobre, monto y nota. Se guarda una reasignación de hoy. El monto va de 0,01 al saldo del origen: nunca lo deja en negativo. Se escribe con el candado del origen (el del reparto) y dentro se vuelve a mirar el saldo.
8. ★ Desde Inversión, antes de guardar: "Inversión es intocable: lo que sale de aquí deja de crecer. ¿Mover igual?" y un segundo botón "Sí, mover de Inversión". Sin confirmar no se guarda.
9. ★ Un reintento con el mismo id no duplica (la referencia de la captura, como al repartir). La acción empieza con la sesión y pasa por `conFallas`.
10. Lo que vuelve a "Por asignar" con Mover se resta de lo que el sobre recibió de él en el mes: ir y volver no cambia lo que un fijo pide en el reparto ni la cuota de Deudas (specs 004, criterio 2, y 005, criterio 11). Para los fijos, lo recibido nunca baja de cero, y el piso va sobre la marcha: devolver de más (lo que sobraba de otros meses) no hace que el fijo pida en el mes más que su valor. Sacar de Deudas con Mover hacia otro sobre sí cambia la cuota: ese dinero deja de estar apartado. Ni el origen ni el destino vienen elegidos. Añadido tras la revisión y la auditoría de datos del 2026-10-22.

## Pantallas

- **Deshacer**: `/movimientos/[id]` de un pago o un cobro: el título ("Pago a Papás"), el monto, la cuenta y la fecha, y "Deshacer pago" con `EnlaceBoton` `peligro`, con la misma confirmación de borrar de la 006.
- **Etiquetas**: una fila de `Pildora` enlazadas bajo los controles de periodo; la elegida en `palida`.
- **Mover**: una `Tarjeta` de 6 columnas centradas, como `/deudas/apartar`: "De" y "A" en `SelectorPildoras` con el saldo de cada sobre, `CampoMonto`, nota, el aviso de Inversión en `negativo` y el botón "Mover".

## Datos

Sin tablas, columnas ni migración. Las etiquetas se leen de `nota` con una expresión regular sobre el texto validado. Mover es una `reasignacion` con `captura-<id>-reasignacion-<destino>`.

## Fuera de alcance

Deshacer préstamos, editar pagos y cobros, mover entre cuentas, etiquetas como columna o con colores, y un resumen por etiqueta en el anillo.

## Pruebas antes del código

Solo las mínimas de dinero: `src/lib/mover.ts` (origen distinto del destino, monto hasta el saldo, la confirmación de Inversión) y `src/lib/etiquetas.ts` (leer y validar etiquetas).

En cola, por pedido del desarrollador, para `/f-verify 007`: los ★ 1 a 3, 6, 7 y 9 contra la base (`scripts/comprobar-007.ts`), con carreras de deshacer un cobro contra repartir y de mover contra repartir.

## Riesgos y decisiones

- Deshacer un cobro ya repartido no se permite: devolver el reparto a mano llega con Mover, que esta misma feature trae.
- Construida y publicada antes de verificar y revisar, por pedido del desarrollador.
