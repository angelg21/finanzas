# 006 · Progreso

Rama: `feat/006-editar-movimientos`. Spec: `spec.md`.

## Tareas

Cada tarea cabe en 30 a 60 minutos y termina en verde con un commit. Se marca con la fecha al cerrarla.

- [x] T1 · (2026-10-17) `src/lib/editar-gasto.ts` con su prueba primero: de las filas guardadas y la entrada nueva, qué se actualiza, qué se crea y qué se borra en cada cambio de forma de pago; el cuadre antes y después con `saldosTras` (criterios 1 a 3).
- [x] T2 · (2026-10-17) `src/lib/editar-ingreso.ts` con su prueba primero: la diferencia de monto, si "Por asignar" alcanza, y lo que devuelve cada sobre al borrar con el reparto (criterios 4, 5 y 7).
- [x] T3 · (2026-10-17) `src/db/editar-movimientos.ts`: leer un gasto o un ingreso con lo enlazado por su captura; editar y borrar en una transacción, los ingresos con el candado de "Por asignar". `guardian-datos` antes de usarlo.
- [x] T4 · (2026-10-17) `/movimientos/[id]` para un gasto: el formulario de la captura en modo edición, sus acciones con `conFallas`, y "Borrar" con su confirmación (criterios 2, 3, 6, 9 y 10).
- [x] T5 · (2026-10-17) `/movimientos/[id]` para un ingreso: su formulario, la línea del reparto, sus acciones y "Borrar" (criterios 4, 5, 7, 9 y 10).
- [x] T6 · (2026-10-17) `FilaMovimiento` con `href`, en `/movimientos` y en el inicio; el 404 para lo que no es gasto ni ingreso; el aviso al volver (criterios 8, 11 y 12). Capturas en móvil y escritorio, claro y oscuro.
- [x] T7 · (2026-10-17) Plan, `docs/diseno.md` y observaciones al día.

## Validación en navegador

El desarrollador anota aquí, con fecha, qué pantallas miró y en qué ancho. Sin esta nota no se pasa a `/f-verify`.

- 2026-10-22, el desarrollador: recorrió la lista de pasos que el agente le dio para esta feature (lo que se ve en pantalla, sin carreras ni fallas de red, que van en `/f-verify`) y respondió "sí, está verificado". No dijo en qué ancho.

## Etapas

- [x] Spec leída y aprobada por el desarrollador, sin cambios (2026-10-17)
- [x] Construida (todas las tareas con commit, 2026-10-17)
- [x] Validada en navegador (2026-10-22)
- [x] Verificada: `pnpm verify` en verde, cada ★ con su prueba (2026-10-22)
- [ ] Revisada: veredicto APTO PARA FUSIONAR
- [x] Fusionada en `main` el 2026-10-17, por decisión del desarrollador antes de validar, verificar y revisar (ver notas)

## Notas

- 2026-10-17 · El desarrollador pidió construirla y publicarla ya, con `/f-verify` y `/f-review` en cola junto con los de la 002. En cola, en este orden:
  1. 002: el contraste del mensaje rojo sobre la tarjeta pálida (hallazgo 3 de la segunda revisión) y la tercera vuelta del `revisor`.
  2. 006: `/f-verify 006` (`comprobar-006.ts` con los ★ 1 a 10) y `/f-review 006`.
- T1 y T2: las pruebas se escribieron primero y se vieron fallar (módulo inexistente). En la de T2 se corrigieron los montos "1.500" y "1.000", que la app lee como 1,50 y 1,00 (decisión de la 004: el punto es decimal).
- T3: `idDeReferencia` en `src/lib/captura.ts`, con su prueba (falló antes). El plan se pide a `src/lib` con lo leído dentro de la transacción; las filas importadas o de demostración conservan su `origen` y su referencia. Un gasto sin captura no puede pasar a "vendiendo" (la venta no quedaría enlazada): lo dice en el campo de vendidos. `guardian-datos` lanzado sobre T3.
- T4 a T6: `CamposGasto` exportado de la captura con `textoBoton`, `conAntesYDespues`, `conNuevaCategoria` y `ocultos`; la captura no cambia sin ellos. En la rama sin sesión de la acción del ingreso, la función que lee el formulario se llama `valoresDe`, la que admite la regla de estructura.
- Recorrido de punta a punta (2026-10-17) en Edge sin ventana, contra el servidor de desarrollo y la base local, con «Cuadra con los sobres» en `/cuentas` después de cada paso (30 de 30):
  - gasto vendiendo USDT por la captura; editar tasa a 250 y vendido a 12 → venta `1200|300000|250.0000` y gasto `VES|210000|840`; pasar a dólares → `USDT|500|500` sin venta; volver a vendiendo → venta creada con la referencia de la captura; borrar desde el `<dialog>` ("Se borran el gasto de 2.100,00 Bs y la venta de 10,00 USDT.") → no queda ninguna fila de la captura;
  - ingreso de la demo: subir 100 → Por asignar +100 e "Ingreso actualizado"; bajar 131 con Por asignar en 130 → "Por asignar tiene 130,00; para bajar 131,00, borra el ingreso con su reparto y regístralo de nuevo" sin guardar; volver al monto original;
  - sin JavaScript, `?borrar=1` borra y vuelve a `/movimientos?borrado=1`;
  - la base termina con los mismos 121 movimientos.
- Pendiente para `/f-verify 006`: borrar un ingreso con reparto por la pantalla (con sobres en negativo y con "Por asignar" que no alcanza), carreras con el reparto, y la prueba `src/app` de que las acciones nuevas pasan por `conFallas` (la de la 002 ya las recorre).
- T3, `guardian-datos` (2026-10-17): **SEGURO DE APLICAR**. En copias de la base: el cuadre en cada paso, 5 de 5 sin nada a medias al forzar fallas a mitad de transacción, y 20 rondas por par de carreras (editar o borrar un ingreso contra repartir, prestar y apartar; dos ediciones del mismo gasto; editar contra borrar) sin "Por asignar" en negativo. Con el mutante sin candado quedó en −1000 en 20 de 20. Hallazgos:
  1. **Baja, defensa:** el escritor copiaba el plan entero en el `set` y usaba los ids del plan. **Corregido:** campo por campo (nunca el tipo, el origen, la referencia ni el sobre destino), con los ids leídos bajo el bloqueo y el tipo de cada fila comprobado.
  2. **Baja, futuro:** editar o borrar un movimiento de una cuenta archivada con saldo 0 descuadra. Hoy nada archiva cuentas ni sobres; queda para la observación 3.
  3. **Baja:** un id mayor que el de un `integer` daba 500. **Corregido:** `movimientoParaEditar` y los escritores lo tratan como inexistente.
  4. **Info:** una referencia con el UUID en mayúsculas (solo por SQL o un importador) no encuentra su venta. Va al importador.
  5. **Info:** el mensaje del ingreso dice siempre "Por asignar"; un `tipo` cambiado en el formulario de borrar responde "Ya estaba borrado" sin tocar nada; un gasto con venta que venga del chat (fase 2) necesitará su propio enlace.
  - Tras los arreglos: 43 de 43 unitarias y el recorrido de punta a punta de nuevo en verde.
- **Fusión adelantada (2026-10-17).** El desarrollador pidió construirla y publicarla ya: "haz el desarrollo ya y súbelo que lo necesito; recuerda anotar y hacer las pruebas después". Se fusionó con `pnpm verify` en verde, el recorrido de punta a punta en verde y `guardian-datos` SEGURO DE APLICAR, sin validación en navegador del desarrollador, sin `/f-verify` y sin `/f-review`. Quedan en cola, en este orden: la validación del desarrollador en su navegador, `/f-verify 006` y `/f-review 006`.
- **/f-verify (2026-10-22), sobre `main`.** Una prueba por criterio ★, escrita desde su texto; las puras de la construcción (`src/lib/editar-gasto.test.ts` y `editar-ingreso.test.ts`) siguen cubriendo los planes. Lo nuevo:
  - `src/app/(con-sesion)/movimientos/[id]/valores.criterios.test.ts` (6 pruebas): ★ 8, solo un gasto o un ingreso enlaza a su edición (un pago o un cobro enlaza para deshacerse, por la spec 007); ★ 10, "Ya estaba borrado"; criterio 11, los avisos y que nunca se vuelve a otro sitio.
  - `scripts/comprobar-006.ts`, contra la base local con los datos de demostración, que deja como estaba: 63 de 63 ✓.
    - ★ 1: el cuadre después de cada paso y la base igual al terminar.
    - ★ 2: monto, cuenta, sobre, categoría, fecha y nota en la misma fila; lo de antes recupera y lo nuevo baja; monto cero, fecha de mañana y una cuenta en bolívares se rechazan sin tocar la fila.
    - ★ 3: la misma venta se actualiza (9500 USDT, 4.750 Bs, tasa 50); se borra al pasar a bolívares del saldo o a dólares; se crea al volver a vender, con la referencia de la misma captura; el gasto conserva su id.
    - ★ 4 y ★ 5: el ingreso cambia en su fila, la diferencia entra en Por asignar y el reparto no cambia; "Por asignar tiene 20,00; para bajar 50,00, borra el ingreso con su reparto y regístralo de nuevo" sin cambiar nada; cinco carreras de una baja contra un reparto con 20 en Por asignar: siempre gana uno solo y nunca baja de 0.
    - ★ 6 y ★ 7: borrar se lleva la venta o el reparto y los saldos vuelven a lo de antes; "Por asignar tiene 30,00; le faltan 70,00" sin borrar; la confirmación avisa "Planes quedará en −28,00" y al borrar queda así.
    - ★ 8: transferencia, reasignación, pago, préstamo y cobro no se abren; editar o borrar por su id responde "no existe" sin tocar nada; ids imposibles tampoco; un gasto sin captura no se pasa a vendiendo y en dólares cambia solo él.
    - ★ 9: si la venta no se puede escribir (cuenta inexistente), el gasto tampoco cambia; tres pares de ediciones a la vez nunca mezclan el gasto de una con la venta de otra. La sesión y `conFallas` los vigilan `src/app/sesion.criterios.test.ts`, `src/app/fallas.criterios.test.ts` (ahora sobre todo `src/app`) y `comprobar-002-servidor`, que recorre todas las acciones del build sin sesión.
    - ★ 10: la misma edición de un gasto y de un ingreso dos veces deja la fila y los saldos iguales; borrar lo ya borrado responde "no existe".
  - `pnpm humo` con sesión: `/movimientos/999999`, `/movimientos/abc` y `/movimientos/0` → 404 (★ 8, la página).
  - `pnpm verify --forzar`: `Tests  938 passed (938)`, `✓ subida (7.3 s)`, `✓ humo: todo responde como debe.`, `✓ verify:full en verde en 48.4 s. Árbol sellado.`
