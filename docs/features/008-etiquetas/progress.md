# 008 · Progreso

Rama: `feat/008-etiquetas`. Spec: `spec.md`.

## Tareas

- [x] T1 · (2026-10-17) `src/lib/etiquetas.ts` (nombre, clave e id del filtro) con su prueba primero; quitar lo de # en la nota de la 007.
- [x] T2 · (2026-10-17, migración generada; se aplica tras el guardián) Esquema: tabla `etiquetas` y `movimientos.etiqueta_id` con su check; `pnpm db:generate`, `guardian-datos` y `pnpm db:migrate`.
- [x] T3 · (2026-10-17) `src/db/etiquetas.ts`: las etiquetas, buscar o crear por clave; `baseMovimientos` con la etiqueta; el filtro y las etiquetas del periodo con su total.
- [x] T4 · (2026-10-17) `SelectorEtiqueta` y su uso en la captura de gasto, la de ingreso y al editar (006), con las acciones.
- [x] T5 · (2026-10-17) `/movimientos`: píldoras, filtro y total; la etiqueta en las filas.
- [ ] T6 · Plan, diseño y observaciones.

## Validación en navegador

-

## Etapas

- [x] Spec escrita con la maqueta del desarrollador (2026-10-17)
- [ ] Construida (todas las tareas con commit)
- [ ] Validada en navegador
- [ ] Verificada: `pnpm verify` en verde, cada ★ con su prueba
- [ ] Revisada: veredicto APTO PARA FUSIONAR
- [ ] Fusionada en `main` el AAAA-MM-DD

## Notas
