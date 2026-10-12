# 001 · Captura rápida de gasto

Fecha: 2026-10-11. Estado: aprobada, también la ampliación del 2026-10-11 (categorías con icono y color, al final).

## Para qué

Anotar un gasto desde el celular en menos de diez segundos, con menos pasos que en Gestor de Gastos. Si esto es lento, la app se abandona en dos semanas; por eso es la primera feature. Cubre los tres casos reales: pagar en dólares desde una cuenta, pagar en bolívares vendiendo USDT en el momento, y pagar en bolívares del saldo que ya se tenía.

## Trazabilidad al plan

- Sección 4, "El riesgo número uno del proyecto": la captura rápida es la función más importante de la fase 1.
- Sección 4, "Gasto en bolívares, el único caso especial": cuánto USDT se vendió, a qué tasa, para qué categoría; la app crea la transferencia a bolívares y el gasto; la tasa es un campo del movimiento.
- Sección 4, "Sobres y reparto": el sobre de inversión avisa si se intenta gastar desde él.
- Sección 6, fase 1: "Flujo de gasto en bolívares" y "formulario de captura rápida". La parte PWA de esa misma línea queda para la feature 002.

## Criterios de aceptación

Los montos se escriben como los teclea el usuario, sin separador de miles ("42", "2100", "19.99", "19,99"), y se guardan en centavos enteros. Un punto o una coma sola es el decimal. La tasa es bolívares por dólar.

1. ★ **Gasto en dólares.** Dado que escribo monto `42`, pago "Dólares" desde la cuenta Binance, categoría Comida, sobre Gastos del mes y fecha de hoy, cuando guardo, entonces existe un movimiento de tipo `gasto` con `monto_centavos = 4200`, `moneda = USDT`, `monto_usd_centavos = 4200`, cuenta origen Binance, sobre origen Gastos del mes, categoría Comida, `origen = manual`, sin `tasa`. La suma de sobres sigue siendo igual a la suma en USD de las cuentas (criterio 16).
2. ★ **Gasto en bolívares vendiendo USDT.** Dado que indico que vendí `20` USDT a tasa `241,8` y gasté `2100` Bs en Comida, cuando guardo, entonces se crean en una sola transacción dos movimientos con la misma fecha: una `transferencia` de Binance a Bolívares con `monto_centavos = 2000` (USDT), `monto_usd_centavos = 2000`, `monto_destino_centavos = 483600` (Bs), `moneda_destino = VES`, `tasa = 241.8000`; y un `gasto` desde Bolívares con `monto_centavos = 210000` (Bs), `moneda = VES`, `monto_usd_centavos = 868` (2100 ÷ 241,8 = 8,6849, redondeado al centavo), `tasa = 241.8000`, sobre Gastos del mes, categoría Comida. El saldo en bolívares de la cuenta Bolívares queda en `273600` centavos de Bs: el vuelto.
3. ★ **Gasto en bolívares del saldo.** Dado que ya tengo bolívares y gasto `500` Bs a tasa `241,8` en Transporte sin vender USDT, cuando guardo, entonces existe un solo movimiento `gasto` desde Bolívares con `monto_centavos = 50000`, `moneda = VES`, `monto_usd_centavos = 207` (500 ÷ 241,8 = 2,0678), `tasa = 241.8000`.
4. ★ **Si los bolívares gastados superan los recibidos**, dado que vendí `10` USDT a `240` (2.400 Bs) y escribo que gasté `2500` Bs, cuando guardo, entonces el gasto se registra completo (`250000` centavos de Bs, `1042` centavos USD) y la cuenta Bolívares queda con saldo negativo de `10000` centavos de Bs; la pantalla lo avisa pero no lo impide, porque el saldo previo en bolívares puede cubrirlo.
5. ★ **Montos inválidos.** Dado que el monto está vacío, es `0`, es negativo o es texto, cuando guardo, entonces no se crea ningún movimiento y veo el mensaje de error junto al campo. `1234.56`, `1234,56` y `1.234,56` se aceptan y valen lo mismo. `2.100` vale 2,10: sin coma, el punto es decimal.
6. ★ **Tasa.** Dado que el pago es en bolívares, cuando la tasa está vacía, es `0`, es negativa o es menor que `1` (como `0,4` tecleado en vez de `40`, que inflaría el valor en USD; decidido por el desarrollador el 2026-10-12), entonces no se guarda nada y veo el error. La tasa se escribe como los montos (coma o punto decimal, sin separador de miles) y se guarda con cuatro decimales. Si el pago es en dólares, la tasa no se pide ni se guarda.
7. ★ **La aritmética de conversión es exacta en centavos.** Dado un monto en USD y una tasa, Bs = redondeo(centavos USD × tasa); dado un monto en Bs y una tasa, USD = redondeo(centavos Bs ÷ tasa). Nunca hay flotantes en el resultado y 0 Bs son 0 USD. Al preparar un gasto en Bs, si su valor en USD redondea a 0 (`1` Bs a `241,8`), se guarda `monto_usd_centavos = 1`: la base exige un valor positivo y así cabe el repele de un cambio.
8. **Sobre sugerido.** Dado que elijo una categoría, cuando no he tocado el sobre, entonces el sobre se preselecciona así: Familia → Familia; Regalos → Ocasiones; cualquier otra → Gastos del mes. Siempre puedo cambiarlo.
9. **Inversión es intocable.** Dado que elijo el sobre Inversión, cuando guardo, entonces la app me pide confirmar con un segundo clic en un aviso visible ("Inversión es intocable. ¿Gastar igual?") antes de registrar.
10. **Sobre en negativo.** Dado que el gasto deja el sobre por debajo de cero, cuando guardo, entonces se registra igual y la confirmación lo dice ("Gastos del mes queda en −12,00 USD; reasigna desde otro sobre").
11. **Fecha.** Por defecto hoy según la hora de Caracas (`America/Caracas`), no la del servidor, con atajo "Ayer" y un selector de fecha. No se aceptan fechas posteriores a ese hoy. Si se tocó "Hoy" o "Ayer" (o se dejó "Hoy", el valor por defecto), se resuelve al guardar, no al abrir la pantalla: una pantalla abierta antes de la medianoche, o "Registrar otro" a la mañana siguiente, guarda el hoy o el ayer del momento de guardar. Un día elegido en el calendario se guarda tal cual, aunque coincida con hoy.
12. **Velocidad.** Dado que abro la pantalla en el celular, entonces el campo de monto tiene el foco y el teclado numérico abierto; la forma de pago empieza siempre en "Dólares"; las categorías son píldoras envueltas en varias filas, sin desplazamiento lateral, ordenadas por uso en los últimos 90 días; la cuenta es la última cuenta propia en dólares usada en un gasto (Binance si no hay historial); el sobre viene sugerido; hay un solo botón "Guardar gasto". Nada obligatorio además de monto y categoría. Objetivo: tres toques y un número para un gasto normal en dólares.
13. **Después de guardar.** Veo una confirmación con lo registrado ("42,00 USD en Comida desde Binance") y dos acciones: "Registrar otro" (mismo pago, misma cuenta, categoría despejada) e "Ir al inicio". Los saldos de inicio, sobres y cuentas reflejan el gasto al volver.
14. **Sin JavaScript** el formulario sigue guardando: es un formulario HTML con server action; el foco automático, el teclado numérico y la sugerencia de sobre son mejoras.
15. **Accesos.** El botón "+" de la barra inferior, el botón "Registrar movimiento" de la barra lateral y el mosaico "Gasto" del inicio abren directamente esta pantalla. Los mosaicos "Ingreso" y "Mover" siguen yendo al selector actual.
16. ★ **Cuenta de la prima.** Dado que pago "Dólares" desde la Cuenta prima, cuando guardo, entonces el gasto se registra como desde cualquier otra cuenta y `/cuentas` sigue mostrando "Cuadra con los sobres": el saldo de la prima entra en el total y en el cuadre. La cuenta conserva su marca "A nombre de mi prima" en el selector, en inicio y en cuentas.

## Pantallas

**Ruta** `/nuevo/gasto`. El selector `/nuevo` se mantiene para Ingreso y Mover.

**Móvil**, una columna dentro del panel:

1. Cabecera: título "Nuevo gasto" y una fila de tres píldoras Gasto · Ingreso · Mover (la activa con el tono `palida` de `Pildora`); las otras dos enlazan al selector.
2. `Tarjeta` del formulario, en este orden:
   - **CampoMonto** (pieza nueva): la cifra a 36 px en negrita con el código de moneda a la derecha, fondo `tarjeta-hover`, `inputMode="decimal"`, foco automático. La moneda que muestra cambia con la forma de pago: USD, USDT o USDC según la cuenta, o Bs.
   - **Forma de pago**: `SelectorPildoras` (pieza nueva) con tres opciones: "Dólares", "Bolívares vendiendo USDT", "Bolívares del saldo". Debajo, según la opción: para la primera, la cuenta de origen (`SelectorPildoras` con todas las cuentas en dólares; la de la prima lleva el detalle "a nombre de mi prima"); para la segunda, dos `Entrada` en una fila, el monto vendido y "Tasa Bs/USD", más la cuenta de donde salen (Binance por defecto, cualquier cuenta en dólares; es un grupo aparte del de la primera opción, para que no herede la cuenta del último gasto); la etiqueta del monto vendido sigue la moneda de esa cuenta ("USDT vendidos", "USD vendidos"); para la tercera, solo "Tasa Bs/USD".
   - **Categoría**: `SelectorPildoras` envuelto en varias filas (el desarrollador pidió quitar el desplazamiento lateral el 2026-10-12), cada píldora con el `CirculoCategoria` de su icono y color y el nombre, ordenadas por uso, y al final "Nueva".
   - **Sobre**: `SelectorPildoras` con los sobres excepto "Por asignar"; el sugerido queda marcado. Inversión muestra la marca "intocable".
   - Todas las filas de píldoras de la captura (forma de pago, cuenta, categoría y sobre) se envuelven en varias filas también en el celular, sin desplazamiento lateral, a pedido del desarrollador (2026-10-12).
   - **Fecha**: `SelectorFecha` (pieza nueva): píldoras "Hoy" y "Ayer" (hora de Caracas) y "Otra fecha", que abre un calendario propio en una ventana modal pequeña, con los días futuros apagados. Sin JavaScript, solo un campo de fecha nativo: las píldoras no se ven, porque sin JavaScript no hacen nada. El selector del navegador no se puede estilizar; el desarrollador lo pidió así el 2026-10-11.
   - **Nota**: `Entrada` opcional, una línea.
   - `Boton` primario ancho completo "Guardar gasto". Si el sobre es Inversión, el primer clic muestra el aviso y cambia el texto a "Sí, gastar de Inversión".
3. Estado de éxito en la misma `Tarjeta`: resumen con `Cifra`, `Pildora` de la categoría y la cuenta, la cuenta de donde salieron los dólares si se vendieron ("2.100,00 Bs en Comida desde Bolívares, con 20,00 USDT vendidos de Binance"), aviso de sobre negativo, de Bolívares en negativo o de vuelto en bolívares si aplica, y los botones "Registrar otro" (primario) e "Ir al inicio" (secundario).

**Escritorio**, rejilla de doce columnas: el formulario en siete columnas y, en cinco, una `TarjetaPalida` "Antes y después" con el sobre elegido (saldo actual y saldo tras el gasto, `Progreso` si tiene tope) y la cuenta de origen (saldo actual y tras el gasto; en el caso de bolívares, los Bs que quedarán). Se actualiza al cambiar monto, cuenta o sobre, con JavaScript; sin él, muestra los saldos actuales.

**Cuentas**, `/cuentas`: el total "Patrimonio en cuentas" y la píldora "Cuadra con los sobres" suman todas las cuentas activas, también la de la prima (criterio 16). Nada más cambia en esa pantalla.

**Piezas nuevas**, en `src/components/formulario.tsx`:

- `CampoMonto`: entrada numérica grande con unidad a la derecha; recibe `unidad` (un nodo, para que la captura la cambie con la forma de pago también sin JavaScript), `name`, `defaultValue`, `autoFocus`.
- `SelectorPildoras`: grupo de radios accesible renderizado como píldoras desplazables; recibe `name`, `opciones` (valor, texto, detalle opcional, avatar opcional), `valorInicial`; sin JavaScript funciona como radios nativos. La elegida usa `bg-palido text-palido-texto`.

En `src/components/calendario.tsx`:

- `SelectorFecha`: recibe `name`, `valor`, `hoy`, `onCambio` y `error`; envía la fecha en un campo oculto.

**Pieza modificada**, en `src/components/ui.tsx`: `Pildora` gana el tono `palida` (`bg-palido text-palido-texto`), el mismo de la opción elegida en `SelectorPildoras`, para la píldora activa de la cabecera.

## Datos

Sin cambios de esquema ni migración. Todo cabe en `movimientos` con el `check` de forma por tipo:

- Dólares: un `gasto` con `cuenta_origen_id`, `sobre_origen_id`, `categoria_id`.
- Bolívares vendiendo USDT: una `transferencia` (cuenta en dólares → Bolívares, `monto_destino_centavos` y `moneda_destino = VES`, `tasa`) y un `gasto` desde Bolívares en `VES` con `tasa`. Las dos filas se insertan en una transacción de base de datos.
- Bolívares del saldo: un `gasto` desde Bolívares en `VES` con `tasa`.

Consultas nuevas en `src/db/consultas.ts`: categorías de gasto ordenadas por uso en 90 días, cuentas activas con su marca `es_propia`, sobres aptos para gasto, última cuenta propia en dólares usada en un gasto. Operación nueva en `src/db/movimientos.ts`: `registrarMovimientos(filas)` dentro de una transacción. Las semillas y los datos de demostración no cambian.

## Fuera de alcance

- Registrar ingresos y mover dinero entre cuentas o sobres (features siguientes).
- Editar o borrar un gasto ya guardado.
- Crear cuentas desde el formulario. Las categorías entran en la ampliación del final.
- Instalación como PWA, atajos de pantalla de inicio y uso sin conexión (feature 002).
- Captura por Telegram y cualquier interpretación con IA (fase 2).
- Tasa sugerida automáticamente: la escribe el usuario cada vez.
- Separador de miles en montos y tasa.

## Pruebas antes del código

Funciones puras en `src/lib/`, cada una con `.test.ts` que se ve fallar antes de implementar:

- `src/lib/dinero.ts`: `aTasa(texto)` → tasa en diezmilésimas como entero (`"241,8"` → `2418000`), con las mismas reglas de escritura que `aCentavos`, rechaza vacío, cero y negativo; `bolivaresDesdeUsd(usdCentavos, tasaDm)` y `usdDesdeBolivares(bsCentavos, tasaDm)` con redondeo al centavo y aritmética entera; `formatearTasa(tasaDm)` para mostrarla.
- `src/lib/gastos.ts`: `prepararGasto(entrada)` devuelve las filas a insertar para los tres casos (criterios 1, 2, 3 y 4 con sus números exactos, y el mínimo de 1 centavo del criterio 7) o un error con mensaje para los criterios 5 y 6; `sobreSugerido(nombreCategoria, sobres)` para el criterio 8.
- `src/lib/fechas.ts`: `hoyEnCaracas(instante)` → `"AAAA-MM-DD"` en `America/Caracas` (las 01:00 UTC todavía son el día anterior en Caracas) y `fechaValida(texto, hoy)` para el criterio 11.

Lo demás se prueba después de mirar, en `/f-verify`.

## Riesgos y decisiones

- **Tasa como entero en diezmilésimas** en memoria (la base ya la guarda como `numeric(14,4)`): evita flotantes en la conversión y cumple la regla de centavos. Se registra en el ADR si durante la construcción se confirma.
- **Los bolívares siempre pertenecen al sobre de gastos del mes** por regla del plan; en el flujo en bolívares el sobre de la venta no se toca (es una transferencia) y el gasto sale del sobre elegido. Si el usuario elige otro sobre para un gasto en Bs, se respeta: la regla del plan es un valor por defecto, no un candado.
- **La cuenta de la prima cuenta en el cuadre** (decidido con el desarrollador, 2026-10-11). A veces se gasta desde ella o se cambia a bolívares desde ella, y la app no puede impedirlo. El dinero que la app registra ahí es del desarrollador; `es_propia = false` queda como marca legal ("A nombre de mi prima") y para las reglas del plan (saldo bajo, nunca invertir desde ella), no como exclusión. La invariante pasa a ser "la suma de los sobres es igual a la suma en USD de todas las cuentas activas". Cambia la redacción del plan (sección 4) y de `CLAUDE.md`, y se registra en un ADR nuevo que matiza el 0002.
- **Forma de pago y cuenta por defecto**: la forma de pago empieza siempre en "Dólares"; la cuenta es la del último gasto manual desde una cuenta propia en dólares, o Binance sin historial. La de la prima nunca se preselecciona por defecto, para no cargarle un gasto por descuido. "Registrar otro" sí repite la cuenta elegida a mano en el gasto anterior, también la de la prima: no es un valor por defecto sino la elección del usuario (decidido por el desarrollador el 2026-10-12). No se guarda preferencia aparte.
- **Sin separador de miles**: el desarrollador escribe "2100", no "2.100". Un punto o una coma sola es el decimal, así que "2.100" vale 2,10; la confirmación muestra la cifra formateada y deja ver un error así.
- **Fecha en hora de Caracas**: "hoy" se calcula en `America/Caracas` y no en la zona del servidor, para que al desplegar en UTC un gasto de las 21:00 no quede con la fecha de mañana.
- **Diferencia cambiaria aceptada**: gastar bolívares del saldo a una tasa distinta de la de compra puede dejar la cuenta Bolívares en 0 Bs con unos centavos de USD. El plan descarta la pérdida cambiaria; no se corrige.
- **Riesgo de velocidad**: el selector de forma de pago añade un toque en el caso de bolívares. Se acepta porque el caso en dólares sigue en tres toques; se mide en `/f-build` con el cronómetro en la mano.
- **Sin autenticación todavía**: la server action es pública como todo lo demás. Se trata en `/f-audit` al cerrar la fase 1 y antes de desplegar.

---

## Ampliación · Categorías con icono y color

Pedida por el desarrollador el 2026-10-11, antes de verificar la 001, para que la captura y las categorías se cierren juntas. Trazabilidad: observación 8 en `docs/observaciones.md` y plan, fase 1: "Cuentas, categorías, movimientos". Referencias visuales: `docs/referencias/categorias-gestor-lista.jpg` (la rejilla de categorías creadas) y `docs/referencias/categorias-gestor-crear.jpg` (el formulario para crear una). Se toma de ahí la idea, no los colores: la app conserva su paleta y su tipografía.

**Iconos, nunca emojis**: iconos de línea de `lucide-react`, el mismo juego de la barra de navegación.

### Criterios de aceptación

17. **Lista de categorías.** Dado que abro `/categorias`, veo dos pestañas, Gastos e Ingresos. Cada categoría activa es un círculo de su color con su icono en blanco y el nombre debajo, en una rejilla de 4 columnas en el celular y de 8 en escritorio, ordenada por uso. Al final hay un círculo "Crear". Tocar una categoría abre su edición.
18. ★ **Crear.** Dado que escribo "Mascotas", elijo Gasto, el icono `huella` y el color `lavanda`, cuando guardo, entonces existe una categoría de tipo `gasto`, activa, con `icono = huella` y `color = lavanda`. Aparece en la lista y en las píldoras de la captura de gasto.
19. ★ **Validación.** El nombre vacío o de más de 40 caracteres, o un icono o un color fuera del catálogo, no se guardan: el error sale junto al campo. Un nombre repetido dentro del mismo tipo, sin distinguir mayúsculas, acentos ni espacios de más, da "Ya existe una categoría con ese nombre". Si la repetida está archivada, se ofrece restaurarla.
20. ★ **Editar.** Puedo cambiar el nombre, el icono y el color. Los movimientos existentes siguen en la misma categoría (es la misma fila) y muestran el nombre nuevo. El tipo solo se puede cambiar si la categoría no tiene movimientos: un gasto nunca queda con una categoría de ingreso.
21. ★ **Eliminar.** Una categoría sin movimientos se borra. Una con movimientos se archiva: desaparece de la lista y de la captura, y sus movimientos la conservan. Antes de confirmar, la pantalla dice cuál de las dos pasará, por ejemplo "Tiene 13 movimientos: se archivará, no se borra".
22. **Archivadas.** Al final de la lista, "Archivadas (n)" las muestra apagadas, cada una con "Restaurar".
23. **Catálogo de iconos.** Unos 100 iconos agrupados en un catálogo propio (comida, transporte, hogar, salud, ocio, familia, mascotas, trabajo, dinero, viajes, tecnología, ropa, educación…), cada uno con palabras en español para buscarlo: "carro" encuentra el auto y "café", la taza. Con JavaScript, un buscador filtra; sin él, se ven todos.
24. **Paleta.** Doce colores propios de la app, como tokens de `globals.css`. Cada uno da 3:1 o más de contraste con el icono blanco, en claro y en oscuro. Mientras eliges, una vista previa muestra el círculo con el icono, el color y el nombre.
25. **En la captura de gasto.** Cada píldora de categoría lleva su círculo de color con el icono, en lugar de las iniciales. Al final de la fila, una píldora "Nueva" abre el formulario de crear. Al guardar, vuelve a la captura con la categoría nueva ya elegida.
26. **Semillas.** Las 15 categorías base reciben icono y color propios. `pnpm db:seed` también se los pone en una base que ya existe, pero solo a las que siguen con el valor por defecto: nunca pisa lo que el usuario cambió.
27. **Accesos.** "Categorías" en la barra lateral de escritorio y en el menú del celular, además de "Nueva" en la captura.

### Pantallas

- **`/categorias`**, móvil: título "Categorías" y una fila con las pestañas Gastos e Ingresos (como la cabecera de la captura). Debajo, una `Tarjeta` con la rejilla de `CirculoCategoria` grandes (56 px) y su nombre, y el círculo "Crear" en `tarjeta-hover` con un `+`. Debajo, "Archivadas (n)". En escritorio, la misma tarjeta a lo ancho con 8 columnas.
- **`/categorias/nueva`** y **`/categorias/[id]`**: una `Tarjeta` con:
  - arriba, la vista previa: el círculo grande y el nombre;
  - el nombre (`Entrada`) y el tipo (`SelectorPildoras`, Gasto o Ingreso);
  - el icono (`SelectorIcono`), con el buscador arriba;
  - el color (`SelectorColor`);
  - `Boton` "Guardar" a lo ancho.

  En edición, además, "Eliminar" o "Archivar" (`peligro`) con la confirmación del criterio 21. En escritorio, el formulario en 7 columnas y la vista previa en 5.

- **Piezas nuevas:**
  - `CirculoCategoria`, en `ui.tsx`: círculo del color con el icono blanco, en tamaños `sm` (24 px, para las píldoras), `md` y `lg` (56 px).
  - `SelectorIcono` y `SelectorColor`, en `formulario.tsx`: radios nativos con forma de círculo; el elegido, con anillo.
  - El registro de iconos, en `src/components/iconos-categoria.tsx`: nombre → componente de lucide. Solo se importan los del catálogo, para no cargar los más de mil iconos.

### Datos

Migración con `pnpm db:generate`: dos columnas en `categorias`.

- `icono text not null default 'etiqueta'`
- `color text not null default 'pizarra'`

Se guarda el **nombre** del icono y el **nombre** del color, nunca un hexadecimal: así el color sigue los temas claro y oscuro y la paleta puede ajustarse sin tocar datos. La aplicación valida contra el catálogo; la base no lleva enum, para no migrar cada vez que se añada un icono. Las filas existentes reciben los valores por defecto y la semilla asigna los propios.

Consultas: categorías por tipo con su número de movimientos, categoría por id y archivadas. Operaciones: crear, actualizar, borrar o archivar según tenga movimientos, y restaurar. El invariante no cambia: las categorías no tocan saldos.

### Fuera de alcance

- "Gasto programado" de la referencia: llega con los pagos programados, en la fase 2.
- Un color fuera de la paleta (el "+" de la referencia): la regla dura de tokens lo impide.
- Subcategorías y reordenar las categorías a mano.
- Mostrar los iconos en la lista de movimientos y en las gráficas: es el paso siguiente.
- Importar las categorías de Gestor de Gastos: lo hará el importador.

### Pruebas antes del código

`src/lib/categorias.ts`, con su `.test.ts`, que se ve fallar antes:

- el catálogo de iconos (nombre y palabras) y de colores;
- `validarCategoria(entrada, existentes)`, para los criterios 19 y 20: nombre normalizado, largo, catálogo, repetidas y cambio de tipo;
- `buscarIconos(texto)`, sin distinguir acentos ni mayúsculas;
- `destinoAlEliminar(movimientos)`, que decide entre `borrar` y `archivar` (criterio 21).

### Riesgos y decisiones

- **Nombre de token, no hexadecimal**, en la base: se registra como ADR en la tarea de documentos.
- **Archivar en vez de borrar** cuando hay movimientos: el historial nunca pierde su categoría, que es un dato del usuario.
- **Catálogo curado y no los más de mil iconos de lucide**: importarlos todos pesaría cientos de KB en la captura, la pantalla que más importa que sea rápida.
- **Contraste**: el icono blanco necesita 3:1 sobre cada color. Se valida con un script antes de fijar la paleta, y si un color no llega, se oscurece.
