# 006 · Progreso

Rama: `feat/006-editar-movimientos`. Spec: `spec.md`.

## Tareas

Cada tarea cabe en 30 a 60 minutos y termina en verde con un commit. Se marca con la fecha al cerrarla.

- [x] T1 · (2026-10-17) `src/lib/editar-gasto.ts` con su prueba primero: de las filas guardadas y la entrada nueva, qué se actualiza, qué se crea y qué se borra en cada cambio de forma de pago; el cuadre antes y después con `saldosTras` (criterios 1 a 3).
- [ ] T2 · `src/lib/editar-ingreso.ts` con su prueba primero: la diferencia de monto, si "Por asignar" alcanza, y lo que devuelve cada sobre al borrar con el reparto (criterios 4, 5 y 7).
- [ ] T3 · `src/db/editar-movimientos.ts`: leer un gasto o un ingreso con lo enlazado por su captura; editar y borrar en una transacción, los ingresos con el candado de "Por asignar". `guardian-datos` antes de usarlo.
- [ ] T4 · `/movimientos/[id]` para un gasto: el formulario de la captura en modo edición, sus acciones con `conFallas`, y "Borrar" con su confirmación (criterios 2, 3, 6, 9 y 10).
- [ ] T5 · `/movimientos/[id]` para un ingreso: su formulario, la línea del reparto, sus acciones y "Borrar" (criterios 4, 5, 7, 9 y 10).
- [ ] T6 · `FilaMovimiento` con `href`, en `/movimientos` y en el inicio; el 404 para lo que no es gasto ni ingreso; el aviso al volver (criterios 8, 11 y 12). Capturas en móvil y escritorio, claro y oscuro.
- [ ] T7 · Plan, `docs/diseno.md` y observaciones al día.

## Validación en navegador

El desarrollador anota aquí, con fecha, qué pantallas miró y en qué ancho. Sin esta nota no se pasa a `/f-verify`.

-

## Etapas

- [x] Spec leída y aprobada por el desarrollador, sin cambios (2026-10-17)
- [ ] Construida (todas las tareas con commit)
- [ ] Validada en navegador
- [ ] Verificada: `pnpm verify` en verde, cada ★ con su prueba
- [ ] Revisada: veredicto APTO PARA FUSIONAR
- [ ] Fusionada en `main` el AAAA-MM-DD

## Notas

- 2026-10-17 · El desarrollador pidió construirla y publicarla ya, con `/f-verify` y `/f-review` en cola junto con los de la 002. En cola, en este orden:
  1. 002: el contraste del mensaje rojo sobre la tarjeta pálida (hallazgo 3 de la segunda revisión) y la tercera vuelta del `revisor`.
  2. 006: `/f-verify 006` (`comprobar-006.ts` con los ★ 1 a 10) y `/f-review 006`.
