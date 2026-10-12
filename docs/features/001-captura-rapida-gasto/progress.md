# 001 · Progreso

Rama: `feat/001-captura-rapida-gasto`. Spec: `spec.md`.

## Tareas

Cada tarea cabe en 30 a 60 minutos y termina en verde con un commit. Se marca con la fecha al cerrarla.

- [x] T1 · (2026-10-11) `src/lib/dinero.ts`: `aTasa`, `bolivaresDesdeUsd`, `usdDesdeBolivares`, `formatearTasa`. Pruebas primero (criterios 6 y 7), verlas fallar, implementar.
- [x] T2 · (2026-10-11) `src/lib/gastos.ts`: `prepararGasto` para los tres casos con los números exactos de los criterios 1 a 4, el mínimo de 1 centavo del 7 y los errores de 5 y 6; `sobreSugerido` (8). `src/lib/fechas.ts`: `hoyEnCaracas` y `fechaValida` (11). Pruebas primero.
- [x] T3 · (2026-10-11) `src/db/consultas.ts`: categorías de gasto por uso en 90 días, cuentas activas con `es_propia`, sobres aptos para gasto, última cuenta propia en dólares usada en un gasto. `src/db/movimientos.ts`: `registrarMovimientos` en transacción. Lanzar `guardian-datos` antes de dar por cerrada.
- [ ] T4 · `src/app/nuevo/gasto/acciones.ts`: `registrarGasto` con zod, confirmación de Inversión, revalidación de `/`, `/movimientos`, `/sobres`, `/cuentas` y estado de éxito con el resumen.
- [ ] T5 · `/cuentas`: el total y el cuadre suman todas las cuentas activas, también la de la prima, que conserva su marca (criterio 16).
- [ ] T6 · Piezas `CampoMonto` y `SelectorPildoras` en `src/components/formulario.tsx`, con radios nativos y la elegida en `palido`; tono `palida` en `Pildora`.
- [ ] T7 · Pantalla `/nuevo/gasto` en móvil: cabecera con píldoras de tipo, formulario completo en el orden de la spec, estado de éxito con "Registrar otro" e "Ir al inicio", foco y teclado numérico.
- [ ] T8 · Escritorio: `TarjetaPalida` "Antes y después" con saldos del sobre y la cuenta, actualizada al cambiar monto, cuenta o sobre. Enlaces del "+", de "Registrar movimiento" y del mosaico "Gasto" a la nueva ruta.
- [ ] T9 · `pnpm capturas -- /nuevo/gasto /cuentas` en claro y oscuro, comparar con las referencias y la sección "Pantallas"; cronometrar un gasto en dólares desde el celular; ajustar.
- [ ] T10 · Documentos: ADR nuevo "la cuenta de la prima cuenta en el cuadre" (y la tasa en diezmilésimas) con `/f-adr`; invariante en el plan (sección 4) y en `CLAUDE.md`; plan (fase 1: casilla del formulario de captura); diseño (piezas nuevas y tono `palida`); observaciones si cambió algo.

## Validación en navegador

El desarrollador anota aquí, con fecha, qué pantallas miró y en qué ancho. Sin esta nota no se pasa a `/f-verify`.

-

## Etapas

- [x] Spec leída y corregida por el desarrollador (2026-10-11)
- [ ] Construida (todas las tareas con commit)
- [ ] Validada en navegador
- [ ] Verificada: `pnpm verify` en verde, cada ★ con su prueba
- [ ] Revisada: veredicto APTO PARA FUSIONAR
- [ ] Fusionada en `main` el AAAA-MM-DD

## Notas

Lo que se aprendió, lo que quedó fuera y por qué.

- 2026-10-11 · Revisión de la spec antes de construir. Corregido: el gasto del criterio 2 vale 868 centavos, no 869 (doble redondeo). Decidido con el desarrollador: se permite gastar desde la cuenta de la prima y su saldo entra en el cuadre (criterio 16); la forma de pago empieza siempre en Dólares; montos sin separador de miles; "hoy" en hora de Caracas; un gasto en Bs que vale menos de medio centavo se guarda con 1 centavo; se acepta la diferencia cambiaria de la cuenta Bolívares.
- 2026-10-11 · T2 sumó dos funciones puras que la spec no nombraba y la construcción necesita: `tasaDecimal` (la tasa como el texto `"241.8000"` que guarda `numeric(14,4)`) y `diaAnterior` (el atajo "Ayer"). `prepararGasto` recibe `hoy` como segundo argumento y devuelve todos los errores por campo a la vez.
- 2026-10-11 · `guardian-datos` sobre T3: APTO CON CAMBIOS. Atendido ya: `aCentavos` y `aTasa` leían con `Number`, así que "1e3" valía 1.000 y "0x10" valía 16; ahora solo aceptan cifras y un decimal, y redondean el tercer decimal sin flotantes ("1.005" → 101). La cuenta de respaldo ya no depende solo del nombre "Binance". `registrarMovimientos` es un solo INSERT, atómico por sí mismo, sin BEGIN ni COMMIT aparte; un lote con una fila inválida sigue sin dejar ninguna fila. Queda como condición:
  - **T4**: el `check` de la base solo valida la forma. La acción acepta `sobreId` solo si está en `sobresParaGasto()` y `categoriaId` solo si está en `categoriasDeGastoPorUso()`. Lee las cuentas de `saldosPorCuenta()` (activas), con la moneda de la base y no del formulario, y la cuenta Bolívares como la cuenta VES activa. El botón se desactiva mientras se envía (doble toque).
  - **T5 y T10**: `saldosPorCuenta` y `saldosPorSobre` filtran por activa/activo. Una cuenta o un sobre desactivado con saldo descuadra. El ADR decide entre sumar todo sin filtrar o "solo se desactiva con saldo cero". T10 también corrige los comentarios de `src/db/schema.ts` sobre "cuentas propias" y "no cuenta en los sobres".
  - **Antes de T7**: los gastos que se guarden al validar en el navegador llevan `origen = manual` y ninguna referencia, y `db:demo:limpiar` no los borra. En la base local, que hoy solo tiene filas `demo-*`, se borran al terminar la validación con `delete from movimientos where origen = 'manual' and referencia_externa is null`. Nunca en una base con datos reales.
  - **Para `/f-audit`**: repetir la prueba del lote inválido contra el pooler de Supabase (puerto 6543). Además, `src/db/semilla-demo.ts` usa `Math.round(usd * tasa)` y `toFixed` fuera de `dinero.ts`.
