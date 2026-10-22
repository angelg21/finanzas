# 009 · Progreso

Rama: `feat/009-gastos-por-completar`. Spec: `spec.md`.

## Tareas

- [ ] T1 · `src/lib/por-completar.ts` con su prueba primero: validar un pendiente y preparar "completar varios" en las tres formas de pago, con el cuadre (criterios 1, 8 y 9).
- [ ] T2 · Esquema: tabla `gastos_por_completar` con sus checks; `pnpm db:generate`, `guardian-datos` y `pnpm db:migrate`.
- [ ] T3 · `src/db/por-completar.ts`: anotar (con reintento), listar, contar, descartar, completar uno y completar varios en una transacción que borra los pendientes (criterios 3, 6, 7, 9 y 10).
- [ ] T4 · `/nuevo/por-completar`, la tarjeta de Registrar y "Anotar sin monto" en la captura (criterios 2 y 3).
- [ ] T5 · `/por-completar` con descartar, y el aviso en el inicio y en Registrar (criterios 4 y 5).
- [ ] T6 · Completar uno: la captura de gasto con `?pendiente=` (criterios 6 y 7).
- [ ] T7 · `/por-completar/varios` (criterios 8 a 10).
- [ ] T8 · Plan, diseño y observaciones.

## Validación en navegador

-

## Etapas

- [ ] Spec leída y corregida por el desarrollador
- [ ] Construida (todas las tareas con commit)
- [ ] Validada en navegador
- [ ] Verificada: `pnpm verify` en verde, cada ★ con su prueba
- [ ] Revisada: veredicto APTO PARA FUSIONAR
- [ ] Fusionada en `main` el AAAA-MM-DD

## Notas
