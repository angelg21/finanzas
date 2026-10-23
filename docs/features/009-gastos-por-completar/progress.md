# 009 · Progreso

Rama: `feat/009-gastos-por-completar`. Spec: `spec.md`.

## Tareas

- [x] T1 · (2026-10-22) `src/lib/por-completar.ts` con su prueba primero: validar un pendiente y preparar "completar varios" en las tres formas de pago, con el cuadre (criterios 1, 8 y 9).
- [x] T2 · (2026-10-22) Esquema: tabla `gastos_por_completar` con sus checks; `pnpm db:generate`, `guardian-datos` y `pnpm db:migrate`.
- [x] T3 · (2026-10-22) `src/db/por-completar.ts`: anotar (con reintento), listar, contar, descartar, completar uno y completar varios en una transacción que borra los pendientes (criterios 3, 6, 7, 9 y 10).
- [x] T4 · (2026-10-22) `/nuevo/por-completar`, la tarjeta de Registrar y "Anotar sin monto" en la captura (criterios 2 y 3).
- [x] T5 · (2026-10-22) `/por-completar` con descartar, y el aviso en el inicio y en Registrar (criterios 4 y 5).
- [x] T6 · (2026-10-22) Completar uno: la captura de gasto con `?pendiente=` (criterios 6 y 7).
- [x] T7 · (2026-10-22) `/por-completar/varios` (criterios 8 a 10).
- [x] T8 · (2026-10-22) Plan, diseño y observaciones.

## Validación en navegador

- 2026-10-22, el desarrollador: recorrió la lista de pasos que el agente le dio para esta feature (lo que se ve en pantalla, sin carreras ni fallas de red, que van en `/f-verify`) y respondió "sí, está verificado". No dijo en qué ancho.

## Etapas

- [x] Spec leída y corregida por el desarrollador (2026-10-22: una venta por gasto al completar uno, una sola al completar varios, y la pregunta por el resto)
- [x] Construida (todas las tareas con commit, 2026-10-22)
- [x] Validada en navegador (2026-10-22)
- [x] Verificada: `pnpm verify` en verde, cada ★ con su prueba (2026-10-22)
- [ ] Revisada: veredicto APTO PARA FUSIONAR
- [x] Fusionada en `main` el 2026-10-22, antes de validar, verificar y revisar, como las anteriores (ver notas)

## Notas

- T1: las pruebas se escribieron primero y se vieron fallar. "Completar varios" reutiliza `prepararGasto`: la venta única, como "vendiendo" por el total; cada gasto, como "del saldo" a la misma tasa. 11 de 11.
- `guardian-datos`, primera vuelta (2026-10-22): **NO APLICAR**.
  1. **Alta:** el check de la 0007 dejaba pasar monto sin moneda (NULL aprueba un check); se habrían registrado Bs como USD. **Corregido** con la 0008 ("los dos o ninguno"); la 0007 no se edita.
  2. **Alta:** borrar o editar un gasto de "completar varios" deshacía la venta compartida de todos. **Corregido:** una venta compartida no se toca.
  3. **Media:** la categoría de un pendiente no se validaba al completar varios, y una categoría con pendientes podía cambiar de tipo. **Corregido.**
  4. **Media:** un id de captura reusado decía "completados" sin guardar. **Corregido:** responde "otra".
- `guardian-datos`, segunda vuelta: **SEGURO DE APLICAR** la 0007 y la 0008 juntas (una transacción de 19 ms; esquema igual que generado de cero; `revisarEstadoBase` 13 de 13; respaldo bien antes y después). Residuales: 1 y 2, que el último gasto de un grupo se quedaba con la venta, **corregidos** decidiendo por la referencia del gasto; 4, la página de categorías sin contar pendientes, **corregido**; 3, una carrera con un id fabricado, sin pérdida, queda anotado.
- Base local: `pnpm db:migrate` dejó 9 migraciones con los hashes `b761eafe` (0007) y `45773b93` (0008).
- Recorrido de punta a punta (2026-10-22) en Edge sin ventana, con «Cuadra con los sobres» tras cada paso (28 de 28): anotar tres sin mover dinero; el aviso del inicio; completar uno en dólares desde la captura; completar dos con una sola venta de 20 USDT a 250 (5.000 Bs), con la pregunta por los 500 Bs que sobraban y el resto como gasto; Binance bajó 20 y Bolívares quedó igual; borrar uno de los gastos de la venta no la borró y sus 2.000 Bs volvieron a Bolívares; descartar. La base terminó igual.
- **Producción, en este orden:** `pnpm db:respaldo:produccion`, `pnpm db:migrate:produccion` (aplica la 0007 y la 0008) con la app sin uso, y solo entonces `git push origin main`.
- En cola para `/f-verify 009`: `scripts/comprobar-009.ts` con las carreras de completar contra descartar y completar dos veces, contra la base.
- **/f-verify (2026-10-22), sobre `main`.** Una prueba por criterio ★, escrita desde su texto. `src/lib/por-completar.test.ts` de la construcción sigue cubriendo validar un pendiente, la venta única, la pregunta por el resto y las tres formas de pago (★ 8), y `sobreSugerido` en `src/lib/gastos.test.ts` el sobre de cada uno (★ 9). Lo nuevo es `scripts/comprobar-009.ts`, contra la base local con los datos de demostración, que deja como estaba, también los pendientes. Con `--url`, contra el servidor de desarrollo como un navegador sin JavaScript: 31 de 31 ✓.
  - ★ 1 y 3: anotar tres (en Bs, en USD y sin monto) no cambia cuentas, sobres, movimientos, gastado del mes, gráfica mensual, anillo ni lista; el mismo id de captura no anota dos veces.
  - ★ 6: completar el de USD registra el gasto y borra el pendiente juntos; el de Bs vendiendo USDT deja el gasto con su propia venta, editable; un reintento devuelve lo guardado; el id de una captura ya usada, con otro pendiente vigente, da "otra" sin escribir. Páginas: `/nuevo/gasto?pendiente=` abre "Completar gasto" con categoría, descripción, fecha, monto y "vendiendo" marcados; guardar uno vigente vuelve con 303 a `/por-completar?completado=1` y "Completado".
  - ★ 7: completar uno descartado, o uno ya completado en otra captura, no escribe nada; cinco carreras de completar contra descartar y cinco de completar dos veces a la vez: siempre uno solo. Página: abrir el formulario, descartar y guardar responde "Este gasto ya se completó o se descartó" sin gasto.
  - ★ 8: 4.000 Bs recibidos y 3.000 en gastos preguntan por 1.000 Bs; con el resto a Bolívares, una venta de 100 USDT y tres gastos, Binance baja 100 y Bolívares sube 1.000 Bs; como gasto, cuatro gastos con "Resto de la venta" en Familia y Bolívares igual; los pendientes desaparecen.
  - ★ 9 y 10: si la última fila falla (categoría inexistente), no queda ni la venta ni los otros gastos y los pendientes siguen; si uno de los elegidos se descartó, no se guarda nada. El cuadre, después de cada paso.
  - ★ 11: página, sin `?pendiente=` la captura de siempre ("Nuevo gasto", sin pendiente, en dólares). La sesión y `conFallas`: `src/app/sesion.criterios.test.ts`, `src/app/fallas.criterios.test.ts` y `comprobar-002-servidor`.
  - Criterio 5: el inicio y Registrar dicen "3 gastos por completar".
  - `pnpm humo` con sesión: `/nuevo/por-completar`, `/por-completar`, `/por-completar/varios`, `/nuevo/gasto?pendiente=999999` y `?pendiente=abc` → 200.
  - `scripts/comprobar-003-paginas.ts` exporta `abrirSesion` y le suma `enviar`, para mandar un formulario sin JavaScript.
  - `pnpm verify --forzar`: `Tests  947 passed (947)`, `✓ subida (8.7 s)`, `✓ verify:full en verde en 48.2 s. Árbol sellado.`
- **Arreglo desde la revisión de la 006 (2026-10-22).** Completar uno ya descartado con una etiqueta nueva dejaba la etiqueta creada. `completarPorCompletar` la crea dentro de su transacción, después de comprobar los pendientes. `comprobar-009`: completar uno descartado o pasar a vendiendo un gasto de la venta compartida, con una etiqueta nueva, no la deja; completar uno vigente la crea en su gasto (34 de 34 con `--url`).
