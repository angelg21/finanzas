# 006 · Editar o borrar un gasto o un ingreso

Fecha: 2026-10-17. Estado: borrador.

## Para qué

Hoy un gasto o un ingreso mal registrado no tiene arreglo desde la app: queda el error en los saldos y en las gráficas. El desarrollador empieza a usar la app en producción y necesita corregir lo que registra.

## Trazabilidad al plan

Fase 1, "Cuentas, categorías, movimientos con nota". El desarrollador aprobó el 2026-10-17 añadir: "Corregir un gasto o un ingreso ya registrado (monto, categoría, cuenta, sobre, fecha y nota) y borrarlo, sin romper nunca el cuadre entre cuentas y sobres". El plan se actualiza en la última tarea.

Decisiones del desarrollador, 2026-10-17:

- en un gasto con bolívares se puede editar todo, y la venta de USDT se recalcula;
- un ingreso ya repartido solo baja de monto si "Por asignar" alcanza;
- se edita tocando la fila, en Movimientos y en los últimos movimientos del inicio.

## Criterios de aceptación

1. ★ **El cuadre nunca se rompe.** Dado cualquier gasto o ingreso, cuando se edita o se borra, entonces la suma de los sobres sigue igual a la suma en USD de las cuentas (ADR 0002 y 0006), y los saldos siguen saliendo de los movimientos.
2. ★ **Editar un gasto en dólares.** Dado un gasto en dólares, cuando cambio monto, cuenta, sobre, categoría, fecha o nota y guardo, entonces la misma fila queda con los valores nuevos, la cuenta y el sobre de antes recuperan lo de antes, y los nuevos bajan lo nuevo. Las reglas de la captura valen igual: monto mayor que cero, fecha de hoy o anterior, cuenta en dólares activa, sobre que acepta gastos.
3. ★ **Editar un gasto con bolívares, recalculando la venta.** Dado un gasto pagado con bolívares, cuando edito, entonces el formulario es el de la captura con su forma de pago, monto en Bs, tasa y, si vendió, los dólares vendidos y su cuenta. Al guardar se recalcula todo con `prepararGasto`, como en la captura:
   - "vendiendo USDT" → la venta enlazada (la transferencia de la misma captura) se actualiza con los dólares vendidos, los Bs recibidos y la tasa nuevos;
   - si cambio a "Bolívares del saldo" o a "Dólares", la venta enlazada se borra;
   - si cambio de "Dólares" o "Bolívares del saldo" a "vendiendo USDT", se crea la venta, enlazada a la misma captura;
   - el gasto conserva su fila (su id) en todos los casos.
4. ★ **Editar un ingreso.** Dado un ingreso, cuando cambio monto, cuenta (en dólares), categoría de ingreso, fecha o nota y guardo, entonces la fila queda con los valores nuevos y la diferencia de monto entra o sale de "Por asignar". Su reparto (las reasignaciones de la misma captura) no cambia.
5. ★ **Bajar un ingreso solo si "Por asignar" alcanza.** Dado un ingreso, cuando bajo su monto en X y "Por asignar" tiene menos de X, entonces no se guarda nada y veo, junto al monto: "Por asignar tiene Y; para bajar X, borra el ingreso con su reparto y regístralo de nuevo". La comprobación va con `pg_advisory_xact_lock` sobre "Por asignar", el mismo candado del reparto.
6. ★ **Borrar un gasto.** Dado un gasto, cuando toco "Borrar" y confirmo, entonces se borran el gasto y su venta enlazada, si la tiene, en una transacción. La cuenta y el sobre recuperan lo que tenían.
7. ★ **Borrar un ingreso con su reparto.** Dado un ingreso, cuando toco "Borrar" y confirmo, entonces se borran el ingreso y las reasignaciones de su misma captura, en una transacción con el candado de "Por asignar". "Por asignar" pierde lo que quedó sin repartir y cada sobre que recibió devuelve lo suyo. Si "Por asignar" quedaría en negativo, no se borra y lo dice ("Por asignar tiene Y; le faltan Z"). Un sobre que ya gastó lo recibido puede quedar en negativo, como con un gasto; la confirmación lo avisa antes: "Gastos del mes quedará en −12,00".
8. ★ **Solo gastos e ingresos.** Transferencias, reasignaciones, pagos, préstamos y cobros no se editan ni se borran aquí: su fila no abre nada y la dirección de edición responde 404. Un gasto o un ingreso importado o de demostración, sin captura, se edita solo él: no tiene venta ni reparto enlazados.
9. ★ **Sesión y fallas.** Las acciones de editar y borrar empiezan con la sesión y pasan por `conFallas`: sin red, con la sesión vencida o con una versión vieja, el mensaje de la spec 002 junto al botón, sin perder la pantalla, y nada se guarda a medias.
10. ★ **Un reintento no hace daño.** Volver a enviar la misma edición deja lo mismo. Borrar algo que ya no existe lleva a Movimientos con "Ya estaba borrado", sin error.
11. **Desde la fila.** En `/movimientos` y en los últimos movimientos del inicio, la fila de un gasto o un ingreso es un enlace a `/movimientos/[id]`. Al guardar o borrar se vuelve a la lista de donde se vino (por defecto `/movimientos`), con "Gasto actualizado", "Ingreso actualizado" o "Borrado".
12. **Accesibilidad.** La fila enlazada se lee igual que hoy más "Editar"; foco visible; "Borrar" pide confirmación en un `<dialog>`.

## Pantallas

**`/movimientos/[id]`**, gasto. El mismo formulario de la captura (`/nuevo/gasto`) con los valores del gasto: forma de pago, monto, tasa y vendido si aplica, cuenta, categoría, sobre, fecha y nota. Título "Editar gasto"; botón "Guardar cambios"; debajo, `Boton` `peligro` "Borrar gasto". Sin "Registrar otro" ni el selector Gasto · Ingreso · Deuda · Mover. En escritorio, como `/nuevo/gasto`.

**`/movimientos/[id]`**, ingreso. Una `Tarjeta` con `CampoMonto`, cuenta en `SelectorPildoras` (solo en dólares), categoría de ingreso, `SelectorFecha` y nota. Si el ingreso tiene reparto, una línea en `texto-3`: "Se repartió: Gastos del mes 175,00 · Familia 100,00 … El reparto no cambia al editar". Botón "Guardar cambios" y `Boton` `peligro` "Borrar ingreso". En escritorio, 6 columnas centradas.

**Confirmación de borrar**: un `<dialog>`, como el del calendario, con lo que pasará ("Se borran el gasto y la venta de 20,00 USDT" o "Se borran el ingreso y su reparto; Gastos del mes quedará en −12,00") y "Sí, borrar" / "Cancelar". Sin JavaScript, el botón lleva a `?borrar=1`, que muestra la misma confirmación en la página.

**`FilaMovimiento`**: recibe un `href` opcional; con él, la fila entera es un `Link` con el mismo aspecto y foco visible.

## Datos

- **Sin tablas ni columnas nuevas.** Sin migración.
- Lo enlazado se encuentra por `referencia_externa`: `captura-<id>-gasto` con `captura-<id>-transferencia`, y `captura-<id>-ingreso` con `captura-<id>-reasignacion-<sobre>`. Una venta nueva al editar lleva `captura-<id>-transferencia` con el id de la captura del gasto.
- Editar actualiza filas; borrar las borra. No queda historial de la edición (fuera de alcance).
- Semillas y demo: sin cambios.

## Fuera de alcance

- Editar o borrar transferencias, reasignaciones, pagos, préstamos y cobros.
- Cambiar el reparto de un ingreso al editarlo.
- Historial o deshacer de las ediciones.
- Editar varios a la vez.

## Pruebas antes del código

- `src/lib/editar-gasto.ts`: qué filas actualizar, crear y borrar al pasar de una forma de pago a otra, a partir de `prepararGasto` (criterio 3).
- `src/lib/editar-ingreso.ts`: la diferencia de monto, si "Por asignar" alcanza, y lo que devuelve cada sobre al borrar con el reparto (criterios 4, 5 y 7).
- Prueba del cuadre antes y después con `saldosTras` (criterio 1).

Contra la base, después de mirar: `scripts/comprobar-006.ts` con los criterios ★ 1 a 10.

## Riesgos y decisiones

- **El dinero.** Cada edición y cada borrado van en una transacción; las de ingresos, con el candado de "Por asignar". `guardian-datos` revisa las operaciones de `src/db` antes de usarlas.
- **Pruebas en cola, por pedido del desarrollador (2026-10-17):** se construye y se publica primero; `/f-verify` y `/f-review` van después, en cola con los de la 002.
- Un ingreso movido de mes deja su reparto en el mes original: "recibido en el mes" sigue a las reasignaciones, que no cambian.
