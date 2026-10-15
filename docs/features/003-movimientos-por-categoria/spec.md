# 003 · Movimientos por tipo con gráfica por categoría

Fecha: 2026-10-14. Estado: fusionada.

## Para qué

Hoy `/movimientos` es una pila de tarjetas pálidas, todas iguales, donde no se ve en qué se va el dinero. El desarrollador quiere verlo como en una app que usa en el iPhone: los gastos separados de los ingresos, primero un anillo con el total del periodo repartido por categoría, cada porción con el color de su categoría, y debajo cada movimiento con el icono de su categoría delante. Ahora que la app se usa a diario en producción, es la pantalla que responde "¿en qué gasté este mes?".

Referencia: la captura que pasó el desarrollador el 2026-10-14, guardada en `docs/referencias/movimientos-referencia.jpg`. Muestra:

- pestañas GASTOS e INGRESOS;
- el selector Día / Semana / Mes / Año / Período;
- "‹ Octubre de 2026" con flechas;
- un anillo de colores con el total en el centro;
- filas por categoría con icono, porcentaje y monto;
- un "+" flotante.

## Trazabilidad al plan

- Fase 1, "Gráficas básicas: por mes y por categoría": esta feature hace la de categoría. La de barras por mes ya está en Inicio.
- Observación 8 (`docs/observaciones.md`) dejó fuera "los iconos en movimientos y gráficas": aquí entran.

No cambia el plan. Al cerrar, la línea de gráficas se marca como hecha en lo que toca a categoría.

## Criterios de aceptación

1. ★ **Totales exactos.** Dado un periodo y la pestaña Gastos o Ingresos, cuando se abre `/movimientos`:
   - el centro del anillo muestra la suma exacta, en centavos, del `monto_usd_centavos` de los movimientos de ese tipo con fecha dentro del periodo;
   - cada porción muestra la suma de los de su categoría;
   - la suma de las porciones es igual al total.
2. ★ **Porcentajes que suman 100.** Los porcentajes de la leyenda son enteros y suman exactamente 100. Se calculan por el método del mayor residuo. Una categoría con monto mayor que cero cuyo entero da 0 se muestra como "<1 %". Con total cero no se muestran porcentajes.
3. ★ **Cada pestaña, solo su tipo.**
   - Gastos cuenta solo movimientos `gasto`, e Ingresos solo `ingreso`.
   - Las transferencias y reasignaciones nunca entran al anillo ni a los totales: aparecen solo en la pestaña Mover. Contarlas sería contar dos veces el mismo dinero.
4. ★ **Bolívares.** Un gasto en bolívares suma al anillo y a los totales su equivalente en USD (`monto_usd_centavos`). Su fila muestra además el monto en Bs y la tasa guardada.
5. ★ **Bordes del periodo.** Cuenta la fecha del movimiento (`fecha`, que ya es el día de Caracas):
   - Día: ese día.
   - Semana: de lunes a domingo.
   - Mes: del 1 al último día.
   - Año: del 1 de enero al 31 de diciembre.

   Por ejemplo, un gasto del 31 de octubre de 2026 entra en octubre y en la semana del 26 de octubre al 1 de noviembre, nunca en noviembre.

6. ★ **Parámetros manipulados.** Dado un `?tipo=`, `?periodo=`, `?fecha=` o `?categoria=` inválido, la página no falla: cae en Gastos del mes actual sin filtro. Ningún valor llega a una consulta sin pasar por una función pura que lo valida. Los parámetros válidos son:
   - una fecha `AAAA-MM-DD` real y no futura;
   - un id de categoría entero positivo del tipo de la pestaña.
7. ★ **Lista larga.** Si el periodo tiene más de 200 movimientos en la pestaña, la lista muestra los 200 más recientes y dice "200 de N". El anillo y los totales siguen contando todos.
8. **Filtro por categoría.** Tocar una categoría de la leyenda filtra la lista a esa categoría:
   - la categoría queda marcada y las demás porciones se atenúan;
   - "Todas" quita el filtro;
   - el total del centro sigue siendo el del periodo;
   - encima de la lista se lee, por ejemplo, "Comida · 85,30 USD".
9. **Periodo.**
   - Día / Semana / Mes / Año son píldoras, y debajo va "‹ Octubre de 2026 ›".
   - La flecha siguiente se apaga en el periodo actual: no hay futuro.
   - Al cambiar de tipo de periodo se conserva el día de referencia. Si en Mes se mira septiembre y se toca Semana, se ve una semana de septiembre.
   - Por defecto: Gastos del mes actual.
10. **Lista por día.**
    - Cada día lleva un encabezado: "Hoy", "Ayer" o "Lunes 12 de octubre", con el total del día a la derecha.
    - Cada fila empieza con el círculo de su categoría, con su icono y su color.
    - Sigue la nota, o el nombre de la categoría si no hay nota, y debajo la categoría y la cuenta.
    - A la derecha va el monto: los gastos con "−" y los ingresos en `positivo`.
11. **Mover.**
    - La pestaña Mover lista las transferencias y reasignaciones del periodo, sin anillo.
    - Cada fila lleva un círculo neutro con el icono de flechas, "Origen → Destino" (cuentas o sobres) y el monto.
    - Una transferencia que cambia de moneda muestra también lo que recibió el destino.
12. **Vacíos.** Sin movimientos en el periodo, la página no se rompe:
    - el anillo se ve como pista gris con "0,00";
    - debajo se lee, por ejemplo, "No hay gastos en octubre de 2026.".
13. **Sin JavaScript.** Pestañas, periodos, flechas y filtro son enlaces con parámetros: todo funciona sin JavaScript. Con él, el anillo resalta la porción al pasar o tocar, como `GraficaDona`.
14. **Accesibilidad.**
    - Las pestañas y las píldoras de periodo llevan `aria-current`.
    - El anillo tiene `role="img"` y la leyenda es su lista equivalente.
    - Cada fila se lee completa, por ejemplo "Comida, 12,50 USD, Binance".
    - Foco visible en todo lo que se toca.
15. **Sesión y capas.**
    - La página sigue empezando con `await exigirSesion()`.
    - Las consultas nuevas viven en `src/db/` y la aritmética en `src/lib/`.
    - La página no habla con Drizzle.
16. **Sin coste para la captura.** La página hace a lo sumo tres consultas (totales por categoría, lista y resumen por día) y no toca `/nuevo/gasto`.
17. **Calendario** (pedido del desarrollador al validar, 2026-10-14). Tocar el nombre del periodo abre el calendario propio de la captura de gasto:
    - se abre en el mes del periodo y los días futuros están apagados;
    - elegir un día lleva a ese día (Día) sin cambiar la pestaña ni la categoría;
    - desde ahí, Semana, Mes o Año muestran el periodo de ese día, porque se conserva la fecha;
    - sin JavaScript, un campo de fecha nativo con "Ver" hace lo mismo.

## Pantallas

**Móvil**, de arriba abajo, en una columna con 16 px de relleno:

1. `TituloPagina` "Movimientos".
2. **Pestanas** (pieza nueva, en `src/components/pestanas.tsx` porque `ui.tsx` ya tenía 300 líneas): el patrón que ya usa `/categorias`, extraído para usarlo en las dos pantallas. Es una píldora `tarjeta` con las opciones; la elegida va en `palido` con `aria-current` y las demás son enlaces. Aquí: Gastos · Ingresos · Mover.
3. **Periodo**:
   - una fila de píldoras Día · Semana · Mes · Año, con la misma pieza `Pestanas`;
   - debajo, "‹ Octubre de 2026 ›" centrado, con las flechas como botones redondos de 40 px;
   - el nombre del periodo es un botón con el icono de calendario: **BotonCalendario**, en `calendario.tsx`, abre la misma ventana que `SelectorFecha` (criterio 17).
4. `Tarjeta` con el anillo **GraficaCategorias** (pieza nueva, en `src/components/grafica-categorias.tsx`):
   - la misma geometría que `GraficaDona` (comparten `sector`) y el mismo resaltado al pasar;
   - el color de cada porción es el de su categoría (`cat-*`), separado por 2 px del color de la tarjeta;
   - en el centro, el total en grande y debajo "USD EN GASTOS" o "USD EN INGRESOS";
   - debajo del anillo, la leyenda en dos columnas, de mayor a menor: punto de color, nombre, monto y porcentaje;
   - cada entrada es un enlace que filtra, y la primera es "Todas".
5. **Lista**:
   - encima, "Todas · 301,42 USD" o "Comida · 85,30 USD";
   - después, secciones por día con su encabezado;
   - cada movimiento es una **FilaMovimiento** (pieza nueva en `movimiento.tsx`, en lugar de `TarjetaMovimiento` en esta pantalla): `CirculoCategoria` `md`, título en 15 px y 700, subtítulo en 13 px `texto-3` y `Cifra` a la derecha;
   - las filas van dentro de una `Tarjeta` por día, separadas por una línea `tarjeta-borde`.
6. El "+" flotante, como en el resto de la app.

**Escritorio** (1024 px o más):

- Arriba, en una fila: pestañas de tipo a la izquierda; periodo y flechas a la derecha.
- Debajo, la rejilla de 12 columnas: anillo y leyenda en 5, fijos al desplazar (`sticky`); la lista en 7.

**Mover**: sin la tarjeta del anillo; la lista ocupa todo el ancho en móvil y 7 columnas centradas en escritorio.

Se compara contra `docs/referencias/movimientos-referencia.jpg` en estructura, y contra `docs/diseno.md` en colores, tipografía y radios. Los colores de la otra app no se copian: mandan los tokens.

## Datos

- **Sin migración.** Todo gasto e ingreso ya exige su categoría (check `movimientos_forma_por_tipo`), y cada categoría tiene `icono` y `color` (ADR 0008).
- **Consultas nuevas** en `src/db/movimientos-del-periodo.ts`, para no pasar `consultas.ts` de las 320 líneas:
  - `totalesPorCategoria(tipo, desde, hasta)`: `sum(monto_usd_centavos)::bigint` agrupado por categoría, con nombre, icono y color, usando `movimientos_fecha_idx`;
  - `movimientosDelPeriodo(tipo | "mover", desde, hasta, categoriaId?, limite = 200)`: lo de `baseMovimientos`, más el icono y el color de la categoría y el monto recibido por el destino;
  - `resumenPorDia(...)`: cantidad y suma en USD de cada día, con el mismo filtro que la lista. Da el "200 de N" y el total exacto de cada día aunque la lista esté cortada. Reemplazó al conteo simple al construir (T3).
- `baseMovimientos` suma `categoriaIcono` y `categoriaColor`. Inicio la sigue usando sin cambios visibles.
- Semillas y demo: sin cambios. `pnpm db:demo` ya trae cinco meses con gastos e ingresos de varias categorías y sirve para mirar.
- Los datos existentes no se tocan: es solo lectura.

## Fuera de alcance

- "Período" con rango libre de fechas.
- El selector de cuentas de la referencia ("Total ▾").
- Editar o borrar un movimiento desde la lista.
- Búsqueda y exportar.
- Inicio y `/sobres/[id]` siguen con `TarjetaMovimiento`. Si la nueva fila gusta, se cambian en otra feature.
- Gráficas comparativas con el periodo anterior y barras por categoría.
- Paginación más allá de los 200 más recientes.

## Pruebas antes del código

Funciones puras, con su `.test.ts` al lado, viéndolas fallar primero:

- `src/lib/periodos.ts`:
  - `rangoDePeriodo(tipo, ancla)` devuelve `{ desde, hasta }` inclusivos: semana de lunes a domingo, también cuando cruza mes o año; fin de mes en febrero bisiesto; año completo.
  - `moverPeriodo(tipo, ancla, ±1)`: del 31 de enero, un mes adelante da febrero sin saltarse a marzo.
  - `esPeriodoActual(tipo, ancla, hoy)`, que apaga la flecha siguiente.
  - `etiquetaPeriodo(tipo, ancla, hoy)`: "Hoy", "Ayer", "26 oct – 1 nov 2026", "Octubre de 2026", "2026".
  - `leerFiltros(parametros, hoy)`: tipo, periodo, fecha y categoría válidos, o la caída a Gastos del mes actual (criterio 6).
- `src/lib/distribucion.ts`:
  - `distribuirPorCategoria(totales)`: ordena de mayor a menor, da el total exacto en centavos y porcentajes por mayor residuo que suman 100, con la marca "<1 %" (criterios 1 y 2).

Después de mirar, una prueba por cada ★ restante: la de cada pestaña con su tipo y la de bolívares, contra la base local con datos `demo-*`, y la de la lista larga.

## Riesgos y decisiones

- **Contraste de los colores de categoría en el anillo.** En claro pasan 3:1 contra la tarjeta blanca, porque es la misma razón que con el icono blanco, ya probada en `paleta-categorias.test.ts`. En oscuro no está garantizado contra `#16302a`. Por eso cada porción lleva el separador del color de la tarjeta y la leyenda repite nombre y monto: el color no es la única pista.
- **Muchas categorías.** Con 15 de gasto, las porciones pequeñas quedan finas. Van ordenadas de mayor a menor y la leyenda las muestra todas, con "<1 %" cuando toca.
- **Un año con muchos movimientos.** La lista se corta en 200 (criterio 7). Los totales se calculan en SQL, así que no dependen del corte.
- **`GraficaDona` no cambia.** Sigue para los sobres. La pieza nueva solo importa su `sector`, sin crear un archivo de utilidades.
- **Las pestañas de `/categorias` pasan a la pieza `Pestanas`.** Es el mismo aspecto, así que no hay cambio visible allí.
