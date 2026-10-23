# 008 · Progreso

Rama: `feat/008-etiquetas`. Spec: `spec.md`.

## Tareas

- [x] T1 · (2026-10-17) `src/lib/etiquetas.ts` (nombre, clave e id del filtro) con su prueba primero; quitar lo de # en la nota de la 007.
- [x] T2 · (2026-10-17) Esquema: tabla `etiquetas` y `movimientos.etiqueta_id` con su check; `pnpm db:generate`, `guardian-datos` y `pnpm db:migrate`.
- [x] T3 · (2026-10-17) `src/db/etiquetas.ts`: las etiquetas, buscar o crear por clave; `baseMovimientos` con la etiqueta; el filtro y las etiquetas del periodo con su total.
- [x] T4 · (2026-10-17) `SelectorEtiqueta` y su uso en la captura de gasto, la de ingreso y al editar (006), con las acciones.
- [x] T5 · (2026-10-17) `/movimientos`: píldoras, filtro y total; la etiqueta en las filas.
- [x] T6 · (2026-10-17) Plan, diseño y observaciones.

## Validación en navegador

- 2026-10-22, el desarrollador: recorrió la lista de pasos que el agente le dio para esta feature (lo que se ve en pantalla, sin carreras ni fallas de red, que van en `/f-verify`) y respondió "sí, está verificado". No dijo en qué ancho.

## Etapas

- [x] Spec escrita con la maqueta del desarrollador (2026-10-17)
- [x] Construida (todas las tareas con commit, 2026-10-17)
- [x] Validada en navegador (2026-10-22)
- [x] Verificada: `pnpm verify` en verde, cada ★ con su prueba (2026-10-22)
- [ ] Revisada: veredicto APTO PARA FUSIONAR
- [x] Fusionada en `main` el 2026-10-17, por pedido del desarrollador antes de validar, verificar y revisar (ver notas)

## Notas

- T2, `guardian-datos` (2026-10-17): **SEGURO DE APLICAR**. La 0006 solo añade y corre en una transacción; es idéntica a la calculada por drizzle-kit; en una copia con forma de producción, `revisarEstadoBase` 12 de 12; con 300 mil filas, `movimientos` bloqueada unos 11 ms. Hash `56bd5d694215`, el mismo que quedó en la base local con `pnpm db:migrate`. Hallazgos:
  1. **Media, operativo:** el respaldo previo a migrar fallaba con el código de la 008, porque comparaba la tabla `etiquetas`, que producción aún no tiene. **Corregido:** `resumir` anota "todavía no existe en esta base" en vez de fallar. Ensayo en local tras migrar: 15 de 15 y "Respaldo comprobado".
  2. **Baja:** `etiquetas` no tiene marca demo: las pruebas usan nombres `demo-` y las borran al terminar.
  3. a 5. **Info:** el orden alfabético de los checks, la base no frena un nombre vacío (lo frena `nombreDeEtiqueta`) y la migración sin `lock_timeout` (con la app sin uso, como dice `despliegue.md`).
  4. **Info:** `etiquetaId` era opcional en `editarGasto` y `editarIngreso`. **Corregido:** ahora es obligatorio.
  5. **Info:** las notas con #SAX de la 007 no se convierten; el texto sigue en la nota.
- Lo de la 007 con # en la nota se quitó: `src/lib/etiquetas.ts` y su prueba se reescribieron para las etiquetas guardadas.
- Recorrido de punta a punta (2026-10-17) en Edge sin ventana, base local migrada, con «Cuadra con los sobres» tras cada paso (19 de 19): ingreso con "demo-Cliente" escrita ("Se creará «demo-Cliente» al guardar.") y su reparto sin etiqueta; gasto escribiendo " DEMO-cliente " ("Se usará «demo-Cliente», que ya existe.") sin crear otra; la píldora "demo-Cliente 50" en una línea; el filtro "demo-Cliente · 50,00"; `?etiqueta=abc` no filtra; al editar viene elegida y tocarla la quita. Al final, los mismos movimientos y ninguna etiqueta de prueba.
- **Producción, en este orden:** `pnpm db:respaldo:produccion`, `pnpm db:migrate:produccion` con la app sin uso, y solo entonces `git push origin main`.
- **Fusión adelantada (2026-10-17)**, por pedido del desarrollador. En cola para `/f-verify 008`: `scripts/comprobar-008.ts` con dos grafías, dos pestañas a la vez y el check de tipo, con nombres `demo-` y borrado al final.
- **/f-verify (2026-10-22), sobre `main`.** Una prueba por criterio ★, escrita desde su texto; `src/lib/etiquetas.test.ts` de la construcción sigue cubriendo el nombre, la clave, el filtro de las píldoras y `leerIdEtiqueta`. Lo nuevo:
  - `src/app/(con-sesion)/etiqueta-del-formulario.criterios.test.ts` (7 pruebas, con la base simulada que cuenta lo que se le pide):
    - ★ 7: sin etiqueta, con los campos vacíos o con un id que no es un entero positivo, ninguna consulta ni escritura;
    - ★ 2: la píldora elegida queda si existe, y si se borró mientras tanto: "Esa etiqueta ya no existe";
    - ★ 3: lo escrito se busca o se crea y queda puesto, manda sobre la píldora, y un nombre de más de 30 no toca la base.
  - `scripts/comprobar-008.ts`, contra la base local con los datos de demostración, que deja como estaba, también las etiquetas (14 de 14 ✓):
    - ★ 1: "SAX", "sax", " Sax " y "SÁX" dan la misma fila, con la grafía de la primera; seis grafías de "Rielco" creadas a la vez terminan en una sola fila; una segunda fila con la misma clave: 23505;
    - ★ 4: el gasto vendiendo USDT lleva la etiqueta y su venta no, también al editarlo; el ingreso sí y su reparto no; la base rechaza una etiqueta en una transferencia o una reasignación al insertar y al actualizar: 23514;
    - ★ 5 y 6: en el mes, Gastos muestra Rielco con 32,00 e Ingresos con 100,00; filtrar deja sus tres gastos y el total en 32,00; con la categoría, dos y 25,00; sin filtro vuelve el de sin etiqueta; el anillo no cambia; cada fila trae el nombre de su etiqueta.
  - `pnpm humo` con sesión: `/movimientos?etiqueta=999999`, `=abc`, `tipo=ingresos&etiqueta=-1` y `etiqueta=1e3&etiqueta=2` → 200 (★ 5, la página no falla).
  - `pnpm verify --forzar`: `Tests  947 passed (947)`, `✓ subida (6.8 s)`, `✓ verify:full en verde en 43.0 s. Árbol sellado.`
- **Arreglo desde la revisión de la 006 (2026-10-22).** Una captura o una edición que no se guarda creaba igual la etiqueta nueva. Ahora `etiquetaDelFormulario` solo dice qué se pidió y la etiqueta se crea en la misma transacción que guarda el movimiento (`registrarCaptura` con su tercer argumento, `completarPorCompletar`, `editarGasto`, `editarIngreso`). Sin etiqueta nueva, la captura sigue sin transacción aparte (★ 7). `comprobar-008`: guardar con una nueva la crea en el gasto; repetir la captura con otro gasto no la deja (16 de 16).
- **Revisión (2026-10-22), primera vuelta:** `revisor`, **NO APTO**, sobre `075ac19`, con `pnpm verify --forzar` en verde y `comprobar-008` 16 de 16. Hallazgos:
  1. **Alta, datos.** Escribir para filtrar y tocar la píldora que quedaba la marcaba, pero se guardaba lo escrito como etiqueta nueva ("riel" en vez de Rielco): el radio no borraba lo escrito y en el servidor manda lo escrito. Al editar, igual.
  2. **Media.** El filtro de etiqueta pasaba a la pestaña Mover y ahí no se podía quitar.
  3. **Media.** La píldora activa desaparecía si no había movimientos con esa etiqueta en el periodo o la categoría.
  4. **Baja.** El campo de fecha sin JavaScript perdía la etiqueta.
  5. **Baja.** En la edición, escribir y cerrar con la X quitaba la etiqueta guardada.
  6. **Baja, documentos.** El criterio 16 de la 003 ya no cuenta bien las consultas; los "Riesgos" de esta spec decían que la etiqueta se crea antes de guardar.
  7. **Menor.** `selector-etiqueta.tsx` copiaba la clase de las píldoras de `formulario.tsx`.
- Arreglos (2026-10-22):
  - **1 y 5**: tocar una píldora, también una filtrada, la elige, borra lo escrito y cierra la búsqueda; escribir quita la elegida y borrar lo escrito o cerrar con la X la devuelve. En Edge con JavaScript, a 390 px: filtrar "riel" y tocar Rielco envía `etiquetaId=127` sin `etiquetaNueva` ni "Se creará"; escribir "S" y cerrar devuelve `etiquetaId=127`. La spec (criterio 3) dice ahora la regla, y que sin JavaScript, si llegan las dos, manda lo escrito (la prueba de `etiqueta-del-formulario` lo nombra así).
  - **2, 3 y 4**: en Mover la etiqueta no se consulta ni filtra y el enlace a Mover no la lleva; la activa siempre tiene su píldora (con 0 si no hay movimientos); el campo de fecha sin JavaScript la lleva. Además, la etiqueta se busca en paralelo con los totales y la categoría. `scripts/comprobar-008-revision.ts --url`: 5 de 5 ✓; con la página anterior, 4 ✗.
  - **6**: la spec 003, criterio 16, cuenta las consultas en dos tandas; los Riesgos de esta spec dicen que la etiqueta nueva se crea en la transacción que guarda; la 008, criterio 5, dice lo de Mover y la píldora activa.
  - **7**: `pildoraDeRadio` en `formulario.tsx`, usada por `SelectorPildoras` y por el selector de etiquetas.
  - `pnpm verify --forzar`: `Tests  957 passed (957)`, `✓ verify:full en verde en 51.2 s. Árbol sellado.`
- **Revisión (2026-10-22), segunda vuelta:** `revisor`, **NO APTO**, sobre `1db2aa4`. Los arreglos de la primera cierran en los cinco formularios (gasto, ingreso, sus ediciones y completar un pendiente) y en `/movimientos`. Hallazgos:
  1. **Media, datos.** Enter en la búsqueda de etiquetas guardaba el movimiento y creaba lo escrito como etiqueta nueva (gasto e ingreso).
  2. **Media-baja, ★ 3.** Tras una respuesta del servidor (un error, la confirmación de Inversión), los formularios se vuelven a montar y la píldora de antes de escribir se perdía: la X ya no la devolvía, y al guardar la etiqueta quedaba en NULL.
  3. **Baja.** Sin JavaScript se veían la lupa y "+ Añadir", que no hacen nada.
- Arreglos (2026-10-22): Enter en la búsqueda solo busca (como el buscador de iconos de categorías); mientras se escribe, la píldora de antes viaja en un `etiquetaId` oculto, así vuelve del servidor y el selector la recupera (lo escrito sigue mandando); la lupa y "+ Añadir" llevan `noscript:hidden`. En Edge a 390 px: Enter con "riel" escrito no registra nada; elegir Rielco, escribir "S", guardar sin categoría ("Elige una categoría") y cerrar con la X envía `etiquetaId=168` sin `etiquetaNueva`, con la píldora marcada; sin JavaScript, la lupa y "+ Añadir" con `display: none` y el campo a la vista. La spec (criterio 3) lo dice. `comprobar-008` y `-008-revision --url` en verde; `pnpm verify --forzar`: `Tests  957 passed (957)`, `✓ verify:full en verde en 48.5 s. Árbol sellado.`
- **Revisión (2026-10-23), tercera vuelta:** `revisor`, **NO APTO**, sobre `63cab23`, con `pnpm verify --forzar` en verde (957), `comprobar-008 --url` 16 de 16 y `comprobar-008-revision --url` 5 de 5. Con JavaScript, los arreglos de la segunda vuelta funcionan en los cinco formularios. Hallazgos:
  1. **Media, ★ 2 y 3.** Sin JavaScript, tras una respuesta del servidor con algo escrito (un error, la confirmación de Inversión, o en el ingreso el primer envío, que solo propone), el selector salía abierto y filtrado: solo las píldoras que coinciden, ninguna marcada aunque la de antes viajaba oculta y era la que se guardaba al borrar lo escrito, la X a la vista sin hacer nada y "Se creará «Rie» al guardar" aunque se vaciara el campo.
  2. **Baja, con JavaScript.** Al abrir otra vez la búsqueda tras una respuesta del servidor, el campo no recibía el foco: `autoFocus` miraba lo que volvía del servidor.
  3. **Menor, accesibilidad.** La X se desmonta al cerrar y el foco caía en `body`.
  4. **Menor, documentos.** `docs/diseno.md` no decía que sin JavaScript la lupa y "+ Añadir" no se ven.
- Arreglos (2026-10-23), en `src/components/selector-etiqueta.tsx`:
  - Lo que pinta el servidor es lo de sin JavaScript: todas las píldoras, con la elegida de antes marcada aunque haya algo escrito, y sin el `etiquetaId` oculto (el radio ya la lleva). Ya en el navegador (`useSyncExternalStore`: falso en el servidor y al hidratar, verdadero desde el primer render en el cliente) la búsqueda filtra y aparta la elegida como antes, sin parpadeo. La X y el aviso llevan `noscript:hidden`, y una línea que solo se ve sin JavaScript dice "Si escribes una, se guarda la escrita y no la marcada.", como manda el ★ 3.
  - El campo se enfoca solo cuando lo abre la persona (lupa o "+ Añadir"); la X devuelve el foco a la lupa.
  - La spec (★ 3) y `docs/diseno.md` lo dicen.
  - Evidencia en Edge sin ventana contra `pnpm dev`, con dos etiquetas `demo-r8d` que se borraron al terminar y solo envíos que el servidor rechaza: sin JavaScript, en el gasto tras "Elige una categoría", en el ingreso tras la propuesta y al editar un gasto tras "Escribe el monto", se ven las tres píldoras con la de antes marcada, lo escrito en el campo, sin X ni aviso y con la línea de que manda lo escrito; vaciar el campo deja enviando la marcada. Con JavaScript: escribir aparta la elegida y filtra; tras el error, la X devuelve KumIA y el foco queda en la lupa; la lupa otra vez enfoca el campo y la S entra en él; la línea de sin JavaScript tiene `display: none`. `pnpm verify:fast` en verde.
