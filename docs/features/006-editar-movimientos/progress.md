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

-

## Etapas

- [x] Spec leída y aprobada por el desarrollador, sin cambios (2026-10-17)
- [x] Construida (todas las tareas con commit, 2026-10-17)
- [ ] Validada en navegador
- [ ] Verificada: `pnpm verify` en verde, cada ★ con su prueba
- [ ] Revisada: veredicto APTO PARA FUSIONAR
- [ ] Fusionada en `main` el AAAA-MM-DD

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
