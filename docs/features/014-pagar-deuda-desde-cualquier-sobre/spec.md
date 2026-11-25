# 014 · Pagar una deuda desde cualquier sobre, y como gasto si se quiere

Fecha: 2026-11-25. Estado: construida.

## Para qué

Al pagar una deuda el dinero solo podía salir del sobre Deudas, y el pago nunca contaba como gasto. El desarrollador
necesita pagar desde los demás sobres y, si quiere, que el pago aparezca también en sus gastos con una categoría (una
deuda por algo que compró es, al pagarla, un gasto). Lo pidió para corregir sus deudas ya.

## Trazabilidad al plan

Plan, sección 4, fase 1: deudas y préstamos (feature 005). Cambia dos cosas de la 005: el criterio 3 (el pago sale del
sobre Deudas) pasa a "sale del sobre que elijas, Deudas por defecto", y el 18 (un pago no es gasto ni ingreso) pasa a
"no lo es, salvo que se le ponga categoría".

## Criterios de aceptación

1. Dada una deuda que debo, cuando abro "Registrar pago", entonces hay "Sale del sobre" con Deudas elegido y los demás
   sobres activos menos Por asignar, cada uno con su saldo; la línea "X tiene A; quedará en B" sigue al sobre elegido.
2. ★ Dado un pago desde un sobre que no es Deudas, cuando lo guardo, entonces baja ese sobre y la cuenta, Deudas no
   cambia, el pendiente baja y el cuadre de sobres y cuentas se mantiene.
3. ★ Dado un pago enviado a mano desde Por asignar o desde un sobre inactivo, entonces no se guarda.
4. Dado el formulario de pago, entonces "Registrar también como gasto" es opcional, empieza en "No" y ofrece las categorías de
   gasto activas, con su icono.
5. ★ Dado un pago con categoría, cuando lo guardo, entonces es un solo movimiento: el dinero sale una vez, y el pago sale
   en Movimientos → Gastos con su categoría (lista, anillo y total), en "gastado este mes" y en la gráfica mensual, y no
   en Mover. Sin categoría, todo como antes: en Mover y fuera de los gastos.
6. ★ Dado un pago enviado a mano con una categoría de ingreso, archivada o que no existe, entonces no se guarda.
7. ★ Dado un pago con categoría, cuando lo deshago, entonces vuelven el sobre, la cuenta y el pendiente, y deja de contar
   en los gastos.
8. ★ Dado un reintento del mismo pago (misma captura), entonces no se duplica, también con sobre y categoría.

## Pantallas

- Formulario de pago (detalle de la deuda y `/nuevo/deuda`): tras la cuenta, `SelectorPildoras` "Sale del sobre" con
  el saldo de cada sobre como detalle; la línea del sobre debajo del monto usa el sobre elegido. Antes de la fecha, un
  `<details>` cuya fila se ve tocable (borde, icono, "Registrar también como gasto", "Opcional · toca para elegir la
  categoría", lo elegido a la derecha y una flecha que gira al abrir), con un `SelectorPildoras` de categorías con
  icono, "No" primero y elegido. Funciona sin JavaScript. El desplegable usa un grupo con nombre (`group/gasto`): un
  `group` a secas haría que todas las píldoras se vieran elegidas (corregido el 2026-11-25 tras usarlo en el teléfono).
- En las listas, un pago con categoría lleva el círculo de su categoría en vez del neutro, y la categoría en el detalle.

## Datos

- Migración: el check `movimientos_forma_por_tipo` deja que un `pago_deuda` lleve `categoria_id` (sigue nulo en el cobro
  y el préstamo). Sin columnas nuevas; los pagos existentes quedan sin categoría, como hoy.
- La escritura comprueba, con la transacción del pago, que el sobre esté activo y no sea Por asignar, y que la categoría,
  si la hay, sea de gasto y activa.
- Las sumas de saldos no cambian: un pago ya sale de la cuenta y del sobre como un gasto.

## Fuera de alcance

- Pagar desde Por asignar (primero se reparte o se mueve a un sobre), etiquetas en el pago, y ponerle o quitarle la
  categoría a un pago ya guardado (se deshace y se registra otra vez).

## Pruebas antes del código

`src/lib/deudas.test.ts`: `sobreAceptaPago` (todos menos Por asignar) y `prepararPago` con categoría (la fila la lleva;
sin ella, nula). El resto con `scripts/comprobar-014.ts` contra la base.

## Riesgos y decisiones

- No se registra un gasto aparte: el dinero saldría dos veces. El pago sigue siendo `pago_deuda`, con su candado, su
  pendiente y su "Deshacer pago"; la categoría solo decide si cuenta en los gastos. Las consultas de gastos usan un
  predicado común, `cuentaComoGasto`, y Mover excluye esos pagos para no mostrarlos dos veces.
