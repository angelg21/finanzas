# 010 · Progreso

Rama: `feature/010-editar-por-completar`. Spec: `spec.md`.

## Tareas

Cada tarea cabe en 30 a 60 minutos y termina en verde con un commit. Se marca con la fecha al cerrarla.

- [x] T1 · (2026-10-22) `editarPorCompletar` en `src/db/por-completar.ts`: campo por campo, nunca la referencia ni la fecha de creación; false si ya no estaba.
- [x] T2 · (2026-10-22) `/por-completar/[id]`: página, acción con `leerSesion` y `conFallas`, y el formulario de anotar reutilizado (`CamposPorCompletar`, con su botón y sus ocultos). La categoría propia, aunque esté archivada.
- [x] T3 · (2026-10-22) La lista enlaza cada pendiente a su edición (con un lápiz y ", editar" para el lector de pantalla); avisos "Cambios guardados" y "Ese gasto ya se completó o se descartó"; el nombre usa dos líneas en el celular en vez de cortarse.
- [x] T4 · (2026-10-22) "Por completar" en el menú; "Ver por completar" en la captura de gasto, sin consulta; título de la pantalla; el "+" oculto en ella, y de paso en el detalle de una deuda y de un sobre (segunda revisión de la 006, hallazgo 1); "Mover" del inicio a `/nuevo/mover`.
- [x] T5 · (2026-10-22) `scripts/comprobar-010.ts` contra la base y, con `--url`, las páginas sin JavaScript: 14 de 14 ✓. El humo pide `/por-completar/999999` y `/abc` (404).

## Validación en navegador

El desarrollador anota aquí, con fecha, qué pantallas miró y en qué ancho. Sin esta nota no se pasa a `/f-verify`.

- Pendiente. El agente miró las capturas de `/por-completar` y `/por-completar/[id]` a 390 y 1440 px, claro y oscuro (`capturas/*-por-completar*.png`).

## Etapas

- [x] Spec escrita a partir del pedido del desarrollador (2026-10-22)
- [x] Construida (todas las tareas con commit, 2026-10-22)
- [ ] Validada en navegador
- [ ] Verificada: `pnpm verify` en verde, cada ★ con su prueba
- [ ] Revisada: veredicto APTO PARA FUSIONAR
- [x] Fusionada en `main` el 2026-10-22, por pedido del desarrollador ("arréglalo ya mismo"), antes de validar y revisar (ver notas)

## Notas

- **Pedido (2026-10-22), mientras se revisaba la 006.** Tres cosas: no podía corregir dos fechas de gastos por completar; después de anotarlos no encontraba por dónde volver a la lista; y al tocar Registrar veía medio segundo "una pantalla con los tipos de movimientos" antes del formulario.
- **El parpadeo no se reprodujo.** En Edge a 390 px, con el servidor de desarrollo y con el build de producción, también con la CPU seis veces más lenta y red 4G, el "+" desde el inicio, Movimientos, Sobres y Por completar lleva directo a `/nuevo/gasto` (el registro de la pantalla cada 25 ms y la grabación de cuadros no muestran nada en medio). Ninguna redirección pasa por `/nuevo`. Se le preguntó al desarrollador desde qué botón y qué pantalla; queda abierto. Un `loading.tsx` en la captura daría una pantalla intermedia propia, pero sin JavaScript la captura quedaría en blanco (Next la manda por el stream), así que no se puso.
- `pnpm verify --forzar`: `Tests  953 passed (953)`, `✓ /por-completar/999999 → 404`, `✓ verify:full en verde en 50.3 s. Árbol sellado.`
- **Fusión adelantada.** En cola: la validación del desarrollador, `/f-verify 010` (las pruebas de `comprobar-010` ya cubren cada ★) y `/f-review 010`, después de las revisiones de la 007, 008 y 009.
