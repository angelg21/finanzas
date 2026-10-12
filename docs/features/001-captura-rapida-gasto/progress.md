# 001 · Progreso

Rama: `feat/001-captura-rapida-gasto`. Spec: `spec.md`.

## Tareas

Cada tarea cabe en 30 a 60 minutos y termina en verde con un commit. Se marca con la fecha al cerrarla.

- [x] T1 · (2026-10-11) `src/lib/dinero.ts`: `aTasa`, `bolivaresDesdeUsd`, `usdDesdeBolivares`, `formatearTasa`. Pruebas primero (criterios 6 y 7), verlas fallar, implementar.
- [x] T2 · (2026-10-11) `src/lib/gastos.ts`: `prepararGasto` para los tres casos con los números exactos de los criterios 1 a 4, el mínimo de 1 centavo del 7 y los errores de 5 y 6; `sobreSugerido` (8). `src/lib/fechas.ts`: `hoyEnCaracas` y `fechaValida` (11). Pruebas primero.
- [x] T3 · (2026-10-11) `src/db/consultas.ts`: categorías de gasto por uso en 90 días, cuentas activas con `es_propia`, sobres aptos para gasto, última cuenta propia en dólares usada en un gasto. `src/db/movimientos.ts`: `registrarMovimientos` en transacción. Lanzar `guardian-datos` antes de dar por cerrada.
- [x] T4 · (2026-10-11) `src/app/nuevo/gasto/acciones.ts`: `registrarGasto` con zod, confirmación de Inversión, revalidación de `/`, `/movimientos`, `/sobres`, `/cuentas` y estado de éxito con el resumen.
- [x] T5 · (2026-10-11) `/cuentas`: el total y el cuadre suman todas las cuentas activas, también la de la prima, que conserva su marca (criterio 16).
- [x] T6 · (2026-10-11) Piezas `CampoMonto` y `SelectorPildoras` en `src/components/formulario.tsx`, con radios nativos y la elegida en `palido`; tono `palida` en `Pildora`.
- [x] T7 · (2026-10-11) Pantalla `/nuevo/gasto` en móvil: cabecera con píldoras de tipo, formulario completo en el orden de la spec, estado de éxito con "Registrar otro" e "Ir al inicio", foco y teclado numérico.
- [x] T8 · (2026-10-11) Escritorio: `TarjetaPalida` "Antes y después" con saldos del sobre y la cuenta, actualizada al cambiar monto, cuenta o sobre. Enlaces del "+", de "Registrar movimiento" y del mosaico "Gasto" a la nueva ruta.
- [x] T9 · (2026-10-11) `pnpm capturas -- /nuevo/gasto /cuentas` en claro y oscuro, comparar con las referencias y la sección "Pantallas"; cronometrar un gasto en dólares desde el celular; ajustar. Capturas comparadas y ajustadas (formas de pago envueltas, doble anillo del monto, calendario propio); el desarrollador no reportó el tiempo del cronómetro.
- [x] T10 · (2026-10-11) Documentos: ADR nuevo "la cuenta de la prima cuenta en el cuadre" (y la tasa en diezmilésimas) con `/f-adr`; invariante en el plan (sección 4) y en `CLAUDE.md`; plan (fase 1: casilla del formulario de captura); diseño (piezas nuevas y tono `palida`); observaciones si cambió algo.

### Ampliación: categorías con icono y color

Spec, sección final. Se construye cuando el desarrollador apruebe la ampliación.

- [x] T11 · (2026-10-11) `src/lib/categorias.ts`: catálogo de iconos con palabras en español, paleta de colores, `validarCategoria` (19 y 20), `buscarIconos` y `destinoAlEliminar` (21). Pruebas primero.
- [x] T12 · (2026-10-11) Esquema: `icono` y `color` en `categorias`, con `pnpm db:generate`. Lanzar `guardian-datos` antes de `pnpm db:migrate`.
- [x] T13 · (2026-10-11) Semillas: icono y color de las 15 categorías base; `db:seed` los asigna sin pisar los que el usuario cambió (26).
- [x] T14 · (2026-10-11) Paleta: doce tokens en `globals.css`, con el contraste del icono blanco validado por script en claro y oscuro. Registro `src/components/iconos-categoria.tsx` y `CirculoCategoria` en `ui.tsx`.
- [x] T15 · (2026-10-11) `src/db`: consultas (por tipo con su número de movimientos, por id, archivadas) y operaciones (crear, actualizar, borrar o archivar, restaurar). Lanzar `guardian-datos`.
- [x] T16 · (2026-10-11) `src/app/categorias/acciones.ts`: crear, editar, eliminar o archivar y restaurar, con zod y `validarCategoria`.
- [x] T17 · (2026-10-11) Pantalla `/categorias`: pestañas Gastos e Ingresos, rejilla de círculos, "Crear" y "Archivadas (n)" (17 y 22).
- [x] T18 · (2026-10-11) `/categorias/nueva` y `/categorias/[id]`: vista previa, `SelectorIcono` con buscador, `SelectorColor`, guardar, y eliminar o archivar con su confirmación (18 a 21, 23 y 24).
- [x] T19 · (2026-10-11) Captura de gasto: píldoras con `CirculoCategoria`, píldora "Nueva" que vuelve con la categoría elegida, y accesos en la barra lateral y el menú (25 y 27).
- [x] T20 · (2026-10-11) Capturas de `/categorias`, crear y editar, y `/nuevo/gasto`, en claro y oscuro, comparadas con `docs/referencias/categorias-gestor-*.jpg`; ajustar.
- [x] T21 · (2026-10-11) Documentos: ADR "el color y el icono se guardan por nombre", diseño (piezas y paleta), plan y observación 8.

## Validación en navegador

El desarrollador anota aquí, con fecha, qué pantallas miró y en qué ancho. Sin esta nota no se pasa a `/f-verify`.

- 2026-10-11 · El desarrollador probó `/nuevo/gasto` en su celular, por la red local, y en escritorio, durante la construcción. Pidió el calendario propio y luego la ventana modal compacta, y aprobó en el chat: "ok perfecto ahora si aprobado". Anotado por Claude a su pedido. Se borró de la base local el gasto de prueba que guardó (id 615, 150 USDT); quedan 118 filas, todas `demo-*`.
- 2026-10-12 · El desarrollador probó en su celular y en escritorio la ampliación de categorías: lista, crear, editar, archivar y restaurar, y los iconos y la píldora "Nueva" en la captura. Pidió quitar el desplazamiento lateral de categoría, cuenta y sobre (hecho) y aprobó en el chat: "ok de acuerdo pasemos al verify ahora sí estoy conforme". Anotado por Claude a su pedido. La base local quedó sin datos de prueba: 15 categorías base y ningún movimiento fuera de `demo-*`.

## Etapas

- [x] Spec leída y corregida por el desarrollador (2026-10-11)
- [x] Ampliación de categorías leída y aprobada por el desarrollador (2026-10-11)
- [x] Construida (todas las tareas con commit) (2026-10-11, con la ampliación de categorías)
- [x] Validada en navegador (captura el 2026-10-11, categorías el 2026-10-12)
- [x] Verificada: `pnpm verify` en verde, cada ★ con su prueba (2026-10-12)
- [ ] Revisada: veredicto APTO PARA FUSIONAR
- [ ] Fusionada en `main` el AAAA-MM-DD

## Notas

Lo que se aprendió, lo que quedó fuera y por qué.

- 2026-10-11 · Revisión de la spec antes de construir. Corregido: el gasto del criterio 2 vale 868 centavos, no 869 (doble redondeo). Decidido con el desarrollador: se permite gastar desde la cuenta de la prima y su saldo entra en el cuadre (criterio 16); la forma de pago empieza siempre en Dólares; montos sin separador de miles; "hoy" en hora de Caracas; un gasto en Bs que vale menos de medio centavo se guarda con 1 centavo; se acepta la diferencia cambiaria de la cuenta Bolívares.
- 2026-10-11 · T2 sumó dos funciones puras que la spec no nombraba y la construcción necesita: `tasaDecimal` (la tasa como el texto `"241.8000"` que guarda `numeric(14,4)`) y `diaAnterior` (el atajo "Ayer"). `prepararGasto` recibe `hoy` como segundo argumento y devuelve todos los errores por campo a la vez.
- 2026-10-11 · `guardian-datos` sobre T3: APTO CON CAMBIOS. Atendido ya: `aCentavos` y `aTasa` leían con `Number`, así que "1e3" valía 1.000 y "0x10" valía 16; ahora solo aceptan cifras y un decimal, y redondean el tercer decimal sin flotantes ("1.005" → 101). La cuenta de respaldo ya no depende solo del nombre "Binance". `registrarMovimientos` es un solo INSERT, atómico por sí mismo, sin BEGIN ni COMMIT aparte; un lote con una fila inválida sigue sin dejar ninguna fila. Queda como condición:
  - **T4**: el `check` de la base solo valida la forma. La acción acepta `sobreId` solo si está en `sobresParaGasto()` y `categoriaId` solo si está en `categoriasDeGastoPorUso()`. Lee las cuentas de `saldosPorCuenta()` (activas), con la moneda de la base y no del formulario, y la cuenta Bolívares como la cuenta VES activa. El botón se desactiva mientras se envía (doble toque).
  - **T5 y T10**: `saldosPorCuenta` y `saldosPorSobre` filtran por activa/activo. Una cuenta o un sobre desactivado con saldo descuadra. El ADR decide entre sumar todo sin filtrar o "solo se desactiva con saldo cero". T10 también corrige los comentarios de `src/db/schema.ts` sobre "cuentas propias" y "no cuenta en los sobres".
  - **Antes de T7**: los gastos que se guarden al validar en el navegador llevan `origen = manual` y ninguna referencia, y `db:demo:limpiar` no los borra. En la base local, que hoy solo tiene filas `demo-*`, se borran al terminar la validación con `delete from movimientos where origen = 'manual' and referencia_externa is null`. Nunca en una base con datos reales.
  - **Para `/f-audit`**: repetir la prueba del lote inválido contra el pooler de Supabase (puerto 6543). Además, `src/db/semilla-demo.ts` usa `Math.round(usd * tasa)` y `toFixed` fuera de `dinero.ts`.
- 2026-10-11 · T4 añadió `saldosTras` a `src/lib/gastos.ts`, una función pura con pruebas. Aplica las filas a los saldos para el resumen tras guardar y le servirá al "Antes y después" de T8; así la acción no hace otra consulta después de insertar. La confirmación de Inversión viaja como `confirmarSobre=<id>`: si se cambia de sobre después del aviso, no vale. La acción todavía no tiene pantalla; se ejercita de punta a punta en T7.
- 2026-10-11 · Desde el celular, por la IP de la red, Next 16 bloqueaba sus recursos de desarrollo y la app no arrancaba: el botón de tema no respondía, ni el foco ni la sugerencia de sobre. `next.config.ts` permite las IP privadas en `allowedDevOrigins`, solo en desarrollo. Comprobado con una captura entrando por 10.15.18.252: ya aparece la insignia de Next y no hay ninguna solicitud bloqueada.
- 2026-10-11 · T7, cómo quedó y la evidencia:
  - Lo que se ve según la forma de pago se decide en CSS con `:has()` sobre el radio marcado: funciona sin JavaScript y no parpadea al cargar.
  - React 19 reinicia el formulario al terminar cada acción. Por eso el estado lleva `ronda` y los campos se montan de nuevo con lo tecleado.
  - "Hoy" y "Ayer" son un grupo de radios `atajoFecha` que la acción ignora; sin JavaScript manda el campo de fecha.
  - Piezas añadidas: `EnlaceBoton`, el mismo estilo que `Boton` pero como enlace, para "Registrar otro" e "Ir al inicio" sin JavaScript; y `envolver` en `SelectorPildoras`, para que las tres formas de pago se vean sin desplazar.
  - Límite de plataforma: iOS Safari no abre el teclado con el foco automático sin un toque previo. El campo recibe el foco, pero el teclado solo se abre solo en Android. Se mide en T9.
  - Evidencia, con el formulario enviado como un navegador sin JavaScript (`curl` con los campos ocultos de Next) contra la base local:
    - criterio 1: 4200 USDT = 4200;
    - criterio 2: transferencia 2000 → 483600 a `241.8000` y gasto de 210000 VES = 868, con aviso del vuelto;
    - criterios 5 y 6: errores junto al campo, también con "1e3";
    - criterio 9: primero el aviso y, confirmado, se guarda;
    - criterio 11: rechaza 2099-01-01;
    - criterio 16: gasto desde la cuenta de la prima y `/cuentas` sigue diciendo "Cuadra con los sobres" (el cuadre anterior habría dado 528464 contra 527864);
    - envíos hostiles: sobre "Por asignar", una categoría de ingreso y Bolívares como cuenta en dólares, todos rechazados.
    - Las 11 filas de prueba se borraron después; la base vuelve a 118 filas, todas `demo-*`.
- 2026-10-11 · El desarrollador pidió un calendario acorde con la app: el del navegador "está muy feo" y no se puede estilizar. Ahora es `SelectorFecha` (`src/components/calendario.tsx`), con píldoras Hoy, Ayer y Otra fecha y un calendario propio. Las funciones de fecha (`celdasDelMes`, `moverMes`, `mesDe`, `etiquetaFecha`, `fechaLarga`, `nombreMes`) son puras, tienen pruebas en `src/lib/fechas.test.ts` y se vieron fallar antes de implementarlas. Sin JavaScript, el campo nativo dentro de `<noscript>`. Lo vi abierto en claro y en oscuro, con el formulario abierto a mano solo para la captura. Esa captura destapó un choque de clases: "Hoy" no se marcaba porque dos fondos competían en el mismo elemento. Ahora la forma de la píldora va aparte de sus colores.
- 2026-10-11 · El desarrollador lo quiso más chico y como ventana que salga solo para elegir la fecha. Ahora es un `<dialog>` modal de 300 px, con días de 36 px y el velo en un token nuevo, `velo`, en los dos temas. Escape o tocar fuera lo cierran. Al abrirse, el foco va al día elegido.
- 2026-10-11 · T12, migración `0002_wet_wrecker.sql`: añade `icono` y `color` a `categorias`. `guardian-datos` dio APTO, con BEGIN/ROLLBACK sobre la base local y la migración completa sobre una copia desechable. `schema.ts` toma los valores por defecto de `src/lib/categorias.ts`, por import relativo, en vez de repetirlos. Al hacerlo, la migración aún sin aplicar ni guardar en git se borró y se volvió a generar con `db:generate`: el SQL es idéntico al revisado y solo cambió el nombre del archivo; nada se editó a mano. Aplicada con `db:migrate`: las 15 categorías tienen `etiqueta` y `pizarra`. Condiciones del guardián:
  - **T13**: actualizar solo `where icono = 'etiqueta' and color = 'pizarra'`, con las dos columnas juntas. Una prueba comprueba que lo que asigna la semilla existe en el catálogo. Decidir que la semilla no reviva una categoría base que el usuario renombró o borró.
  - **T14**: el registro de iconos y `CirculoCategoria` usan el valor por defecto ante un nombre fuera del catálogo.
  - **Importador**: validar contra el catálogo, nunca copiar el hexadecimal de Gestor de Gastos.
  - **Supabase**: migrar antes de desplegar.
- 2026-10-11 · T13, cómo quedó la semilla y la evidencia:
  - Las 15 categorías base viven en `categoriasBase` (`src/lib/categorias.ts`), con una prueba de que su icono y su color existen en el catálogo.
  - `db:seed` las inserta solo en una base sin categorías, para no revivir las que el usuario renombró o borró. En una base existente solo actualiza las que tienen a la vez `etiqueta` y `pizarra`.
  - Probado en una copia desechable (`finanzas_t13`, borrada después): la base vacía recibe las 15 con su icono; el verde que el usuario eligió para Comida se respeta; Ocio renombrada a Diversión no revive.
  - Caso residual aceptado: si alguien deja a propósito `etiqueta` y `pizarra` en una categoría base, la siguiente semilla le pone su icono.
  - En la base local, las 15 tienen ya su icono y su color.
- 2026-10-11 · T14:
  - Paleta de doce tokens `--cat-*`. Todos dan 4,2:1 o más con el icono blanco. En oscuro, pino e índigo van más claros, porque contra la tarjeta oscura el círculo se perdía (1,8:1).
  - `src/components/paleta-categorias.test.ts` lee `globals.css` y fija esa regla para siempre. `iconos-categoria.test.ts` comprueba que los 128 nombres tienen icono, sin dibujos repetidos, y que lo desconocido cae en el valor por defecto.
  - Trampa encontrada: importar el icono `Map` de lucide tapaba el `Map` de JavaScript; se importa como `IconoMapa`.
- 2026-10-11 · T15: `guardian-datos`, APTO CON CAMBIOS y, tras corregir, APTO. Lo medido y lo corregido:
  - **Eliminar**: contaba y borraba sin bloquear la fila. Con un gasto guardándose a la vez daba error de clave foránea en vez de archivar. Ahora `bloquearYContar` hace `FOR UPDATE` antes de contar, y en la misma carrera archiva.
  - **Editar**: la base dejaba cambiar el tipo de una categoría con movimientos (21 gastos quedaron con categoría de ingreso). `actualizarCategoria` lo impide también en la base.
  - **Restaurar**: podía dejar dos activas con nombres equivalentes. Ahora busca una activa equivalente con `repetidaDe` y avisa en vez de restaurar.
  - **Demo**: buscaba las categorías solo por nombre; ahora por nombre y tipo.
  - **Residuo sin cerrar, de antes de la ampliación**: un gasto validado justo antes de cambiar el tipo de una categoría sin movimientos puede entrar después del cambio. Se cierra cuando `registrarMovimientos` compruebe el tipo de la categoría al insertar.
- 2026-10-11 · T16 a T19, evidencia con los formularios enviados como un navegador sin JavaScript contra la base local:
  - crear (18);
  - repetida sin acentos ni mayúsculas, catálogo y nombre vacío (19);
  - tipo fijo con movimientos (20);
  - borrar sin movimientos y archivar Comida con sus 21 (21);
  - archivadas, restaurar y la oferta de restaurar (22);
  - volver a la captura con la categoría elegida (25); un `volver` hacia otra dirección se ignora.
  - Restaurar con una "comida" activa insertada por SQL se negó con aviso.
  - Todo lo de prueba se borró: quedan 15 categorías activas, Comida con sus 21 movimientos y 118 movimientos `demo-*`.
- 2026-10-11 · T20, capturas de `/categorias`, crear y editar, y `/nuevo/gasto` en claro y oscuro, comparadas con `docs/referencias/categorias-gestor-*.jpg`. Ajustes:
  - el icono elegido toma el color de la categoría, como en la referencia;
  - al editar, la lista se desplaza hasta el icono elegido;
  - el botón de archivar usa la variante `peligro`.
- 2026-10-12 · A pedido del desarrollador, las categorías de la captura se envuelven en varias filas también en el celular, sin desplazamiento lateral, porque con muchas categorías resultaba incómodo. Spec ajustada (criterio 12 y Pantallas). Luego pidió lo mismo para Cuenta y Sobre: ninguna fila de la captura se desplaza de lado.
- 2026-10-12 · `/f-verify`. Doce criterios ★ (1 a 7, 16 y 18 a 21), cada uno con pruebas escritas desde el texto de la spec, no desde el código:
  - **Funciones puras**, 73 pruebas en tres archivos nuevos, aparte de las de construcción:
    - `src/lib/gastos.criterios.test.ts`: 1 a 6, el mínimo de un centavo del 7 y el 16.
    - `src/lib/dinero.criterios.test.ts`: la conversión del 7, también una rejilla de montos y tasas que comprueba que el resultado es entero y queda a medio centavo o menos del valor exacto.
    - `src/lib/categorias.criterios.test.ts`: 18 a 21.
  - **Contra la base**, `scripts/comprobar-001.ts`: 1 a 4, 16, 18, 20 y 21 con las operaciones reales de `src/db`, y con `--url` también las páginas servidas por el build. Se niega a correr si hay movimientos que no sean `demo-*`. Lo que inserta lleva la referencia `demo-comprobar-001-*` y lo borra al terminar. Comprueba además que la base queda igual.
  - **Humo**: no cubría ninguna ruta de la feature. Ahora también `/nuevo/gasto`, `/categorias`, `/categorias/nueva` y el 404 de `/categorias/999999`.
  - `pnpm verify`, la última línea de cada gate:
    - tipos: `✓ tipos (2.8 s)`
    - lint: `✓ lint (7.0 s)`
    - formato: `All matched files use Prettier code style!`
    - estructura: `estructura: 0 errores, 11 avisos`. Diez avisos son el recordatorio de cada archivo de pruebas. El otro: `src/components/iconos-categoria.tsx` tiene 326 líneas, viene de T14 y sigue siendo un solo registro.
    - unitarias: `Tests  194 passed (194)`
    - build: `✓ build (14.3 s)`, con las once rutas
    - humo: `✓ humo: todas las rutas responden.`
    - cierre: `✓ verify:full en verde en 30.6 s. Árbol sellado.`
  - `pnpm exec tsx scripts/comprobar-001.ts --url http://localhost:3124`, con `next start` sobre el build y la base local de demostración:

    ```text
    Base local · hoy en Caracas 2026-10-12 · 118 movimientos, 15 categorías
    ✓ 16 · al empezar, la suma de sobres es igual a la suma en USD de todas las cuentas activas (sobres 539300, cuentas 539300)
    ✓ 1 · un gasto de 4200 USDT que vale 4200 USD, de Binance, Gastos del mes y Comida, manual, sin tasa
    ✓ 1 · es un solo movimiento
    ✓ 1 · el cuadre se mantiene (535100)
    ✓ 2 · dos movimientos con la misma fecha
    ✓ 2 · transferencia de 20 USDT de Binance a Bolívares: 483600 centavos de Bs a 241.8000
    ✓ 2 · gasto de 2100 Bs desde Bolívares que vale 868 centavos USD, Gastos del mes y Comida
    ✓ 2 · Bolívares recibe 273600 centavos de Bs de vuelto (273600)
    ✓ 2 · el cuadre se mantiene (534232)
    ✓ 2 · una sola transacción: con el gasto inválido no queda ni la transferencia
    ✓ 3 · es un solo movimiento
    ✓ 3 · gasto de 500 Bs desde Bolívares que vale 207 centavos USD, en Transporte
    ✓ 4 · el gasto se registra completo: 250000 centavos de Bs, 1042 centavos USD
    ✓ 4 · Bolívares baja 10000 centavos de Bs: desde cero queda en −10000 (-10000)
    ✓ 16 · el gasto desde la Cuenta prima se registra como desde cualquier otra
    ✓ 16 · su saldo entra en el total de cuentas
    ✓ 16 · y el cuadre se mantiene (528783)
    ✓ 16 · la cuenta conserva su marca: no es propia
    ✓ 16 · /cuentas dice «Cuadra con los sobres»
    ✓ 16 · /cuentas muestra «a nombre de mi prima»
    ✓ 16 · el inicio muestra «A nombre de mi prima»
    ✓ 16 · el selector de cuenta muestra «a nombre de mi prima»
    ✓ 18 · antes de crearla, Mascotas no está en la captura
    ✓ 18 · existe Mascotas, de gasto, activa, con icono huella y color lavanda
    ✓ 18 · aparece en las píldoras de la captura
    ✓ 18 · /categorias la muestra
    ✓ 18 · /nuevo/gasto la muestra
    ✓ 20 · cambian el nombre, el icono y el color
    ✓ 20 · la operación responde «actualizada» (actualizada)
    ✓ 20 · sus movimientos siguen en la misma fila
    ✓ 20 · y muestran el nombre nuevo
    ✓ 20 · con movimientos el tipo no cambia (tipo-fijo)
    ✓ 20 · sin movimientos el tipo sí cambia
    ✓ 20 · /movimientos muestra el nombre nuevo
    ✓ 21 · antes de confirmar, la edición dice «Tiene 2 movimientos: se archivará, no se borra»
    ✓ 21 · y sin movimientos dice que se borrará
    ✓ 21 · sin movimientos se borra (borrada)
    ✓ 21 · con movimientos se archiva, no se borra (archivada)
    ✓ 21 · desaparece de la captura
    ✓ 21 · sus movimientos la conservan
    ✓ 21 · /nuevo/gasto ya no la ofrece
    ✓ — · la base queda como estaba: mismos saldos, movimientos y categorías (118 movimientos, 15 categorías)
    ✓ comprobar-001: todo en verde
    ```

  - Lo que queda fuera de las pruebas automáticas: el texto de los avisos de la pantalla de éxito, que sale del saldo que calcula `saldosTras` (probado en los criterios 2 y 4). Se vio en el navegador el 2026-10-11.
- 2026-10-12 · `/f-review`, primera vuelta.
  - **`revisor`: NO APTO.** Hallazgos:
    1. **Media-alta, datos.** En "Bolívares vendiendo USDT" la venta no sale de Binance por defecto. Sale de la cuenta del último gasto manual en dólares, porque la venta y el pago en dólares comparten un solo grupo `cuentaId`. Además, la confirmación no dice de qué cuenta salieron los dólares. El revisor lo reprodujo: un gasto desde Efectivo y luego una venta con el valor por defecto dejaron una transferencia desde Efectivo. Binance queda inflada y el cuadre no lo delata. Nadie lo vio antes porque toda la demo es `importado` y `cuentaPorDefectoParaGasto` solo mira gastos `manual`. Incumple Pantallas: "Binance por defecto".
    2. **Baja.** Una venta puede guardar una transferencia que entrega 0 Bs (vendido "0,01" a tasa "0,4"). `prepararGasto` no exige `recibidos > 0` y el check de la base no cubre `monto_destino_centavos`.
    3. **Baja, texto.** "Te quedan X en Bolívares, de vuelto" sale también al pagar con "Bolívares del saldo", donde no hubo venta. Pantallas dice "si aplica".
    4. **Para el ship.** Hay archivos sin commit en `.claude/agent-memory/` de los dos subagentes.
  - **`guardian-datos` sobre T13 y los comentarios del ADR 0006: SEGURO DE APLICAR.** Hallazgos sin bloqueo:
    - dos `db:seed` a la vez en una base vacía pueden chocar con `23505`, sin dañar datos;
    - una categoría nueva en `categoriasBase` no llega a una base existente;
    - la nota de la Cuenta prima en `seed.ts` es anterior al ADR 0006;
    - `semilla-demo.ts` sigue con flotantes, para `/f-audit`.
  - **Corregido**, un commit por hallazgo:
    - **1** (`64af718`): la venta tiene su propio grupo `cuentaVentaId`, visible solo al vender, con `cuentaPorDefectoParaVenta()` (Binance) como valor inicial, también sin JavaScript. `cuentaPorDefectoParaGasto` la usa como respaldo sin historial. La confirmación dice "con 20,00 USDT vendidos de Binance" y "Registrar otro" conserva las dos cuentas (`?cuenta=` y `?venta=`). Spec, Pantallas 2 y 3, al día. La opción se sigue llamando "Bolívares vendiendo USDT" aunque la cuenta sea en USD, porque así la nombra la spec.
    - **2** (`17bbedf`): prueba primero, vista fallar ("Se esperaban errores y hubo filas"). Ahora `prepararGasto` rechaza la venta con "A esa tasa la venta no llega a 0,01 Bs". El caso límite, 1 centavo a 0,5, entrega 1 céntimo y se guarda. El check de la base sigue sin cubrir `monto_destino_centavos`; no se migra por esto.
    - **3** (`6b1f575`): el vuelto solo se anuncia con `forma === "vendiendo"`.
  - **Evidencia**, con el build en :3124 y el formulario enviado como un navegador sin JavaScript (`$ACTION`), repitiendo la reproducción del revisor:
    - antes de nada, `cuentaId` = 1 y `cuentaVentaId` = 1;
    - un gasto de 5 en Dólares desde Efectivo; al recargar, `cuentaId` = 3 (criterio 12) y `cuentaVentaId` = 1;
    - la venta con esos valores por defecto: la fila 655 es `transferencia|2000|USDT|483600|241.8000|Binance|Bolívares`, cuando antes salía de Efectivo. La confirmación dice "2.100,00 Bs en Comida desde Bolívares, con 20,00 USDT vendidos de Binance … Te quedan 2.736,00 Bs en Bolívares, de vuelto";
    - una venta eligiendo Efectivo a mano se respeta: "5,00 USD vendidos de Efectivo";
    - 1 Bs del saldo: ya no hay aviso de vuelto;
    - una venta de 0,01 a 0,4 no se guarda: "A esa tasa la venta no llega a 0,01 Bs";
    - "Registrar otro" sin JavaScript (`?forma=vendiendo&cuenta=3&venta=2`) marca la venta, la cuenta 3 y la venta en 2;
    - `/cuentas` dice "Cuadra con los sobres".
    - Las 6 filas de prueba (654 a 659) se borraron: 118 movimientos, todos `demo-*`.
  - Capturas de `/nuevo/gasto` en escritorio y celular, claro y oscuro, en Dólares y en venta: en Dólares solo se ve "Cuenta" (Efectivo); al vender solo "Salen de" (Binance), y el "Antes y después" sigue a Binance.
  - `pnpm verify`: tipos, lint y formato en verde; `estructura: 0 errores, 12 avisos`; `Tests 196 passed (196)`; build; humo con las 10 rutas; `✓ verify:full en verde en 24.9 s`. El aviso nuevo es `formulario-gasto.tsx` con 325 líneas: sigue siendo solo el formulario de captura y no se parte.
