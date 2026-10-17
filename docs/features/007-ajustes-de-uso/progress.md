# 007 · Progreso

Rama: `feat/007-ajustes-de-uso`. Spec: `spec.md`.

## Tareas

- [x] T1 · (2026-10-17) `src/lib/mover.ts` y `src/lib/etiquetas.ts`, con su prueba mínima primero.
- [x] T2 · (2026-10-17) Deshacer un pago o un cobro: escritor con candados, `/movimientos/[id]` para esos tipos y las filas del historial de la deuda enlazadas (criterios 1 a 3).
- [x] T3 · (2026-10-17) Etiquetas en `/movimientos`: filtro en las consultas, las píldoras y el total (criterios 4 a 6).
- [x] T4 · (2026-10-17) `/nuevo/mover`: escritor con candado, acción con `conFallas`, confirmación de Inversión y enlaces desde Registrar y `/sobres` (criterios 7 a 9).
- [x] T5 · (2026-10-17) Plan, diseño y observaciones.

## Validación en navegador

-

## Etapas

- [x] Spec escrita a partir del pedido del desarrollador (2026-10-17)
- [x] Construida (todas las tareas con commit, 2026-10-17)
- [ ] Validada en navegador
- [ ] Verificada: `pnpm verify` en verde, cada ★ con su prueba
- [ ] Revisada: veredicto APTO PARA FUSIONAR
- [x] Fusionada en `main` el 2026-10-17, por pedido del desarrollador antes de validar, verificar y revisar (ver notas)

## Notas

- 2026-10-17 · El desarrollador pidió los tres arreglos ya, con las pruebas anotadas para después. En cola, en este orden: tercera revisión de la 002 (se cortó al reiniciar la sesión), `/f-verify` y `/f-review` de la 006, y `/f-verify` y `/f-review` de la 007.
- T2: `deshacerPagoOCobro` en `src/db/guardar-deudas.ts` toma el candado de la deuda y, en un cobro, después el de "Por asignar": el mismo orden en todas partes (ningún camino toma el del reparto y luego el de la deuda).
- T3: la etiqueta se lee aparte con `leerEtiqueta`, sin tocar `Filtros` ni las pruebas de la 003, y viaja en `enlace()` de la página. La lista de etiquetas es una consulta más (`etiquetasDelPeriodo`), sobre las notas con #.
- T4: `src/db/mover.ts` con el candado del origen, como apartar; el reintento se reconoce antes de mirar el saldo. "Mover" de Registrar lleva ahora a `/nuevo/mover`.
- Recorrido de punta a punta (2026-10-17) en Edge sin ventana contra el servidor de desarrollo y la base local, con «Cuadra con los sobres» tras cada paso (29 de 29): mover 10 de Gastos del mes a Familia y de vuelta; pasar del saldo del origen, rechazado; desde Inversión, la advertencia sin mover y luego "Sí, mover de Inversión"; un gasto con "#Prueba007", su píldora, el filtro "#prueba007 · 3,00" y una etiqueta inválida que no filtra; registrar y deshacer un cobro de Carlos y un pago a Papás desde su fila del historial, con "Deshecho" al volver. La base terminó con sus 121 movimientos.
- **Fusión adelantada (2026-10-17)**, por pedido del desarrollador ("arréglalo ya, sin perder tiempo en pruebas; anota las pruebas para después"): con `pnpm verify` en verde y el recorrido, sin validación del desarrollador, `/f-verify` ni `/f-review`. En cola para `/f-verify 007`: deshacer un cobro ya repartido (Por asignar que no alcanza), carreras de deshacer contra repartir y de mover contra repartir, y `scripts/comprobar-007.ts` con los ★.
