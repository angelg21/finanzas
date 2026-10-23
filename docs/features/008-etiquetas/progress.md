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
