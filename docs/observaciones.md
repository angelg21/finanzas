# Observaciones de interfaz

Lista viva de las observaciones del usuario sobre la interfaz, lo que se cambió en pantalla y lo que queda pendiente en el modelo, los datos o el documento del plan. Lo pendiente se resuelve en bloque cuando terminen todas las observaciones.

## 1. La cuenta en dólares de la prima no es de tránsito

**Observación** (7 de octubre de 2026): la empresa de Chile paga en esa cuenta y el usuario no tiene cuenta propia fuera del país, así que el dinero vive ahí por un buen tiempo. No es una cuenta de paso.

**Cambio en la interfaz**: ya no aparece como "Tránsito" ni con la marca roja "No es mía". Se muestra como "USD en EE. UU." dentro de "Mis cuentas", con la nota discreta "a nombre de mi prima". La tarjeta separada "De tránsito" desapareció. El patrimonio dice "Patrimonio en cuentas".

**Pendiente para el final**:

- ~~El modelo marca esa cuenta con `es_propia = false`, lo que la excluye de la suma de cuentas y del invariante con los sobres.~~ Resuelto el 2026-10-11 con el ADR 0006 (spec 001, criterio 16). La cuenta sigue con `es_propia = false` como marca legal, pero entra al cuadre con los sobres y desde ella se puede gastar.
- Ajustar las semillas (`src/db/seed.ts`): tipo, nota y `esPropia` de "Cuenta prima".
- Ajustar `docs/plan-financiero-y-app.md`, secciones 1, 2 y 4, donde dice que es de tránsito y que debe mantener saldo bajo. El riesgo legal sigue siendo real y conviene dejarlo escrito, pero como riesgo, no como regla de uso.
- Revisar el flujo de ingreso: el sueldo remoto entra en esa cuenta y de ahí se mueve a Binance. Desde la feature 004 (2026-10-14), el ingreso se registra en "Cuenta prima" como en cualquier otra cuenta en dólares, cae en "Por asignar" y cuadra con los sobres (ADR 0006). **Sigue pendiente**, para la feature de cuentas y transferencias: mover de la prima a Binance con "Mover", y que las semillas de demostración pongan el sueldo en la prima en vez de directo en Binance.

## 2. "Segunda billetera USDC" no existe

**Observación**: el usuario preguntó qué cuenta es. Es el marcador del segundo sitio para el fondo de emergencia (plan, sección 1, riesgo de concentración en Binance). Hoy es una cuenta vacía con nombre genérico.

**Decisión pendiente del usuario**: quitarla hasta abrir una de verdad (recomendado), o renombrarla si ya sabe cuál será: billetera sin custodia (Trust Wallet, MetaMask), otro exchange, o considerar la cuenta de la prima como segundo sitio.

**Pendiente para el final**: ajustar semillas y la tabla de cuentas del plan según la decisión.

## 3. Administrar cuentas desde la app

**Observación**: poder agregar, editar y eliminar cuentas con sus detalles y montos.

**Estado**: estaba contemplado en la fase 1 del plan ("cuentas, categorías, movimientos"), pero no estaba escrito con este detalle. Se construye junto con la captura rápida, cuando termine la revisión de interfaz.

**Cómo va a funcionar**:

- Pantalla Cuentas con botón "Nueva cuenta" y, en cada cuenta, editar y eliminar.
- Campos: nombre, moneda, tipo, nota, y si está a nombre de un tercero.
- El monto no se escribe en la cuenta: el saldo siempre sale de los movimientos. Al crear una cuenta con dinero ya adentro, la app registra un movimiento de "saldo inicial" que cae en "Por asignar", y de ahí se reparte a los sobres. Así el invariante nunca se rompe.
- Eliminar solo si la cuenta no tiene movimientos; si los tiene, se archiva (deja de verse pero conserva el historial).

## 4. Nueva paleta de colores y fuente

**Observación** (7 de octubre de 2026): el usuario trajo una segunda referencia, `docs/referencias/ui-referencia-2-colores.webp`, cuyos colores le gustan mucho más, y pidió la fuente Roboto Flex.

**Cambio en la interfaz**: misma estructura, nueva paleta en claro y oscuro (verde pino, menta, salvia, blanco cálido, lienzo gris verdoso), Roboto Flex, textura de puntos en la tarjeta principal y barra inferior móvil como píldora flotante con botones redondos. Detalle en `docs/diseno.md`.

## 5. Colores del anillo de distribución

**Observación**: los cinco verdes del anillo eran casi iguales y la gráfica no se entendía.

**Cambio en la interfaz**: cinco tonos de la misma paleta que sí se distinguen: pino profundo (Emergencia), verde medio (Inversión), blanco (Metas), salvia gris (Gastos del mes) y rayado de pino sobre blanco (Familia). El color sigue al tipo de sobre.

## 6. Nombre del sobre "Metas grandes"

**Observación**: era una descripción del usuario, no un nombre. Pidió uno más estándar.

**Cambio**: el sobre se llama "Planes" (elegido entre diez opciones) en la base, en las semillas y en el plan. Agrupa viajes, teléfono, ropa y compras grandes. Cuando una meta tenga monto y fecha, se divide en un sobre por meta con su propio nombre (Laptop, Viaje, Celular).

## 7. Gastos irregulares que no son para uno: regalos, cumpleaños, aniversarios

**Pregunta del usuario**: dónde van según los sobres actuales y si hace falta otro sobre.

**Respuesta**: hace falta uno. Son gastos previsibles pero no mensuales, y no caben bien en ninguno: en "Gastos del mes" rompen el límite el mes que caen, en "Familia" no entran los regalos a amigos o pareja, en "Planes" no porque no son para uno. Propuesta: sobre **"Ocasiones"**, tipo fondo de reserva (se alimenta cada mes con un monto fijo pequeño y se gasta cuando llega la ocasión; lo que sobra se acumula). Monto inicial sugerido: 25 USD al mes, calculado a partir de las ocasiones del año.

**Hecho** (el usuario aceptó): tipo de sobre `fondo`, sobre "Ocasiones" con regla fija de 25 USD después de Familia (Planes baja a 175), tabla `partidas_sobre` para el desglose anual, y pantalla de detalle `/sobres/[id]` donde se agregan y quitan ocasiones (nombre, monto, veces al año, mes) y la app recalcula el aporte mensual como total anual entre doce. Mientras no haya desglose vale un aporte fijo editable. Plan actualizado.

## 8. Administrar categorías con icono y color

**Observación** (11 de octubre de 2026): de Gestor de Gastos le gustaba mucho poder agregar y eliminar categorías de gasto, y asociar a cada una un icono, elegido de una lista larga, y un color de una paleta. **Iconos, nunca emojis**: iconos de línea como los de la barra de navegación.

**Estado**: hecho el 2026-10-11, como ampliación de la spec 001 (criterios 17 a 27), a pedido del desarrollador antes de verificar. Incluye la pantalla `/categorias` con pestañas Gastos e Ingresos; crear y editar con un buscador de 128 iconos de línea y doce colores; archivar en vez de borrar si hay movimientos; y los círculos en la captura de gasto con la píldora "Nueva". Lo guardado es el nombre del icono y del color (ADR 0008). Quedan fuera: el gasto programado (fase 2), un color libre fuera de la paleta, y los iconos en movimientos y gráficas. Estos últimos se hicieron el 2026-10-14 en la feature 003: `/movimientos` con el anillo por categoría en sus colores y cada movimiento con su círculo.

**Puntos de partida para la spec**:

- Iconos de `lucide-react`, el mismo juego que ya usa la app, con más de mil iconos. Se guarda el nombre del icono en la categoría; la lista para elegir es una selección curada y buscable.
- La paleta sale de tokens nuevos en `globals.css`, en claro y oscuro (regla dura: nada de colores sueltos). Hay que decidir cuántos colores y validarlos contra la referencia.
- Borrar: solo si la categoría no tiene movimientos; si los tiene, se archiva, igual que las cuentas (observación 3).
- Las categorías de las semillas reciben un icono y un color por defecto.
- Hace falta migración: dos columnas en `categorias`.

## 9. Crear una categoría sin perder lo escrito en la captura

**Observación** (12 de octubre de 2026, revisión de la spec 001): al tocar "Nueva" en la captura de gasto se sale a `/categorias/nueva`, y al volver se pierde lo escrito: monto, forma de pago, vendido y tasa. La forma vuelve a "Dólares". Si se reescribe "2100" sin mirar, se guardan 2.100 USDT en vez de 2.100 Bs.

**Estado**: limitación aceptada en la spec 001 (criterio 25). En la revisión se intentó conservar lo escrito, primero en la dirección y luego en `sessionStorage`. Cada intento trajo un defecto de datos: un gasto guardado quedaba a un toque de repetirse, un borrador abandonado reaparecía en otra captura, o la confirmación desaparecía tras guardar. El desarrollador decidió sacarlo a una feature aparte, con `/f-spec`.

**Puntos de partida para la spec**:

- Resolverlo de raíz sin salir de la captura: crear la categoría en una ventana modal dentro de `/nuevo/gasto` (el `<dialog>` que ya usa el calendario), con nombre, icono y color, y elegirla al guardar.
- Así no hace falta ningún borrador fuera de React: el estado de la captura no se desmonta.
- Reutilizar `validarCategoria` y las operaciones de `src/db/categorias.ts`; la pantalla `/categorias/nueva` sigue para crear desde la lista.
- Probar desde el principio, en Edge y con el teclado, los caminos que rompieron los intentos: guardar y "Registrar otro", recargar, atrás del sistema, abandonar y entrar por otro acceso.
