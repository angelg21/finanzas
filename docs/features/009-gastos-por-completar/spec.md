# 009 · Gastos por completar

Fecha: 2026-10-22. Estado: aprobada con las correcciones del desarrollador (2026-10-22).

## Para qué

El desarrollador gasta a veces bolívares que no son suyos (la cuenta de sus papás) para no cambiar dinero a cada rato, y repone días o semanas después vendiendo USDT. Para entonces los gastos ya no están registrados y se olvidan. Necesita anotarlos en el momento con lo que sabe (categoría, descripción, fecha y, si lo sabe, el monto) y completarlos después con monto, forma de pago, cuenta y sobre.

## Trazabilidad al plan

Fase 1, "Formulario de captura rápida de gasto" y "Flujo de gasto en bolívares". Se agrega al plan en la última tarea.

Decisiones del desarrollador, 2026-10-22:

- se anota desde Registrar → "Por completar", y desde la captura de gasto con "Anotar sin monto";
- el monto es opcional, en Bs o en USD;
- se completa uno por uno, cada uno con su propia venta si se paga vendiendo USDT, y también varios a la vez con una sola venta para todos;
- si en la venta única sobran bolívares, la app pregunta: a la cuenta de Bolívares, o no es suyo y se registra como un gasto más (Familia por defecto), para que Binance quede exacto.

## Criterios de aceptación

**Anotar**

1. ★ **No mueve dinero.** Un gasto por completar no es un movimiento: no cambia el saldo de ninguna cuenta ni de ningún sobre, ni el gastado del mes, ni las gráficas. El cuadre no se toca.
2. En `/nuevo/por-completar`: categoría de gasto (obligatoria), descripción (opcional, hasta 200), fecha (hoy, ayer u otra pasada) y monto opcional con su moneda, Bs o USD. "Anotar" lo guarda y deja la pantalla lista para el siguiente, con "Anotado" y cuántos hay por completar.
3. ★ Un reintento con el mismo id de captura no anota dos veces.

**La lista**

4. `/por-completar` muestra los pendientes del más viejo al más nuevo, agrupados por día: categoría, descripción y monto si lo tiene. Cada uno con "Completar" y "Descartar" (con confirmación).
5. Si hay alguno, el inicio y Registrar lo dicen: "3 gastos por completar".

**Completar uno**

6. ★ "Completar" abre la captura de gasto con su categoría, descripción, fecha y monto (si lo tenía; en Bs, la forma de pago viene en "Bolívares vendiendo USDT"). Al guardar, en una sola transacción se registra el gasto como cualquier otro y el pendiente desaparece. Se vuelve a la lista con "Completado".
7. ★ Si el pendiente ya no existe (se completó en otra pestaña o se descartó), no se registra el gasto y lo dice: "Este gasto ya se completó o se descartó".

**Completar varios**

8. ★ En `/por-completar/varios` se eligen los pendientes (todos marcados al entrar) y, para todos, la forma de pago:
   - **Dólares**: la cuenta; cada uno con su monto en esa moneda y su sobre;
   - **Bolívares vendiendo USDT**: la cuenta de donde salen los dólares, los USDT vendidos y la tasa; cada uno con su monto en Bs y su sobre. Se registra **una sola venta** (la transferencia de USDT a Bolívares por lo vendido, a esa tasa) y un gasto en Bs por cada pendiente, a la misma tasa. Si los gastos pasan de lo recibido, se avisa antes de guardar ("Bolívares quedará en −X");
   - ★ **si sobran bolívares de la venta**, antes de guardar la app pregunta qué hacer con el resto ("Sobran 300,00 Bs de la venta"): "A mi cuenta de Bolívares" (queda como vuelto) o "No es mío: registrarlo como gasto", con su categoría y su sobre (Familia por defecto) y la descripción "Resto de la venta". Sin elegir no se guarda. Así Binance siempre baja exactamente lo vendido y el cuadre se mantiene;
   - **Bolívares del saldo**: la tasa; cada uno con su monto en Bs y su sobre.
9. ★ El sobre de cada uno viene sugerido por su categoría, como en la captura. Todo va en una transacción: los gastos, la venta si la hay y el borrado de los pendientes; si uno falla, no se guarda ninguno. El cuadre se mantiene.
10. ★ Si alguno de los elegidos ya no existe, no se guarda nada y lo dice.

**Siempre**

11. ★ Las acciones empiezan con la sesión y pasan por `conFallas`. La captura rápida de gasto no se vuelve más lenta: sin `?pendiente=`, nada cambia.

## Pantallas

- **`/nuevo/por-completar`**: el selector de Registrar con "Por completar"; una `Tarjeta` con la categoría en `SelectorPildoras` (con sus círculos), la descripción en `Entrada`, `SelectorFecha`, y el monto opcional en `CampoMonto` con "Bs · USD" en `SelectorPildoras`. Botón "Anotar". Debajo, "Ver los N por completar".
- **Registrar**: una quinta tarjeta "Por completar", con `ClipboardList`, "Anota ahora; el monto y el sobre, después.". En la captura de gasto, el enlace "Anotar sin monto" bajo el selector de tipo.
- **`/por-completar`**: título "Por completar"; arriba, "Completar varios" (botón secundario); la lista en tarjetas por día, cada fila con `CirculoCategoria`, la descripción, el monto en `texto-2` si lo hay, "Completar" (enlace) y una X para descartar.
- **`/por-completar/varios`**: la forma de pago en `SelectorPildoras`; según ella, la cuenta, USDT vendidos y tasa; luego una fila por pendiente con su casilla, su categoría y descripción, su `CampoMonto` y su sobre en un `Selector`. Al pie, el total y, al vender, lo recibido y el vuelto. Botón "Registrar los N gastos".
- **Inicio**: una `Pildora` enlazada "3 gastos por completar" junto al saludo del hero, solo si hay.

## Datos

- **Tabla nueva `gastos_por_completar`**: `id`, `fecha` (date), `categoria_id` (FK, obligatoria), `nota`, `monto_centavos` y `moneda` (opcionales, los dos o ninguno: check), `referencia` (única, para el reintento), `creado_en`. RLS sin políticas.
- **Migración 0007** con `pnpm db:generate`; `guardian-datos` antes de aplicarla. En producción, `db:migrate:produccion` antes de publicar.
- Semillas y demo: sin cambios. Los gastos completados son movimientos normales con su referencia de captura.

## Fuera de alcance

Editar un pendiente (se descarta y se vuelve a anotar), pendientes de ingresos, varias monedas en un mismo "completar varios", y llevar la cuenta de lo que se debe a los papás (eso son las deudas de la 005).

## Pruebas antes del código

- `src/lib/por-completar.ts`: validar un pendiente (categoría, fecha, monto y moneda), y preparar "completar varios" en cada forma de pago: una sola venta con lo vendido y lo recibido, un gasto por pendiente a la misma tasa, el vuelto o el negativo de Bolívares, y el cuadre con `saldosTras`.
- Contra la base, en `/f-verify`: completar dos veces el mismo, completar contra descartar, y que nada quede a medias.

## Riesgos y decisiones

- **Una sola venta al completar varios.** Así pasa en la realidad: el lunes se vende USDT una vez y se repone todo. Registrar una venta por gasto inventaría ventas que no hubo.
- El dinero de los papás no se modela aquí: la cuenta en Bs de la app es la del desarrollador, y lo que importa es lo que salió de Binance y en qué se gastó.
