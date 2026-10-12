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
- 2026-10-12 · `/f-review`, segunda vuelta.
  - **`revisor`: NO APTO.** Los tres hallazgos de la primera vuelta quedaron corregidos y probados. Hallazgos nuevos:
    1. **Media-alta, datos, criterio 8.** Tras un error o tras el aviso de Inversión, el sobre elegido a mano se pierde al elegir la categoría. `sobreTocado` vive en `Campos`, que se vuelve a montar con `key={estado.ronda}`, y vuelve a `false`. Reproducido con Edge manejado por DevTools: sobre Familia a mano, Guardar sin categoría, elegir Comida → el sobre pasa a Gastos del mes y el gasto se guarda ahí (fila 679).
    2. **Baja, texto de dinero.** El "vuelto" de la confirmación es el saldo total de Bolívares, no el vuelto de esa venta: la segunda venta seguida dice 5.472,00 cuando su vuelto es 2.736,00.
    3. **Baja.** Con "Bolívares del saldo" y sin cuenta VES activa, el error `cuenta` no se ve, porque solo se pinta dentro de los grupos de cuentas, que están ocultos.
    4. **Baja, sin JavaScript.** La unidad del monto no sigue a la forma de pago: con "Bolívares del saldo" sigue diciendo USDT.
    5. **Conocido, no bloquea.** La carrera de T15 entre guardar un gasto y cambiar el tipo de su categoría sigue abierta.
  - **`guardian-datos` sobre `64af718` y `17bbedf`: SEGURO DE APLICAR.** Envíos hostiles a `cuentaVentaId` (Bolívares, inactiva, inexistente, `1e0`, `0x1`, SQL, sin el campo): todos rechazados sin filas. El cuadre se mantiene. Hallazgos:
    - **Baja.** `page.tsx` cae en `enDolares[0]`, que incluye la prima, si no queda ninguna cuenta propia en dólares activa. Contradice el ADR 0006.
    - **Decisión de producto.** Una tasa menor que 1 (por ejemplo "0,4" en vez de "40") infla el valor en USD del gasto. La spec solo pide una tasa mayor que cero.
  - **Corregido:**
    - **1** (`1e73875`): `sobreTocado` vive en `Captura`, que sobrevive a las respuestas del servidor y solo se reinicia con "Registrar otro".
    - **2** (`241324d`): el vuelto es lo recibido menos lo gastado en esta venta, y el saldo de Bolívares se nombra aparte.
    - **3 y 4** (`88629a5`): `CampoMonto` recibe la unidad como nodo, y la captura elige Bs o dólares con `:has()`. Al pagar del saldo, el error de cuenta sale bajo la tasa. Sin JavaScript, la unidad en dólares (USDT, USDC o USD) es la de la cuenta inicial; con JavaScript, la de la elegida. Las monedas en dólares valen 1 a 1, así que no confunde montos.
    - **Prima** (`eb875f7`): sin `enDolares[0]`. Sin cuenta propia en dólares activa no se marca ninguna.
    - **Sin corregir:** el 5, que ya era conocido, y la tasa menor que 1, que es una decisión de producto para el desarrollador.
  - **Evidencia**, contra el build en :3124:
    - **Con Edge sin ventana, manejado por DevTools:**
      - sobre Familia a mano, Guardar sin categoría ("Elige una categoría"), elegir Comida: el sobre sigue en 3 y la fila 680 queda en Familia ("Familia queda en −7,00 USD");
      - Inversión con el aviso y cambiar a Salud: el sobre sigue en 6 y el botón dice "Sí, gastar de Inversión";
      - sin tocar el sobre, error y luego Familia: la sugerencia lleva el sobre a 3.
    - **Con los scripts de la página desactivados** (`Emulation.setScriptExecutionDisabled`), al cambiar la forma de pago:
      - la unidad pasa de USDT a Bs, Bs y otra vez USDT;
      - los grupos visibles son "Cuenta" en Dólares, "Salen de" en la venta y ninguno del saldo.
    - **Bolívares desactivada un momento en la base local:** del saldo, con y sin JavaScript, se ve "No hay una cuenta en bolívares activa". Reactivada después.
    - **Dos ventas seguidas sin JavaScript:** la segunda dice "Te quedan 2.736,00 Bs de vuelto; Bolívares queda en 5.472,00 Bs". Del saldo no hay vuelto.
    - `/cuentas` dice "Cuadra con los sobres".
    - Las filas 680 a 685 se borraron: 118 movimientos `demo-*` y 5 cuentas activas.
    - `comprobar-001 --url` en verde.
  - `pnpm verify`: `estructura: 0 errores, 12 avisos`, `Tests 196 passed (196)`, `✓ verify:full en verde en 20.5 s`. `formulario-gasto.tsx` tiene ahora 348 líneas y sigue siendo solo la captura.
- 2026-10-12 · `/f-review`, tercera vuelta.
  - **`revisor`: NO APTO.** Los hallazgos de la segunda vuelta quedaron corregidos y reproducidos. Hallazgos nuevos:
    1. **Media, datos, criterio 11.** "Hoy" se calcula una vez, al dibujar la página, y viaja como fecha concreta en el campo oculto. Una pantalla abierta antes de las 00:00 de Caracas y guardada después, o "Registrar otro" a la mañana siguiente, guarda la fecha de ayer con "Hoy" marcado. Reproducido con un servidor de reloj atrasado y luego otro con la hora real bajo la misma pestaña (filas 715 y 717, `fecha = 2026-10-11`). A fin de mes, el gasto cae en el mes anterior.
    2. **Baja, criterio 8.** Tocar el sobre que ya está marcado no cuenta como "tocado", porque un radio marcado no emite `change`. Luego, elegir Familia cambia el sobre.
    3. **Baja, documentos.** `docs/diseno.md` dice todavía "píldoras desplazables en horizontal". `spec.md` dice que `CampoMonto` "recibe `moneda`".
    4. **Pendiente de decidir, no son defectos:**
       - la tasa menor que 1;
       - "Registrar otro" tras un gasto desde la prima la deja marcada: el criterio 13 ("misma cuenta") choca con "la prima nunca se preselecciona";
       - la carrera de T15.
  - **Corregido:**
    - **1** (`d79662e`): `SelectorFecha` manda "hoy" o "ayer" si se eligió un atajo, y la acción los resuelve con `fechaDesdeAtajo` y el hoy de Caracas del momento de guardar. La prueba se escribió primero y se vio fallar ("fechaDesdeAtajo is not a function"). Sin JavaScript manda el campo nativo, que va antes con el mismo nombre. Criterio 11 de la spec al día. "Ayer" también se resuelve al guardar: elegido la víspera y guardado tras la medianoche, es el día anterior al de guardar, igual que "Hoy".
    - **2** (`63e1547`): `SelectorPildoras` recibe `alTocar`, que corre con cualquier clic en una opción, también la ya marcada.
    - **3** (`a654042`): `docs/diseno.md` (píldoras envueltas, `alTocar`, la unidad de `CampoMonto`) y `spec.md` (`CampoMonto` recibe `unidad`).
    - **Sin corregir, para el desarrollador:** los pendientes del punto 4.
  - **Evidencia**, contra el build:
    - **Cruce de la medianoche** con Edge manejado por DevTools: el servidor con el reloj atrasado 3 h (shim de `Date`) se cambia por uno con la hora real bajo la misma pestaña. En Caracas eran las 01:18 del 12.
      - **Pantalla abierta la víspera:** el campo oculto dice "hoy", con "Hoy" marcado. Guardada tras la medianoche, la fila 718 tiene `fecha = 2026-10-12`.
      - **Gasto de noche:** fila 719 con `2026-10-11`. Con "Registrar otro" a la mañana, la fila 720 tiene `2026-10-12`. El revisor obtenía `2026-10-11`.
      - **"Ayer" elegido la víspera:** la fila 721 tiene `2026-10-11`.
    - **Sin JavaScript** (scripts desactivados): los campos `fecha` llegan en el orden `date=2026-10-12` y luego `hidden=hoy`. Con el 5 de octubre elegido en el nativo, la fila 734 tiene `2026-10-05`: manda el nativo.
    - **Sobre ya marcado:** tocar "Gastos del mes" ya marcado y elegir Familia deja el sobre en 2. Sin tocarlo, Familia lo lleva a 3. Las pruebas del sobre de la segunda vuelta siguen igual (fila 722 en Familia, Inversión se mantiene).
    - `comprobar-001 --url` en verde y `/cuentas` dice "Cuadra con los sobres". Las filas de prueba se borraron: 118 movimientos `demo-*`.
  - `pnpm verify`: `estructura: 0 errores, 13 avisos`, `Tests 199 passed (199)`, `✓ verify:full en verde en 22.3 s`. El aviso nuevo es `src/components/formulario.tsx` con 321 líneas: siguen siendo solo las piezas de formulario.
- 2026-10-12 · `/f-review`, cuarta vuelta.
  - **`revisor`: NO APTO.** Los arreglos de la tercera vuelta se cumplen. Hallazgos nuevos:
    1. **Media, datos, criterio 11. Lo introdujo `d79662e`.** El campo oculto mandaba "hoy" o "ayer" siempre que la fecha coincidiera con el hoy o el ayer de la página, no solo cuando se tocó el atajo. Un día elegido en el calendario de una pantalla que cruza la medianoche se recalculaba al guardar. Reproducido: con el 10 elegido en el calendario, la fila 735 quedó con el 11.
    2. **Media-baja, sin JavaScript.** Con la fecha vacía en el campo nativo, la acción devuelve el error y, al volver a pintar, `etiquetaFecha("")` lanza: HTTP 500 y página en blanco. Viene del calendario (`8198791`).
    3. **Baja, sin JavaScript.** Las píldoras Hoy, Ayer y Otra fecha se ven debajo del campo nativo y no hacen nada; "Hoy" sigue marcada.
    4. **Pendientes de producto**: la tasa menor que 1, la prima en "Registrar otro" y la carrera de T15.
  - El revisor cerró Edge por nombre de imagen (`taskkill //IM msedge.exe //F`): si el desarrollador tenía Edge abierto, se cerró. Lo anotó en su memoria para cerrarlo solo por PID.
  - **Decisiones del desarrollador, 2026-10-12:**
    - una tasa menor que 1 se rechaza con un error junto al campo (spec, criterio 6);
    - "Registrar otro" repite la cuenta elegida a mano, también la de la prima. "Nunca se preselecciona" vale solo para los valores por defecto. Se aclara en la spec.
  - **Corregido:**
    - **Tasa** (`a5f8045`): la mínima es 1, con "Escribe la tasa en Bs por dólar, como 241,8". Criterio 6 de la spec al día. Las pruebas se escribieron primero y se vieron fallar (4 fallos).
      - Las dos pruebas de la venta de 0 Bs se ajustaron a la regla nueva, no se debilitaron: 0,01 a 0,4 sigue sin guardar nada, ahora por la tasa, y el límite que entrega 1 céntimo pasa de 0,5 a 1.
      - La guarda `recibidos <= 0` queda como defensa.
    - **1, 2 y 3** (`9ebfce1`): el valor de `SelectorFecha` es literalmente lo que se tocó: "hoy" (también por defecto), "ayer" o el día del calendario, que se guarda tal cual aunque coincida con hoy. Un valor que no es fecha ya no rompe la página: `esFecha`, con la prueba primero y vista fallar, deja vacío el campo nativo y "Otra fecha" sin marcar. Sin JavaScript, las píldoras se ocultan con `noscript:` (`@media (scripting: none)`, Tailwind 4.3).
      - Spec al día: el criterio 11, la fecha sin JavaScript y la aclaración de la prima. `docs/diseno.md` al día.
  - **Evidencia** contra el build. Primero corrí la simulación de la medianoche con 3 h de atraso, pero en Caracas eran ya las 12:02 y no cruzaba; esas filas (747 a 751) se borraron. La repetí con 13 h de atraso (el servidor cree que son las 23:02 del 11):
    - **A.** Pantalla abierta la víspera (campo oculto "hoy", "Hoy" marcado) y guardada tras la medianoche: fila 752 con `2026-10-12`.
    - **B.** Gasto de noche: fila 753 con `2026-10-11`. "Registrar otro" a la mañana: fila 754 con `2026-10-12`.
    - **D, la reproducción del revisor.** El día 10 elegido en el calendario la víspera: el campo oculto dice "2026-10-10" y la fila 755 tiene `2026-10-10`. El revisor obtenía el 11.
    - **E.** El día 11, el "hoy" de la pantalla vieja, elegido en el calendario: la fila 756 tiene `2026-10-11`.
    - **Sin JavaScript** (scripts desactivados):
      - las píldoras de fecha no se ven;
      - con la fecha nativa vacía, HTTP 200 y "Elige hoy o un día anterior", con el campo vacío;
      - con tasa 0,4 del saldo, HTTP 200 y "Escribe la tasa en Bs por dólar, como 241,8".
    - **POST directo** con `fecha` igual a "", "abc", "2026-02-30", "2099-01-01" y "<script>": todos HTTP 200 con el error junto a la fecha, y ninguna fila.
    - **Regresiones:**
      - las pruebas del sobre de la segunda y la tercera vuelta dan igual (fila 757 en Familia);
      - la venta sin JavaScript sale de Binance con "Te quedan 2.736,00 Bs de vuelto";
      - `comprobar-001 --url` en verde y `/cuentas` cuadra.
    - Filas de prueba borradas: 118 movimientos `demo-*` y 5 cuentas activas.
  - `pnpm verify`: `estructura: 0 errores, 13 avisos`, `Tests 205 passed (205)`, `✓ verify:full en verde en 22.1 s`.
- 2026-10-12 · `/f-review`, quinta vuelta.
  - **`revisor`: NO APTO.** Los arreglos de la cuarta vuelta, fecha y tasa, están bien. Hallazgos nuevos:
    1. **Media, criterios ★ 19 y 25.** "Restaurar la archivada", en crear y en editar, no restaura nada, con JavaScript o sin él. El botón lleva `name="restaurar"` con `formAction`, y React reemplaza ese `name` por su `$ACTION_ID`, así que el id nunca llega a la acción. Desde crear redirige a `/categorias` y la archivada sigue archivada; desde editar, toma el `id` de la categoría editada. La evidencia de T16-T19 era de curl, que mandaba `restaurar` a mano. Además, `restaurarCategoriaAccion` ignora `volver`: desde la píldora "Nueva" de la captura, restaurar no vuelve a `/nuevo/gasto`.
    2. **Baja-media, criterio 8 frente al 20.** `sobreSugerido` busca el nombre exacto. Al renombrar Familia o Regalos, la sugerencia pasa a Gastos del mes.
  - **Incidente del revisor:** su primer envío sin JavaScript a `/categorias/10` copió los `$ACTION` de los dos formularios de la página y archivó Familia. La reactivó con `update ... set activa = true where id = 10 and nombre = 'Familia'`. Comprobado: `10|Familia|gasto|familia|verde|t|10`, 15 categorías activas y Familia con sus 5 movimientos.
  - **Decisión del desarrollador, 2026-10-12:** la sugerencia de sobre compara nombres equivalentes y un renombre de verdad pierde la sugerencia. Queda escrito en el criterio 8. Ligar el sobre a la categoría queda para otra feature.
  - **Corregido:**
    - **1** (`8a2405a`): el id de la archivada viaja en un campo oculto `restaurar`, que React no toca, y el botón solo lleva `formAction`. `restaurarCategoriaAccion` respeta `volver`: desde la captura vuelve a `/nuevo/gasto?categoria=<id>`, como al crear.
    - **2** (`2e63f60`): `sobreSugerido` compara con `claveDeNombre`, la misma clave que `repetidaDe`, exportada de `categorias.ts` en vez de duplicarla. Las pruebas se escribieron primero; falló la de los equivalentes y la de la limitación ya pasaba.
  - **Evidencia** con Edge manejado por DevTools contra el build, con una archivada temporal (77, "Prueba restaurar") y otra activa (78, "Prueba editar"), borradas al final. Lo mismo con JavaScript y sin él:
    - **Crear desde la captura** (`/categorias/nueva?volver=/nuevo/gasto`) con "prueba RESTAURAR": se ofrece restaurar, con el campo oculto en 77. Al pulsar "Restaurar la archivada", termina en `/nuevo/gasto?categoria=77` con la 77 marcada, y la base dice `77|Prueba restaurar|t`.
    - **Editar la 78** con el nombre "Prueba restaurar": se ofrece y restaura la 77, termina en `/categorias?tipo=gasto` y la 78 queda como estaba.
    - Sin JavaScript, el botón lleva `name="$ACTION_ID_4073…"`, lo que confirma la causa que encontró el revisor. El id llega igual por el campo oculto.
    - `comprobar-001 --url` en verde y `/cuentas` cuadra. Quedan 118 movimientos `demo-*` y 15 categorías activas de 15.
  - `pnpm verify`: `estructura: 0 errores, 13 avisos`, `Tests 207 passed (207)`, `✓ verify:full en verde en 24.8 s`.
- 2026-10-12 · `/f-review`, sexta vuelta.
  - **`revisor`: NO APTO.** Los arreglos de la quinta vuelta funcionan al pulsar los botones. Hallazgos nuevos:
    1. **Media, datos, criterios ★ 19 y 20. Lo introdujo `8a2405a`.** "Restaurar la archivada" es el primer botón de envío del formulario, así que Enter (o "Ir" en el celular) lo dispara: restaura una categoría que no se eligió y descarta lo que se creaba o editaba. Pasa con JavaScript y sin él. Reproducido al crear ("Prueba enter" no se creó y la 81 se restauró) y al editar (se perdieron el nombre y el color de la 82).
    2. **Baja-media, criterio 23.** Enter en el buscador de iconos envía el formulario y crea la categoría con el icono por defecto, no con el buscado.
    3. **Baja, criterio 25 y la regla de la captura rápida. Decisión del desarrollador.** Pasar por "Nueva" borra lo escrito en la captura: monto, forma de pago, vendido y tasa. Al volver, la forma está en Dólares. Si se reescribe "2100" sin mirar, se guardan 2.100 USDT.
    4. Conocido, sin cambios: la carrera de T15 y `toFixed` en `semilla-demo.ts`.
  - **Decisión del desarrollador, 2026-10-12:** conservar lo escrito en la captura al pasar por "Nueva". Queda escrito en el criterio 25.
  - **Corregido:**
    - **1 y 2** (`97698c5`): restaurar es un formulario aparte, sin nada visible, y su botón se asocia con `form={id}`. Enter en el formulario principal siempre guarda. Enter en el buscador de iconos hace `preventDefault`, y sin JavaScript el buscador, que no filtra, se oculta con `noscript:`.
    - **3** (`17efddd`): `src/lib/borrador-captura.ts`, con las pruebas primero y vistas fallar (no existía el módulo):
      - el enlace "Nueva" lleva lo escrito en `?volver=`, sin precarga porque cambia con cada tecla;
      - crear y restaurar vuelven con ello y con `categoria`;
      - el sobre solo viaja si se eligió a mano;
      - la vuelta solo acepta la ruta de la captura, nunca `//otro.com`, `\otro.com`, `javascript:` ni otra ruta.
  - **Evidencia** con Edge manejado por DevTools y un Enter de teclado real (`Input.dispatchKeyEvent`). Las categorías temporales 85 a 89 se borraron:
    - **Crear**, con y sin JavaScript: se ofrece restaurar, el nombre cambia a "Prueba enter" y Enter crea "Prueba enter" (87 y 88). La archivada 85 sigue en `f`.
    - **Editar la 86**, con y sin JavaScript: tras la oferta, "Prueba editada" en coral y Enter guardan `86|Prueba editada|coral|t`. La 85 sigue en `f`.
    - **Enter en el buscador** con "café": la página sigue en `/categorias/nueva` y no se crea nada. Sin JavaScript, el buscador no se ve.
    - **Captura → "Nueva" → crear con Enter:** vuelve a `/nuevo/gasto?forma=vendiendo&monto=2100&tasa=241%2C8&vendido=20&cuenta=1&venta=1&sobre=3&fecha=ayer&nota=pan+y+caf%C3%A9&categoria=89`. Están monto 2100, "vendiendo", vendido 20, tasa 241,8, sobre 3, "ayer", la nota "pan y café", la categoría 89 y la unidad Bs. Al cambiar luego la categoría, Familia, elegida a mano, no se mueve.
    - **Captura → "Nueva" → restaurar la archivada:** vuelve con monto 35, "saldo", tasa 240 y la categoría 85, ya activa.
    - **Captura → "Nueva" → la flecha de volver:** vuelve con monto 12.
    - Base: 118 movimientos `demo-*` y 15 categorías activas de 15. `comprobar-001 --url` en verde y `/cuentas` cuadra.
  - `pnpm verify`: `estructura: 0 errores, 14 avisos` (el nuevo es el recordatorio del archivo de pruebas nuevo), `Tests 216 passed (216)`, `✓ verify:full en verde en 23.4 s`.
- 2026-10-12 · `/f-review`, séptima vuelta.
  - **`revisor`: NO APTO.** Los arreglos de Enter de la sexta vuelta funcionan. Hallazgos nuevos:
    1. **Media, datos, criterios 13 y 25. Lo introdujo `17efddd`.** El borrador se queda en la dirección de la captura y nunca se limpia, ni después de guardar. Al recargar (o al descartar el celular la pestaña) o con "Ir al inicio" y atrás, reaparece el gasto ya guardado, y un toque lo registra otra vez. Reproducido: las filas 821 y 822 duplican a la 819 y la 820.
    2. **Baja-media.** Con el monto precargado, el foco automático deja el cursor al principio: teclear "15" sobre "2100" da "152100".
    3. **Baja-media, decisión de producto.** El atrás del sistema desde `/categorias/nueva` pierde lo escrito; solo la flecha de la app lo conserva.
    4. Conocido: la carrera de T15 y los flotantes de `semilla-demo.ts`.
  - **Decisión del desarrollador, 2026-10-12:** el atrás del sistema también conserva lo escrito.
  - **Cambio de diseño:** el borrador deja de viajar en la dirección. Mientras esté ahí, recargar o volver atrás lo trae de nuevo. Pasa a ser un borrador de un solo uso en la pestaña (`sessionStorage`): se guarda al tocar "Nueva", se recupera y se borra al volver a montar la captura por cualquier camino, y caduca a los 30 minutos.
  - **Corregido** (`b63fba7`), los hallazgos 1 a 3:
    - **Borrador en la pestaña:**
      - "Nueva" vuelve a ser un enlace fijo y, al tocarlo, guarda el borrador en `sessionStorage` (`src/app/nuevo/gasto/borrador-pestana.ts`).
      - La captura lo lee con `useSyncExternalStore`, con lectura en caché que vuelve a mirar la vigencia en cada lectura. En el servidor y al hidratar no hay borrador; en el cliente, la captura se monta de nuevo con él.
      - Se olvida al guardar el gasto y caduca a los 30 minutos.
      - El lint de React descartó dos caminos más cortos: `setState` dentro de un efecto (`set-state-in-effect`) y `Date.now()` en el render (`purity`).
    - **Monto recuperado:** se selecciona al recibir el foco, así que teclear lo reemplaza.
    - **Pruebas:** se escribieron primero y se vieron fallar ("borradorATexto is not a function"). Las de `direccionConBorrador` y `borradorDesdeParametros` se sustituyeron por las equivalentes del borrador en texto (ida y vuelta, campos ajenos, largos y caducidad, también con un reloj que retrocede). Siguen las de la vuelta segura.
    - Criterio 25 de la spec al día.
  - **Evidencia** con Edge manejado por DevTools contra el build, con teclas reales:
    - **A, la reproducción del revisor:**
      - escribir 2100, "vendiendo", 20, 241,8 y una nota; "Nueva"; "Prueba borrador" y Enter. Vuelve a `/nuevo/gasto?categoria=97` con todo lo escrito y el monto seleccionado (0-4);
      - "Guardar gasto" crea las filas 834 y 835;
      - "Registrar otro" deja el monto vacío y sin borrador;
      - recargar deja el monto vacío y la forma en Dólares, sin borrador, con solo la categoría de la dirección, como antes de `17efddd`;
      - inicio y atrás: lo mismo. **Siguen siendo dos filas.**
    - **B, el atrás del sistema:** "Nueva" y `history.back()` recuperan 2100, "vendiendo", 20, 241,8 y la nota.
      - Teclear "15" sobre el monto da `15`.
      - Recargar antes de guardar recupera el borrador. Es lo escrito al tocar "Nueva", no lo tecleado después.
      - Guardar crea las filas 838 y 839, y recargar después deja la captura vacía, sin borrador.
    - **Regresiones:**
      - pruebas del sobre: Familia a mano tras el error, Inversión con el aviso, el sobre ya marcado y la sugerencia;
      - la venta sin JavaScript;
      - `comprobar-001 --url` en verde y `/cuentas` cuadra.
    - Filas de prueba borradas: 118 movimientos `demo-*` y 15 categorías activas de 15.
  - `pnpm verify`: `estructura: 0 errores, 14 avisos`, `Tests 215 passed (215)`, `✓ verify:full en verde en 46.8 s`.
- 2026-10-12 · `/f-review`, octava vuelta.
  - **`revisor`: NO APTO.** `pnpm verify` y los ★ en verde. Los dos defectos de datos vienen de `b63fba7`, el borrador en `sessionStorage`:
    1. **Media-alta, datos, criterios 11, 12 y 25 y la regla de la prima.** El borrador se aplica a toda captura que se monte, no solo al volver de "Nueva", y solo se borra al guardar. Un intento abandonado reaparece por el mosaico "Gasto", el "+" o "Registrar movimiento" durante 30 minutos. Reproducido: quería 5 USD hoy y se guardaron una venta de 20 USDT y un gasto de 500 Bs con fecha de ayer (filas 854 y 855). Con la prima elegida antes de "Nueva", una captura nueva la abre marcada.
    2. **Media, datos, criterio 13.** El `key` de la captura depende del borrador. Si caduca entre volver y guardar, el redibujo que trae `revalidatePath` monta la captura de nuevo: el gasto se guarda (fila 856), pero en vez de la confirmación aparece el formulario vacío, y el gasto queda a un toque de repetirse.
    3. **Sin bloqueo.** Recargar antes de guardar recupera lo escrito al tocar "Nueva", no lo corregido después.
  - Es la tercera vuelta seguida (6, 7 y 8) en que lo añadido para conservar lo escrito trae un defecto de datos nuevo. Se consulta al desarrollador el alcance antes de seguir.
  - **Decisión del desarrollador, 2026-10-12:** conservar lo escrito al pasar por "Nueva" sale de esta feature. Queda como limitación en el criterio 25 y como observación 9 en `docs/observaciones.md`, con la salida de raíz: crear la categoría en una ventana dentro de la captura.
  - **Hecho** (`13f1354`):
    - `git revert` de `17efddd` y `b63fba7`; el revert se aplicó sin conflictos.
    - Se conservan los demás arreglos de la revisión: restaurar vuelve a la captura con la categoría (`8a2405a`), Enter guarda (`97698c5`) y el monto se selecciona al recibir el foco, útil también tras un error.
    - Las pruebas vuelven a ser 207: se fueron las del borrador, que ya no existe.
  - **Evidencia** con Edge manejado por DevTools contra el build:
    - **La reproducción de la octava vuelta.** Escribir 2100, "vendiendo", 20, 241,8, la Cuenta prima y "Ayer"; tocar "Nueva"; abandonar; entrar por el mosaico "Gasto" del inicio. La captura abre vacía, en Dólares, con Binance (no la prima), "hoy" y nada en la pestaña.
    - **"Nueva" y crear con Enter:** vuelve a `/nuevo/gasto?categoria=103` con la categoría marcada y lo demás vacío, que es la limitación aceptada. Al recargar, igual.
    - **Monto "0" y Guardar:** sale "Escribe un monto mayor que cero", el foco va al monto con "0" seleccionado (0-1) y teclear "15" da `15`.
    - **Regresiones:**
      - restaurar desde la captura, con y sin JavaScript, vuelve a `/nuevo/gasto?categoria=105`, y desde editar no toca la categoría editada;
      - Enter tras la oferta de restaurar, al crear y al editar y con y sin JavaScript, guarda y no restaura;
      - Enter en el buscador no envía nada;
      - la venta sin JavaScript;
      - `comprobar-001 --url` en verde y `/cuentas` cuadra.
    - Base: 118 movimientos `demo-*` y 15 categorías activas de 15, sin filas ni categorías de prueba.
  - `pnpm verify`: `estructura: 0 errores, 13 avisos`, `Tests 207 passed (207)`, `✓ verify:full en verde en 22.1 s`.
