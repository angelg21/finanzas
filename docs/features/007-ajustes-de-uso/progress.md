# 007 · Progreso

Rama: `feat/007-ajustes-de-uso`. Spec: `spec.md`.

## Tareas

- [x] T1 · (2026-10-17) `src/lib/mover.ts` y `src/lib/etiquetas.ts`, con su prueba mínima primero.
- [x] T2 · (2026-10-17) Deshacer un pago o un cobro: escritor con candados, `/movimientos/[id]` para esos tipos y las filas del historial de la deuda enlazadas (criterios 1 a 3).
- [x] T3 · (2026-10-17) Etiquetas en `/movimientos`: filtro en las consultas, las píldoras y el total (criterios 4 a 6).
- [x] T4 · (2026-10-17) `/nuevo/mover`: escritor con candado, acción con `conFallas`, confirmación de Inversión y enlaces desde Registrar y `/sobres` (criterios 7 a 9).
- [x] T5 · (2026-10-17) Plan, diseño y observaciones.

## Validación en navegador

- 2026-10-22, el desarrollador: recorrió la lista de pasos que el agente le dio para esta feature (lo que se ve en pantalla, sin carreras ni fallas de red, que van en `/f-verify`) y respondió "sí, está verificado". No dijo en qué ancho.

## Etapas

- [x] Spec escrita a partir del pedido del desarrollador (2026-10-17)
- [x] Construida (todas las tareas con commit, 2026-10-17)
- [x] Validada en navegador (2026-10-22)
- [x] Verificada: `pnpm verify` en verde, cada ★ con su prueba (2026-10-22)
- [ ] Revisada: veredicto APTO PARA FUSIONAR
- [x] Fusionada en `main` el 2026-10-17, por pedido del desarrollador antes de validar, verificar y revisar (ver notas)

## Notas

- 2026-10-17 · El desarrollador pidió los tres arreglos ya, con las pruebas anotadas para después. En cola, en este orden: tercera revisión de la 002 (se cortó al reiniciar la sesión), `/f-verify` y `/f-review` de la 006, y `/f-verify` y `/f-review` de la 007.
- T2: `deshacerPagoOCobro` en `src/db/guardar-deudas.ts` toma el candado de la deuda y, en un cobro, después el de "Por asignar": el mismo orden en todas partes (ningún camino toma el del reparto y luego el de la deuda).
- T3: la etiqueta se lee aparte con `leerEtiqueta`, sin tocar `Filtros` ni las pruebas de la 003, y viaja en `enlace()` de la página. La lista de etiquetas es una consulta más (`etiquetasDelPeriodo`), sobre las notas con #.
- T4: `src/db/mover.ts` con el candado del origen, como apartar; el reintento se reconoce antes de mirar el saldo. "Mover" de Registrar lleva ahora a `/nuevo/mover`.
- Recorrido de punta a punta (2026-10-17) en Edge sin ventana contra el servidor de desarrollo y la base local, con «Cuadra con los sobres» tras cada paso (29 de 29): mover 10 de Gastos del mes a Familia y de vuelta; pasar del saldo del origen, rechazado; desde Inversión, la advertencia sin mover y luego "Sí, mover de Inversión"; un gasto con "#Prueba007", su píldora, el filtro "#prueba007 · 3,00" y una etiqueta inválida que no filtra; registrar y deshacer un cobro de Carlos y un pago a Papás desde su fila del historial, con "Deshecho" al volver. La base terminó con sus 121 movimientos.
- **Fusión adelantada (2026-10-17)**, por pedido del desarrollador ("arréglalo ya, sin perder tiempo en pruebas; anota las pruebas para después"): con `pnpm verify` en verde y el recorrido, sin validación del desarrollador, `/f-verify` ni `/f-review`. En cola para `/f-verify 007`: deshacer un cobro ya repartido (Por asignar que no alcanza), carreras de deshacer contra repartir y de mover contra repartir, y `scripts/comprobar-007.ts` con los ★.
- **/f-verify (2026-10-22), sobre `main`.** Una prueba por criterio ★, escrita desde su texto:
  - ★ 1: `src/app/(con-sesion)/movimientos/[id]/valores.criterios.test.ts`, la fila de un pago o un cobro enlaza a `/movimientos/[id]` desde Movimientos o desde la deuda, y se vuelve a la deuda con "Deshecho". `comprobar-007`: el pago y el cobro se abren con su tipo, monto, persona y cuenta; ningún otro tipo, tampoco el préstamo, y deshacer por id otra cosa responde "no existe".
  - ★ 2 y ★ 3: `scripts/comprobar-007.ts`, contra la base local con los datos de demostración, que deja como estaba (33 de 33 ✓):
    - deshacer el cobro y el pago deja cuentas y sobres exactamente como antes de cada uno, y el préstamo y la deuda recuperan su pendiente (50 y 100); el cuadre, después de cada paso;
    - con 15 en Por asignar, deshacer un cobro de 20 responde "Por asignar tiene 15,00; le faltan 5,00" y no cambia nada;
    - una deuda pagada y un préstamo cobrado del todo vuelven a "abierta" con todo su pendiente;
    - cuatro carreras de deshacer un cobro contra un reparto con 20 en Por asignar: gana uno solo y nunca baja de 0; cuatro de deshacer un pago de 40 contra un pago de 70 preparado como si la deuda debiera 100: la deuda termina en 100 o en 30, nunca pagada de más.
  - ★ 6: lo reemplazó la spec 008 (etiquetas como entidad, `?etiqueta=` es su id); se verifica en su ★ 5.
  - ★ 7: `comprobar-007`: una reasignación de hoy de Planes a Gastos del mes por 10,00 con su nota; más que el saldo, la base vuelve a mirar y no guarda; justo el saldo sí y el origen queda en 0, y ahí ni 0,01; al mismo sobre o a uno que no existe, la base lo rechaza; cuatro pares de movimientos de 60 a la vez desde 100: solo cabe uno; cuatro carreras de mover desde Por asignar contra un reparto: gana uno. `src/lib/mover.test.ts` cubre los límites del formulario. `pnpm humo` con sesión: `/nuevo/mover` → 200.
  - ★ 8: `src/lib/mover.test.ts` ("★ 8 · desde Inversión pide confirmar, y solo con la confirmación sale la fila"); el texto de la confirmación está en `formulario-mover.tsx` y lo vio el desarrollador.
  - ★ 9: `comprobar-007`: el mismo id dos veces, después de que el primero vaciara el origen, devuelve lo guardado y no "sin saldo", con una sola fila. La sesión y `conFallas`: `src/app/sesion.criterios.test.ts`, `src/app/fallas.criterios.test.ts` y `comprobar-002-servidor`.
  - `pnpm verify --forzar`: `Tests  940 passed (940)`, `✓ subida (6.8 s)`, `✓ /nuevo/mover → 200`, `✓ verify:full en verde en 43.7 s. Árbol sellado.`
