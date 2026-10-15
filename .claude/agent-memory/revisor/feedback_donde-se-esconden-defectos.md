---
name: donde-se-esconden-defectos
description: Patrón del autor en finanzas - ★ muy bien probados en lib y en scripts/comprobar-NNN; los defectos quedan en valores por defecto (también "hoy"), en estado del cliente tras una vuelta al servidor, en lo que "tocar" significa para un radio, en la parte de la feature que solo se probó por curl (botones con formAction) y en estado guardado fuera de React (URL, sessionStorage) que sobrevive a guardar o a abandonar
metadata:
  type: feedback
---

El autor prueba los criterios ★ a fondo (funciones puras, un script contra la base con `--url`, humo) y corrige cada hallazgo con su commit y la reproducción repetida. Lo que se le escapa vive fuera de los ★, en el estado de la pantalla:

- 001, vuelta 1 (2026-10-12): la venta heredaba la cuenta del último gasto manual en vez de Binance. Valor por defecto.
- 001, vuelta 2 (2026-10-12): el formulario se vuelve a montar con `key={ronda}` tras cada respuesta del servidor (error o confirmación de Inversión). Todo `useState` que no viaja en `valores` se pierde; ahí se perdía `sobreTocado`. Al elegir la categoría después del error, el sobre elegido a mano se reemplazaba por el sugerido y el gasto se guardaba en otro sobre. Sin editar ni reasignar en la app, el error no tenía arreglo.
- 001, vuelta 3 (2026-10-12): "hoy" solo se calcula al renderizar en el servidor; el cliente nunca lo recalcula. Una pantalla abierta que cruza la medianoche de Caracas (o "Registrar otro" a la mañana siguiente, que reusa los datos de la última acción) guarda el gasto con la fecha de ayer mientras la píldora dice "Hoy". También: el sobre solo cuenta como tocado con `onChange`, así que tocar el sobre ya marcado no lo fija.

- 001, vuelta 4 (2026-10-12): el arreglo de la vuelta 3 metió el defecto siguiente. `SelectorFecha` manda "hoy"/"ayer" cuando `valor === hoy`/`ayer`, no cuando se tocó el atajo: un día elegido en el calendario que coincide con el hoy o el ayer de la página se vuelve a resolver al guardar (elegí el 10, se guardó el 11). Y sin JS, vaciar la fecha nativa devuelve `fecha=""`, que vuelve en `valores` y `etiquetaFecha("")` revienta el render: 500 y pantalla en blanco.

- 001, vuelta 5 (2026-10-12): los arreglos de fecha y tasa estaban bien; el defecto vivía en la ampliación de categorías, que nadie había ejercitado con un navegador. "Restaurar la archivada" (★ 19) es un `<button name="restaurar" formAction={accion}>`: React reemplaza ese `name` por `$ACTION_ID_…`, así que `restaurar` nunca llega y no restaura nada, con o sin JS. La evidencia del autor era un curl que mandaba `restaurar=<id>` a mano. También: `sobreSugerido` compara el nombre exacto de la categoría y la misma feature permite renombrarla (criterio 20): "Familia y casa" ya no sugiere el sobre Familia.

- 001, vuelta 6 (2026-10-12): el arreglo de restaurar funciona al pulsar el botón, pero "Restaurar la archivada" quedó como el primer `type=submit` del formulario (justo bajo el nombre). Enter, o la tecla "Ir" del teclado del celular, dispara el botón por defecto: tras el error de archivada, cambiar el nombre y pulsar Enter restaura la archivada y descarta lo que se creaba o editaba, con o sin JS. Y Enter en el buscador de iconos (`type=search` dentro del `<form>`) crea la categoría con el icono por defecto.

- 001, vuelta 7 (2026-10-12): el arreglo "lo escrito viaja en la dirección" (`?volver=` con el borrador) dejó el borrador en la URL de la captura después de guardar: "Registrar otro" con JS hace `preventDefault` y no toca la URL. Recargar (pestaña descartada en el celular) o "Ir al inicio" → atrás vuelve a pintar el gasto ya guardado, completo, y un toque lo duplica (venta + gasto); la app no deja borrar gastos. Además el foco automático deja el cursor al principio del monto precargado ("15" → "152100"), y el atrás del sistema desde "Nueva" pierde todo: la spec solo nombraba "la flecha de volver" de la app.

- 001, vuelta 8 (2026-10-12): el arreglo pasó el borrador a `sessionStorage` (`b63fba7`). Se aplica a toda captura montada con `numero === 0` durante 30 min, no solo al volver de "Nueva": abandonar crear categoría y abrir luego "Gasto" o "+" desde inicio trae forma "vendiendo", vendido, tasa, fecha "ayer", nota y hasta la Cuenta prima; "5" + Transporte guardó 20 USDT vendidos y un gasto en Bs con fecha de ayer. Y el `key` de la captura depende del borrador: si caduca entre volver y guardar, la re-renderización que trae `revalidatePath` cambia el `key`, se pierde la confirmación y queda el formulario vacío con la categoría ya elegida (duplicado a un número y un toque). El progress decía "se recupera y se borra"; el código solo lo borra al guardar.

- 001, vuelta 9 (2026-10-12): APTO. El autor revirtió el borrador (`13f1354`) por decisión del desarrollador tras tres vueltas de defectos de datos; el revert salió limpio. Lo que sobrevivió del commit revertido, `onFocus={select()}` en el monto, se pensó para un monto precargado y ahora corre en cada foco: tocar el monto para añadir una cifra lo selecciona todo ("21" + "0" → "0"). Se reportó como baja, no bloquea.

- 004, vuelta 1 (2026-10-15): APTO al primer intento. Ejercité con JS, sin JS, Enter, "Registrar otro", confirmación de "Quedan X", fijos en un mes sin reparto y topes: todo cuadró. Lo que quedó fue de pantalla: un mensaje de éxito (`guardado`) que sigue visible mientras se edita algo distinto sin guardar (el formulario no se vuelve a montar hasta la siguiente respuesta), y cinco `SelectorPildoras` con la misma leyenda "Regla" sin el nombre del sobre. El autor también mete en la rama de la feature commits "fuera del pipeline, por decisión del desarrollador" (iconos, inicio, cuentas) sin spec: revisarlos solo contra reglas duras y decirlo. Y deja decisiones de dinero "para decidir aparte" en el progress (aquí "1.200" se lee 1,20) que la nota de validación luego no resuelve.

**Why:** la demo es toda `origen = importado`, así que la lógica que depende de historial `manual` no se ve. La validación en navegador sigue el camino feliz, en un solo momento, y no pasa por un error de validación ni por el paso del tiempo antes de guardar.

**How to apply:**

- Registra un movimiento manual por la acción sin JS y recarga antes de mirar los valores por defecto.
- Recorre la sección "Pantallas" frase por frase contra el código, sobre todo los "por defecto". "Hoy" también es un valor por defecto: busca dónde se calcula y si el cliente lo refresca.
- En cada formulario con `key={ronda}`, busca el `useState` que no viene de `valores` y ejercítalo con JS: elegir a mano, provocar un error (olvidar la categoría es el más probable), y luego cambiar lo que dispara la sugerencia.
- Para "tocado": prueba tocar la opción que ya está marcada; un radio no emite `change`.
- Una fila que queda en una cuenta, un sobre o una fecha que el usuario no eligió afecta datos: NO APTO, más aún si la app todavía no permite editar ni reasignar.
- Lee primero el diff de los `fix(` de la vuelta anterior: ahí está el defecto nuevo. Desconfía de inferir la intención por igualdad (`valor === hoy` no es "tocó Hoy").
- Todo lo que la acción devuelve en `valores` vuelve a pintarse: envía sin JS valores vacíos o raros (fecha vacía, texto) y mira si el render los formatea sin validar.
- Cuando el capture ya resiste, mira la otra mitad de la feature (aquí, categorías): cada botón o enlace secundario que ofrece la pantalla, pulsado en Edge, no por curl. Busca `formAction` con `name`: React pisa ese `name`.
- En cada formulario con más de un `type=submit`, mira cuál es el primero en el orden del DOM: es el que dispara Enter. Y todo buscador o filtro dentro de un `<form>` lo envía con Enter. Pruébalo pulsando Enter, no con clics: el autor valida con clics.
- Si un arreglo mete estado en la dirección (`searchParams`), sigue esa URL después del éxito: guarda, "Registrar otro", `location.reload()` y "Ir al inicio" + `history.back()`. Un formulario que reaparece lleno es un duplicado a un toque. Y prueba el atrás del sistema (`history.back()`), no solo la flecha de la app: el autor valida con la flecha.
- Si un arreglo guarda estado fuera de React (`sessionStorage`, almacén externo): abandona el flujo a mitad y abre la pantalla por otro acceso (inicio, "+"); deja que caduque entre abrir y guardar (escribe la marca de tiempo en el pasado). Un `key` que se calcula de un almacén externo cambia en la re-renderización que trae `revalidatePath` tras guardar. Compara lo que el progress dice del diseño ("un solo uso") con dónde se borra de verdad.
- Una regla que busca por nombre (`sobreSugerido`, "Binance", "Gastos del mes") se rompe si la misma feature deja renombrar: cruza cada criterio de "editar" con las reglas por nombre.
- En formularios que muestran "guardado" sin desmontarse (reglas, ajustes): guarda, cambia algo y mira si el éxito sigue diciendo algo que ya no es verdad.
- Busca en el progress cada "se decide aparte" o "si molesta" y comprueba si la nota de validación lo decidió; si no, dilo en el informe.
- Tras un `revert` con "se conservan los demás arreglos": cada pieza conservada se diseñó para el contexto que se fue. Mira si su condición sigue teniendo sentido (un handler que antes servía al dato precargado ahora corre siempre) y ejercítala con un toque real, no con `autoFocus`.

Ver [[entorno-revision-finanzas]].
