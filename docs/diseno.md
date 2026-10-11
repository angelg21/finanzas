# Diseño visual

Fecha: 7 de octubre de 2026. Dos referencias elegidas por el usuario: `docs/referencias/ui-referencia.png` para la estructura y `docs/referencias/ui-referencia-2-colores.webp` para los colores. Toda pantalla nueva se compara contra esa imagen antes de darse por terminada. Los tokens viven en `src/app/globals.css`; las piezas base en `src/components/ui.tsx`.

## Qué hay en la imagen y cómo se traduce

| En la referencia                                                                                                                      | En la app                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Fondo de la composición: degradado azul de cielo pálido a azul intenso                                                                | **Lienzo**. Capa fija detrás de todo. En escritorio se ve alrededor del panel; en móvil queda detrás                    |
| Pantalla del teléfono: azul marino profundo                                                                                           | **Panel**. En móvil ocupa toda la pantalla; en escritorio flota con radio 28, borde y sombra                            |
| Barra superior: menú, "Nexora", campana y círculo                                                                                     | Barra superior móvil: menú, "finanzas", botón de tema y círculo con la inicial                                          |
| Tarjeta "Your Total Portfolio Value" con degradado azul, cifra grande, decimales en azul pálido, dos píldoras                         | **Hero**: "Disponible para gastar", cifra con los centavos en azul pálido, píldoras de gastado del mes y días restantes |
| Fila Invest / Add Fund / Withdraw: cuadros oscuros con icono en círculo de contorno                                                   | **Mosaico** dentro del hero: Gasto, Ingreso, Mover                                                                      |
| "Top Holdings": avatar cuadrado azul pálido con iniciales, nombre en mayúsculas, ticker debajo, monto y porcentaje verde a la derecha | **FilaLista** en la tarjeta Sobres y en Cuentas                                                                         |
| Gráfica de barras en dos tonos, eje de valores a la derecha                                                                           | **GraficaMensual**: gastado en azul pálido, ahorrado en azul, eje a la derecha                                          |
| Barra inferior con cinco accesos                                                                                                      | **NavInferior**: Inicio, Movimientos, Registrar, Sobres, Cuentas                                                        |
| Tarjeta azul pálido con anillo segmentado y total en el centro                                                                        | **TarjetaPalida** + **GraficaDona**: distribución de los sobres                                                         |
| Tarjetas azul pálido "Invested" y "Withdraw" con píldoras azul marino, título y datos                                                 | **TarjetaMovimiento**: cada movimiento como tarjeta pálida                                                              |

## Dos disposiciones

Es una aplicación web progresiva: en el celular se ve como las pantallas de la imagen; en escritorio se aprovecha el ancho con una disposición propia.

**Móvil (menos de 1024 px)**

- Panel a pantalla completa, sin radio.
- Barra superior de una línea. Títulos de página grandes debajo.
- Todo en una columna de ancho completo con 16 px de relleno lateral y 16 px entre tarjetas.
- Barra inferior fija con cinco accesos; 112 px de espacio al final para que no tape nada.
- El anillo de distribución vive en Sobres; las tarjetas de movimiento en Movimientos.

**Escritorio (1024 px o más)**

- Lienzo visible con 20 px de margen; panel flotante de hasta 1480 px con radio 28.
- Barra lateral de 248 px dentro del panel: marca, navegación con la activa en azul pálido, botón "Registrar movimiento" con el degradado del hero, tema y lema abajo. Fija al desplazarse.
- Barra superior con el título de la página y la fecha a la izquierda; tema y avatar a la derecha.
- Contenido en rejilla de 12 columnas con 20 px de separación. Inicio: hero 7 + anillo 5; Sobres 5 + gráfica 7; Cuentas 5 + últimos movimientos 7. Sobres: anillo fijo 5 + lista 7. Cuentas: hero 7 + verificación 5, listas 7 + 5. Movimientos: tres resúmenes y tarjetas en dos o tres columnas por fecha.

## Tipografía

**Roboto Flex**, variable, de Google Fonts, pedida por el usuario. Se carga con los ejes de tamaño óptico (`opsz`) y ancho (`wdth`): las cifras grandes y el texto pequeño usan dibujos distintos de la misma fuente.

| Uso                     | Tamaño                                    | Peso      |
| ----------------------- | ----------------------------------------- | --------- |
| Cifra hero              | 40 px móvil, 52 px escritorio             | 800       |
| Título de página        | 24 px móvil, 22 px en barra de escritorio | 700 a 800 |
| Título de tarjeta       | 16 px                                     | 700       |
| Nombre en lista         | 13 px, mayúsculas, tracking amplio        | 800       |
| Cifra en lista          | 15 px, tabular                            | 700       |
| Texto secundario        | 13 px                                     | 400 a 600 |
| Píldora, subtítulo, eje | 12 px                                     | 600 a 700 |

## Color

Segunda referencia, `docs/referencias/ui-referencia-2-colores.webp` (7 de octubre de 2026): el usuario prefirió esta paleta y se aplicó sobre la estructura de la primera. Verde pino profundo, menta, salvia y blanco cálido sobre un lienzo gris verdoso. El tema claro es el de la imagen y el principal; el oscuro usa los mismos verdes sobre un fondo verde negruzco. Sin preferencia guardada, la app sigue al sistema.

| Token                             | Claro                                                                                                      | Oscuro                            | Para qué                                                             |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------- |
| `lienzo-a` → `lienzo-d`           | `#a3b0ae` → `#5f6d6c`                                                                                      | `#3a4745` → `#171f1e`             | Fondo de la composición                                              |
| `panel-a` → `panel-b`             | `#f5f6f2` → `#c9d5c3`                                                                                      | `#15241f` → `#0b1613`             | La pantalla: blanco cálido a salvia                                  |
| `tarjeta`                         | `#ffffff` con sombra suave                                                                                 | `#16302a`                         | Tarjeta estándar                                                     |
| `hero-a` → `hero-b`               | `#174c40` → `#0b332b`                                                                                      | `#1d5c4c` → `#0f3b31`             | Tarjeta principal, con textura de puntos arriba a la izquierda       |
| `mosaico`                         | blanco 10 %                                                                                                | negro 25 %                        | Botones dentro del hero                                              |
| `palida-a` → `palida-b`           | `#d2e5d7` → `#b8d6c1`                                                                                      | `#c6ddcc` → `#a9cbb5`             | Tarjeta menta                                                        |
| `palida-texto` / `palida-texto-2` | `#0e3b32` / `#3d6a5b`                                                                                      | iguales                           | Texto sobre menta                                                    |
| `pildora-oscura`                  | `#e6ebe5` con texto `#14211d`                                                                              | blanco 10 % con texto blanco      | Píldora sobre tarjeta                                                |
| `pildora-hero`                    | blanco 14 %                                                                                                | blanco 14 %                       | Píldora sobre el hero                                                |
| `pildora-navy`                    | `#0e3b32`                                                                                                  | igual                             | Píldora sólida verde pino, botón Registrar, icono activo de la barra |
| `pildora-blanca`                  | blanco 72 %                                                                                                | igual                             | Píldora sobre menta                                                  |
| `texto` / `texto-2` / `texto-3`   | `#14211d` / `#4f5f59` / `#7f8d87`                                                                          | `#e9efe9` / `#a9b9b2` / `#6f8079` | Jerarquía de texto                                                   |
| `palido`                          | `#cfe3d4`                                                                                                  | `#b9d6c2`                         | Avatares, navegación activa, decimales del hero, progreso            |
| `enlace`                          | `#1f6b56`                                                                                                  | `#9fcbb0`                         | Enlaces y porcentajes                                                |
| `positivo` / `negativo`           | `#2f8f66` / `#c9544e`                                                                                      | `#5ccf96` / `#ff7b72`             | Ingresos y cuadra; avisos                                            |
| `nav`                             | blanco 72 %                                                                                                | `#0b1613` al 88 %                 | Píldora de navegación inferior                                       |
| `serie-a` / `serie-b`             | `#0e3b32` / `#5aa381`                                                                                      | `#b9d6c2` / `#4d9d78`             | Barras: gastado / ahorrado                                           |
| `dona-1` → `dona-5`               | `#0b2f28` pino, `#4db889` verde, `#ffffff` blanco, `#5f6d6c` salvia gris, rayado de `#0e3b32` sobre blanco | iguales                           | Anillo: cinco tonos que se distinguen entre sí                       |

Radios: panel 28, tarjeta 22, pálida 22, mosaico 16, avatar 12, píldora completa. La barra inferior móvil es una píldora flotante con botones redondos; el activo se ensancha y muestra su nombre junto a un círculo verde pino, como en la referencia de colores.

Las series de las gráficas pasan separación para daltonismo y 3:1 de contraste contra su tarjeta en ambos temas; el anillo usa cinco tonos de la paleta que se separan con claridad (el usuario pidió que se distinguieran más), con contorno blanco y leyenda con valores. La banda de luminosidad del validador se deja de lado a propósito para respetar la paleta elegida.

## Gráficas

Siguen el método de visualización en lo que no choca con la referencia: una sola escala, columnas de hasta 28 px con extremo redondeado y base recta, 2 px de separación entre segmentos, rejilla recesiva, leyenda cuando hay dos series, tooltip por marca con el resto atenuado, y una tabla equivalente plegada. El texto nunca lleva color de serie.

Desviación consciente: los colores de las barras son los de la imagen, azul pálido y azul, en vez de la banda media que pide el validador. Pasan separación para daltonismo (ΔE 24) y el azul cumple 3:1 contra la tarjeta; la leyenda, el tooltip y la tabla hacen de refuerzo. El anillo usa cinco pasos de un solo azul, validados como rampa ordinal sobre la tarjeta pálida; el color sigue al tipo de sobre, no a su tamaño: emergencia el más oscuro, luego inversión, metas, familia y gastos.

## Piezas base

| Pieza                                                                  | Uso                                                                             |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `Tarjeta`                                                              | Oscura (blanca en claro), radio 20                                              |
| `TarjetaPalida`                                                        | Azul pálido con texto azul marino, radio 22                                     |
| `EncabezadoTarjeta`                                                    | Título con enlace "Ver todos" o contenido a la derecha; `palida` ajusta colores |
| `Cifra`                                                                | Dinero en centavos. `sm`, `md`, `lg`, `xl`, `hero`                              |
| `Pildora`                                                              | `oscura`, `navy`, `blanca`, `positiva`, `negativa`                              |
| `Avatar` + `iniciales`                                                 | Cuadro azul pálido con iniciales                                                |
| `FilaLista`                                                            | Avatar, nombre en mayúsculas, subtítulo, columna derecha; enlazable             |
| `Progreso`                                                             | Barra de 8 px; `palida` para tarjetas pálidas                                   |
| `Mosaico`                                                              | Botón de acción dentro del hero                                                 |
| `Dato`                                                                 | Etiqueta y valor para pies de tarjeta pálida                                    |
| `TituloPagina`                                                         | Título grande, solo en móvil                                                    |
| `TarjetaMovimiento`                                                    | Movimiento como tarjeta pálida                                                  |
| `GraficaMensual`, `GraficaDona`                                        | Barras apiladas y anillo                                                        |
| `BarraLateral`, `NavInferior`, `MenuMovil`, `TituloRuta`, `CambioTema` | Cascarón y navegación                                                           |

## Formularios

Piezas en `src/components/formulario.tsx`: `Campo` (etiqueta arriba, ayuda abajo), `Entrada`, `Selector` y `Boton` (`primario` verde pino en píldora, `secundario` con borde, `peligro` solo texto rojo). Primer uso: el desglose del sobre Ocasiones en `/sobres/[id]`.

- Dentro de una tarjeta. Campos de 48 px con fondo `tarjeta-hover`, radio 14 y borde `tarjeta-borde`; al foco, anillo en `palido`.
- El monto es el primer campo y el más grande: 36 px en negrita con el código de moneda a la derecha. Teclado numérico en el celular.
- Categoría, cuenta y sobre como filas de píldoras desplazables en horizontal; la elegida en azul pálido con texto azul marino.
- Botón principal: ancho completo, 52 px, degradado del hero, texto blanco en negrita, radio 14.
- En escritorio el formulario ocupa 7 columnas y a la derecha, en 5, va un resumen del sobre y la cuenta afectados.

## Movimiento

Transiciones de 140 ms en color, fondo, borde y opacidad. Botones y enlaces se encogen al 98 % al presionarse. Nada se anima al cargar. Se respeta `prefers-reduced-motion`.

## Tema

`data-tema` en `<html>`, fijado antes de pintar por un script en `<head>`. Sin preferencia guardada arranca en oscuro, que es el de la referencia. El botón alterna y guarda la elección.

## Datos de ejemplo

`pnpm db:demo` inserta cinco meses de movimientos realistas marcados como demo. `pnpm db:demo:limpiar` los borra sin tocar nada más.
