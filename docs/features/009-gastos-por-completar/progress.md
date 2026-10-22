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

-

## Etapas

- [x] Spec leída y corregida por el desarrollador (2026-10-22: una venta por gasto al completar uno, una sola al completar varios, y la pregunta por el resto)
- [x] Construida (todas las tareas con commit, 2026-10-22)
- [ ] Validada en navegador
- [ ] Verificada: `pnpm verify` en verde, cada ★ con su prueba
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
