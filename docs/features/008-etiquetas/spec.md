# 008 · Etiquetas

Fecha: 2026-10-17. Estado: aprobada (el desarrollador las describió y mandó la maqueta: "Etiquetas" con píldoras, "+ Añadir etiqueta" y una lupa, creadas ahí mismo).

## Para qué

Marcar de qué cliente viene cada ingreso (SAX, Rielco, KumIA) y ver cuánto entró por cada uno. El desarrollador no quiere el # dentro de la nota de la 007: quiere una etiqueta aparte, elegida de una lista para que no haya errores de tipeo, y creada en el mismo formulario.

## Trazabilidad al plan

Fase 1, "Cuentas, categorías, movimientos con nota". Reemplaza las etiquetas con # en la nota de la 007, que se quitan.

Decisiones del desarrollador, 2026-10-17:

- una etiqueta por movimiento, como la categoría: el acumulado por etiqueta nunca cuenta dos veces el mismo dinero;
- en ingresos y en gastos;
- se crean en el formulario, sin una pantalla aparte (maqueta del desarrollador).

## Criterios de aceptación

1. ★ **Una etiqueta, sin duplicados por tipeo.** Una etiqueta tiene un nombre de 1 a 30 caracteres. "SAX", "sax" y " Sax " son la misma: al crear una con un nombre que ya existe sin importar mayúsculas, acentos ni espacios de más, se usa la existente. Lo garantiza un índice único de la base sobre su clave.
2. ★ **Elegir en el formulario.** En la captura de gasto, en la de ingreso y al editar uno de los dos (006), el campo "Etiquetas" muestra las existentes como píldoras. Tocar una la elige; tocar la elegida la quita. Sin etiqueta es lo normal y no pide nada más.
3. ★ **Crear ahí mismo.** "+ Añadir etiqueta" y la lupa abren un campo de texto. Lo que se escribe filtra las píldoras. Si no hay una igual, debajo se lee "Se creará «Rielco» al guardar", y al guardar se crea y queda puesta. Lo escrito en el resto del formulario no se pierde. Sin JavaScript, el campo de texto está siempre a la vista. Tocar una píldora, también una que quedó al filtrar, la elige y borra lo escrito: se guarda la píldora, nunca lo escrito a la vez; cerrar la búsqueda con la X devuelve la píldora que estaba elegida. Sin JavaScript, si llegan las dos, manda lo escrito (revisión, 2026-10-22).
4. ★ **Solo gastos e ingresos.** La base no admite una etiqueta en otro tipo de movimiento (check). La venta de USDT de un gasto y el reparto de un ingreso no llevan etiqueta: solo el gasto y el ingreso.
5. ★ **Filtrar y acumular.** En `/movimientos`, en Gastos e Ingresos, las etiquetas con movimientos en el periodo salen como píldoras con su total ("SAX 1.200"). Tocar una filtra la lista y el total de arriba ("SAX · 1.200,00 USD"); tocarla otra vez lo quita. Se combina con la categoría. El anillo sigue siendo el del periodo. `?etiqueta=` es el id: uno que no es un entero positivo o que no existe no filtra, y la página no falla. La etiqueta activa conserva su píldora para quitarla aunque no tenga movimientos en el periodo o la categoría; viaja en las flechas, el calendario y el campo de fecha sin JavaScript; y no pasa a Mover, que no lleva etiquetas (revisión, 2026-10-22).
6. Cada fila de Movimientos y del inicio muestra su etiqueta en el detalle ("Sueldo remoto · Binance · SAX").
7. ★ La captura de gasto no se vuelve más lenta: sin etiqueta no hay ninguna consulta ni escritura nueva al guardar.

## Pantallas

**Pieza nueva `SelectorEtiqueta`** (`src/components/selector-etiqueta.tsx`), como la maqueta:

- arriba, "Etiquetas" en `texto-3` y, a la derecha, la lupa (`Search` de lucide) como botón;
- las etiquetas en píldoras de contorno (`pildoraOpcion` con `pildoraNormal`; la elegida, `pildoraElegida`), envueltas;
- al final, "+ Añadir etiqueta" con borde punteado, como la píldora "Nueva" de las categorías;
- al abrir, un `Entrada` "Nombre de la etiqueta" debajo, con la línea "Se creará «X» al guardar" en `texto-3` si no existe.

Va después del sobre en la captura de gasto, después de la categoría en la de ingreso, y en el mismo sitio al editar.

**`/movimientos`**: la fila de píldoras de la 007 pasa a ser de etiquetas guardadas, con su total.

## Datos

- **Tabla nueva `etiquetas`**: `id`, `nombre`, `clave` (única: `claveDeNombre`, la de las categorías), `creado_en`. Con RLS y sin políticas, como todas.
- **`movimientos.etiqueta_id`**: entero, opcional, con su llave foránea, su índice y un check que la admite solo en `gasto` e `ingreso`.
- **Migración 0006** con `pnpm db:generate`; `guardian-datos` antes de `pnpm db:migrate`. **En producción, `pnpm db:migrate:produccion` antes de publicar `main`**: el código nuevo lee la tabla.
- Semillas y demo: sin cambios. Los movimientos existentes quedan sin etiqueta.

## Fuera de alcance

Renombrar, archivar o borrar etiquetas (no hay pantalla de etiquetas), colores por etiqueta, varias etiquetas por movimiento, y etiquetas en transferencias, reparto o deudas.

## Pruebas antes del código

`src/lib/etiquetas.ts`: el nombre válido y su clave (criterio 1), y el id del filtro (criterio 5).

En cola, por pedido del desarrollador, para `/f-verify 008`: los ★ contra la base (`scripts/comprobar-008.ts`): crear dos veces con distinta grafía, crear a la vez desde dos pestañas, el check de tipo, el filtro y su total.

## Riesgos y decisiones

- La etiqueta nueva se crea en la misma transacción que guarda el movimiento, después de lo que puede rechazarlo: si el movimiento no se guarda, la etiqueta tampoco queda (revisión de la 006, 2026-10-22).
- Lo de la 007 con # en la nota se quita entero: sus pruebas se van con el código que probaban, por decisión del desarrollador.
