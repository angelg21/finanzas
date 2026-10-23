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
2. ★ Deshacer borra el movimiento en una transacción con el candado de la deuda. Un pago devuelve el dinero a su cuenta y al sobre Deudas, y la deuda vuelve a tener ese pendiente. Un cobro saca el dinero de la cuenta y de "Por asignar", con su candado; si "Por asignar" ya no lo tiene, sigue el criterio 11.
3. ★ El cuadre entre sobres y cuentas se mantiene, y una deuda "pagada" o "cobrada" vuelve a abierta si le queda pendiente.

**Etiquetas con #**

4. Una palabra que empieza con # en la nota de cualquier movimiento es una etiqueta (#SAX, #Rielco); "#sax" y "#SAX" son la misma.
5. En `/movimientos`, debajo del periodo, las etiquetas usadas en el periodo y la pestaña, como píldoras. Tocar una filtra la lista y el total de arriba ("#sax · 1.200,00 USD"); tocarla otra vez la quita. El anillo sigue siendo el del periodo. Se combina con el filtro por categoría.
6. ★ `?etiqueta=` inválido (vacío, con espacios o símbolos, de más de 30) no filtra y la página no falla; nunca llega a una consulta sin validar.

**Mover entre sobres**

7. ★ En `/nuevo/mover` (Registrar → Mover, y "Mover" en `/sobres`): de qué sobre, a qué sobre, monto y nota. Se guarda una reasignación de hoy. El monto va de 0,01 al saldo del origen: nunca lo deja en negativo. Se escribe con el candado del origen (el del reparto) y dentro se vuelve a mirar el saldo.
8. ★ Desde Inversión, antes de guardar: "Inversión es intocable: lo que sale de aquí deja de crecer. ¿Mover igual?" y un segundo botón "Sí, mover de Inversión". Sin confirmar no se guarda.
9. ★ Un reintento con el mismo id no duplica (la referencia de la captura, como al repartir). La acción empieza con la sesión y pasa por `conFallas`.
10. **Mover no cuenta como reparto** (decidido por el desarrollador el 2026-10-22, tras cuatro vueltas de revisión). Lo que pide un fijo en el reparto y la cuota de Deudas solo miran lo que el reparto le dio a cada sobre desde "Por asignar" en el mes: el de un ingreso, "Repartir" y "Apartar". Lo que se mueve a mano con Mover, también hacia o desde "Por asignar", no cuenta. Por eso:
    - ir y volver, en cualquier orden y aunque cruce de mes, no cambia nada;
    - mover dinero a un fijo no lo da por cubierto, y sacarlo no hace que lo pida otra vez;
    - en Deudas, lo apartado es su saldo menos lo que el reparto le dio en el mes: meter dinero a mano baja la cuota, y sacarlo, a "Por asignar" o a otro sobre, la sube igual, antes o después del reparto del mes; y repartir lo que falta la deja cubierta.

    Los Mover se guardan con su propia marca en la referencia (`captura-<id>-mover-<sobre>`). Los que se hicieron antes de este cambio (del 17 al 22 de octubre de 2026) tienen la del reparto: si salieron de "Por asignar", cuentan como reparto hasta que termine octubre. Ni el origen ni el destino de Mover vienen elegidos, y la confirmación de sacar de Inversión vale para ese origen y ese monto.

11. ★ **Deshacer lo hace todo, con vista previa** (decidido por el desarrollador el 2026-10-22, tras la quinta vuelta de revisión). Si "Por asignar" ya repartió lo que un cobro trajo, deshacerlo retira lo que falta, nunca más de lo que el cobro trajo, de lo que se repartió desde "Por asignar" después del cobro con "Repartir" y "Apartar", del más reciente al más viejo (nunca Mover, ni el reparto propio de otro ingreso, que no pasa de su monto: es de su propio dinero, y así ese ingreso se sigue borrando entero; guardian-datos, 2026-10-23): las reasignaciones que caben enteras se borran y la última se achica. Lo retirado cuenta como reparto deshecho, así el reparto siguiente lo vuelve a pedir. Lo mismo al borrar un ingreso (criterio 7 de la 006), sin contar su propio reparto, que se va con él. Antes de aplicarlo:
    - la confirmación muestra lo que se retira de cada sobre ("se retiran 6,00 de lo repartido después (Gastos del mes 1,00 · Planes 5,00)") y, en "Así queda", el saldo de la cuenta, de "Por asignar" y de cada sobre tocado, antes y después; un saldo que queda en negativo va en `negativo`;
    - solo se aplica con la firma de esa misma vista previa (qué filas, cuánto de cada una y los saldos que muestra), dentro de la transacción y con los candados, también el de cada sobre del que se retira. Sin ella, o si algo cambió desde que se vio, no se toca nada y la página vuelve con la vista previa de ahora: "Algo cambió desde la vista previa. Mira cómo queda ahora y confirma otra vez.";
    - si lo repartido después no cubre lo que falta, porque salió de otra forma, no se ofrece y lo dice: "Por asignar tiene 15,00; le faltan 5,00, y lo repartido después solo cubre 0,00: lo demás ya salió de Por asignar de otra forma (con Mover, con un préstamo, o al bajar o borrar otro ingreso o deshacer otro cobro). Devuelve 5,00 a Por asignar con Mover y vuelve a intentarlo."
    - límite conocido: una fila de reparto de un mes anterior por fecha pero posterior por id (un ingreso con fecha pasada registrado después) se retira igual, y descuenta lo recibido de ese mes, no del de hoy.

## Pantallas

- **Deshacer**: `/movimientos/[id]` de un pago o un cobro: el título ("Pago a Papás"), el monto, la cuenta y la fecha, y "Deshacer pago" con `EnlaceBoton` `peligro`, con la misma confirmación de borrar de la 006. La de un cobro, y la de borrar un ingreso, llevan la vista previa del criterio 11: lo retirado en `texto-2` y "Así queda" con cada saldo en `Cifra` `sm`, antes → después.
- **Etiquetas**: una fila de `Pildora` enlazadas bajo los controles de periodo; la elegida en `palida`.
- **Mover**: una `Tarjeta` de 6 columnas centradas, como `/deudas/apartar`: "De" y "A" en `SelectorPildoras` con el saldo de cada sobre, `CampoMonto`, nota, el aviso de Inversión en `negativo` y el botón "Mover".

## Datos

Sin tablas, columnas ni migración. Las etiquetas se leen de `nota` con una expresión regular sobre el texto validado. Mover es una `reasignacion` con `captura-<id>-mover-<destino>` (criterio 10). Retirar lo repartido (criterio 11) borra o achica reasignaciones que ya existen; no agrega filas.

## Fuera de alcance

Deshacer préstamos, editar pagos y cobros, mover entre cuentas, etiquetas como columna o con colores, y un resumen por etiqueta en el anillo.

## Pruebas antes del código

Solo las mínimas de dinero: `src/lib/mover.ts` (origen distinto del destino, monto hasta el saldo, la confirmación de Inversión) y `src/lib/etiquetas.ts` (leer y validar etiquetas).

En cola, por pedido del desarrollador, para `/f-verify 007`: los ★ 1 a 3, 6, 7, 9 y 11 contra la base (`scripts/comprobar-007.ts`; las páginas del 11, en `scripts/comprobar-007-revision.ts --url`), con carreras de deshacer un cobro contra repartir y de mover contra repartir.

## Riesgos y decisiones

- Deshacer un cobro ya repartido retira lo repartido después (criterio 11). Al principio no se permitía y el remedio era devolverlo con Mover; con el criterio 10 Mover dejó de contar como reparto, así que devolverlo a mano no deshacía lo que el reparto pide, y el desarrollador decidió que deshacer lo haga todo, mostrándolo antes.
- Construida y publicada antes de verificar y revisar, por pedido del desarrollador.
