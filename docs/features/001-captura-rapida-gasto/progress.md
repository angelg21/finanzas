# 001 · Progreso

Rama: `feat/001-captura-rapida-gasto`. Spec: `spec.md`.

## Tareas

Cada tarea cabe en 30 a 60 minutos y termina en verde con un commit. Se marca con la fecha al cerrarla.

- [ ] T1 · `src/lib/dinero.ts`: `aTasa`, `bolivaresDesdeUsd`, `usdDesdeBolivares`, `formatearTasa`. Pruebas primero (criterios 6 y 7), verlas fallar, implementar.
- [ ] T2 · `src/lib/gastos.ts`: `prepararGasto` para los tres casos con los números exactos de los criterios 1 a 4 y los errores de 5 y 6; `sobreSugerido` (8); `fechaValida` (11). Pruebas primero.
- [ ] T3 · `src/db/consultas.ts`: categorías de gasto por uso en 90 días, cuentas activas, sobres aptos para gasto, última cuenta usada. `src/db/movimientos.ts`: `registrarMovimientos` en transacción. Lanzar `guardian-datos` antes de dar por cerrada.
- [ ] T4 · `src/app/nuevo/gasto/acciones.ts`: `registrarGasto` con zod, confirmación de Inversión, revalidación de `/`, `/movimientos`, `/sobres`, `/cuentas` y estado de éxito con el resumen.
- [ ] T5 · Piezas `CampoMonto` y `SelectorPildoras` en `src/components/formulario.tsx`, con radios nativos y píldoras `palido`.
- [ ] T6 · Pantalla `/nuevo/gasto` en móvil: cabecera con píldoras de tipo, formulario completo en el orden de la spec, estado de éxito con "Registrar otro" e "Ir al inicio", foco y teclado numérico.
- [ ] T7 · Escritorio: `TarjetaPalida` "Antes y después" con saldos del sobre y la cuenta, actualizada al cambiar monto, cuenta o sobre. Enlaces del "+", de "Registrar movimiento" y del mosaico "Gasto" a la nueva ruta.
- [ ] T8 · `pnpm capturas -- /nuevo/gasto` en claro y oscuro, comparar con las referencias y la sección "Pantallas"; cronometrar un gasto en dólares desde el celular; ajustar.
- [ ] T9 · Actualizar plan (fase 1: casilla del formulario de captura), diseño (piezas nuevas), observaciones si cambió algo.

## Validación en navegador

El desarrollador anota aquí, con fecha, qué pantallas miró y en qué ancho. Sin esta nota no se pasa a `/f-verify`.

-

## Etapas

- [ ] Spec leída y corregida por el desarrollador
- [ ] Construida (todas las tareas con commit)
- [ ] Validada en navegador
- [ ] Verificada: `pnpm verify` en verde, cada ★ con su prueba
- [ ] Revisada: veredicto APTO PARA FUSIONAR
- [ ] Fusionada en `main` el AAAA-MM-DD

## Notas

Lo que se aprendió, lo que quedó fuera y por qué.
