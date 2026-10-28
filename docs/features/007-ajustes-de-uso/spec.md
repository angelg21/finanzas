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

11. ★ **Deshacer lo hace todo, con vista previa** (decidido por el desarrollador el 2026-10-22, tras la quinta vuelta de revisión). "Por asignar" es una cuenta de lotes: cada cobro y cada ingreso es un lote, y lo que sale de él gasta de los lotes más viejos, primero en entrar, primero en salir; el reparto propio de un ingreso, de su propio lote. Un Mover de vuelta desde un sobre cancela antes los Mover que fueron a ese sobre: ir y volver no deja nada. Deshacer un cobro, o borrar un ingreso (criterio 7 de la 006), quita su lote y todo lo que se hizo con ese dinero: lo repartido ("Repartir" y "Apartar") y lo movido a otro sobre; esas filas se borran, o se achican si gastaron también de otro lote. Lo repartido que se retira cuenta como reparto deshecho, así el reparto siguiente lo vuelve a pedir. Como deshacer se lleva siempre todo lo que usó su dinero, quitar un lote no cambia lo que gastaron los otros: deshacer dos, en el orden de registro o al revés, deja lo mismo (saldos, lo recibido de cada mes y la cuota de Deudas), y uno se puede si y solo si se podía en el otro orden (sexta vuelta y guardian-datos, 2026-10-23). Antes de aplicarlo:
    - la confirmación muestra lo que se retira de cada sobre ("Ya se usó: se retiran 6,00 de lo que se repartió o se movió con este dinero (Planes 5,00 · Gastos del mes 1,00). Lo repartido, el reparto lo volverá a pedir.") y, en "Así queda", el saldo de la cuenta, de "Por asignar" y de cada sobre tocado, antes y después; un saldo que queda en negativo va en `negativo`;
    - solo se aplica con la firma de esa misma vista previa (qué filas, cuánto de cada una y los saldos que muestra, haya retiro o no), dentro de la transacción y con los candados, también el de cada sobre del que se retira. Si algo cambió desde que se vio, no se toca nada y la página vuelve con la vista previa de ahora: "Algo cambió desde la vista previa. Mira cómo queda ahora y confirma otra vez.". Sin firma (quien llama sin haber visto una) solo se aplica si no hay nada que retirar;
    - lo que de ese dinero se prestó, o lo que usa el reparto de otro ingreso que se bajó por debajo de lo que repartió, no se puede retirar: entonces no se ofrece y lo dice: "De este dinero, 5,00 se prestaron. Eso no se puede retirar, así que no se deshace.";
    - límites conocidos: los lotes van en el orden en que se registraron, no por fecha, así que una reasignación con fecha de un mes anterior registrada después se retira igual y descuenta lo recibido de ese mes; los Mover del 17 al 22 de octubre de 2026 llevan la referencia del reparto y se tratan como reparto; y con dos ingresos bajados por debajo de su propio reparto, el orden de deshacer puede importar (se cierra si editar no deja bajar un ingreso por debajo de lo que repartió, pendiente de decisión).

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

En cola, por pedido del desarrollador, para `/f-verify 007`: los ★ 1 a 3, 6, 7, 9 y 11 contra la base (`scripts/comprobar-007.ts`; el 11 en `scripts/comprobar-007-retiro.ts`, y sus páginas en `scripts/comprobar-007-revision.ts --url`), con carreras de deshacer un cobro contra repartir y de mover contra repartir.

## Riesgos y decisiones

- Deshacer un cobro ya repartido retira lo que se hizo con su dinero (criterio 11). Al principio no se permitía y el remedio era devolverlo con Mover; con el criterio 10 Mover dejó de contar como reparto, así que devolverlo a mano no deshacía lo que el reparto pide, y el desarrollador decidió que deshacer lo haga todo, mostrándolo antes.
- Construida y publicada antes de verificar y revisar, por pedido del desarrollador.
