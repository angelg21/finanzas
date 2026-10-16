# 005 · Progreso

Rama: `feat/005-deudas-y-prestamos`. Spec: `spec.md`.

## Tareas

Cada tarea cabe en 30 a 60 minutos y termina en verde con un commit. Se marca con la fecha al cerrarla. De la T1 a la T12 es "lo que debo"; la T13 y la T14, "lo que me deben". Si la feature se parte en dos, se corta ahí.

- [ ] T1 · `src/lib/saldos.ts` con sus pruebas, viéndolas fallar primero (criterio 9):
  - `efectoDe(tipo)` exhaustivo para los siete tipos;
  - `saldosTras` sale de `gastos.ts` y usa `efectoDe`;
  - la prueba del invariante con los siete tipos.
- [ ] T2 · `src/lib/deudas.ts` con sus pruebas, viéndolas fallar primero (criterios 1 a 3, 6, 7 y 16):
  - `validarDeuda`, `pendienteDe` y `estadoDe`;
  - `prepararPago` y `montoInicialMinimo`;
  - las referencias `-deuda` y `-pago` en `captura.ts`.
- [ ] T3 · `src/lib/cuota-deudas.ts` con sus pruebas, viéndolas fallar primero: `cuotaDeDeudas` con el caso real, su seguimiento, lo apartado, vencidas, sin fecha y el cambio de año (criterio 11). En `reparto.criterios.test.ts`, la regla calculada de Deudas antes de los fijos y el ejemplo de 1.200,00 (criterio 12).
- [ ] T4 · `src/lib/liquidez.ts` con sus pruebas, viéndolas fallar primero: `avisosDeLiquidez` con los tres estados, el acumulado por cuenta, el orden por fecha y los textos (criterio 14).
- [ ] T5 · Esquema y migración (criterio 8):
  - los enums, la tabla `deudas`, `movimientos.deuda_id` y el check reescrito, comparando como texto;
  - `pnpm db:generate`, aplicada primero en una base local vacía y después en la de siempre;
  - revisión de `guardian-datos` antes de aplicarla;
  - ADR 0012 con `/f-adr`: movimientos propios para deudas y valores de enum que no se pueden quitar.
- [ ] T6 · Consultas y semilla (criterios 9, 10 y 18):
  - `saldosPorSobre`, `saldosPorCuenta` y `saldoDeSobre` cuentan los tipos nuevos;
  - `medidasPorSobre` mide Deudas;
  - `movimientos-del-periodo` los pone en Mover;
  - las lecturas de `src/db/deudas.ts`;
  - el sobre Deudas en `seed.ts`.

  Revisión de `guardian-datos`.

- [ ] T7 · Escrituras de "lo que debo" en `src/db/deudas.ts` (criterios 1, 3, 6, 7, 13 y 16):
  - registrar, editar y borrar, con `pg_advisory_xact_lock(5, deudaId)`;
  - pagar, con candado, nueva comprobación del pendiente y el reintento reconocido antes;
  - apartar, con `pg_advisory_xact_lock(3, sobreOrigenId)`.

  Revisión de `guardian-datos`.

- [ ] T8 · Deudas en el reparto (criterio 12):
  - `datosDelReparto` inyecta la regla calculada;
  - la pista en `TarjetaReparto`;
  - `/sobres/reglas` la muestra en solo lectura;
  - `reglaEditable` y `guardarReglas` la dejan fuera.
- [ ] T9 · `/deudas` en móvil y escritorio, con hero, regla de uso, Debo y avisos (criterios 10, 14, 17 y 21):
  - "Deudas" en el menú y en `tituloDe`;
  - el tono nuevo y el icono de `IconoSobre` para `deudas`, con su prueba de paleta.
- [ ] T10 · `/deudas/nueva` y `/deudas/[id]/editar`, con un formulario compartido, `SelectorFecha` en su variante `futura` y "Borrar" sin movimientos (criterios 1 y 16).
- [ ] T11 · `/deudas/[id]` con el pago, el aviso "Deudas quedará en …", el historial y el aviso de liquidez (criterios 3 y 14). Además, los tipos nuevos en `FilaMovimiento`, en la pestaña Mover y en `/sobres/[id]` (criterio 18).
- [ ] T12 · `/deudas/apartar` con su acción (criterio 13).
- [ ] T13 · "Lo que me deben" (criterios 4, 5, 7 y 15):
  - en `src/lib/deudas.ts`, `prepararPrestamo`, `prepararCobro` y `patrimonioNeto`, con sus pruebas, viéndolas fallar primero, y las referencias `-prestamo` y `-cobro`;
  - las escrituras de prestar (deuda y movimiento en una transacción) y cobrar, con candado.

  Revisión de `guardian-datos`.

- [ ] T14 · `/deudas/prestar`, el cobro en `/deudas/[id]` con el enlace "Repartir", la lista "Me deben" en `/deudas` y el patrimonio neto en `/cuentas` (criterios 4, 5, 15 y 21).
- [ ] T15 · Demo, humo y comprobación (criterios 9 y 22):
  - `semilla-demo.ts` con las deudas `demo-deuda-*` al final y la limpieza en orden de FK;
  - `scripts/humo.mjs` con las rutas nuevas y un 404;
  - `scripts/comprobar-005.ts` contra la base local, dejándola como estaba;
  - capturas de `/deudas`, `/deudas/[id]`, `/deudas/nueva`, `/deudas/prestar`, `/deudas/apartar`, `/cuentas` y `/nuevo/ingreso` en los dos anchos y temas.
- [ ] T16 · Actualizar plan, diseño y observaciones:
  - el plan: Deudas como tipo propio, el pendiente calculado y el módulo hecho;
  - `docs/diseno.md`: las pantallas, `SelectorFecha` `futura`, el tono de Deudas y los iconos de los tipos nuevos;
  - la observación 11, con lo que quede pendiente.

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

- Exploración previa (subagente, 2026-10-15):
  - un tipo de movimiento nuevo se ignora sin aviso en todas las sumas de SQL, y `saldosTras` lo trata como reasignación;
  - el check de forma no tiene `else`, así que un tipo que no esté listado pasa;
  - Postgres no deja usar en la misma transacción un valor de enum recién añadido (55P04), y en producción la 0004 sigue pendiente;
  - "Mover" no existe: no hay pantalla de transferencias ni de reasignaciones libres;
  - nada calcula hoy una cuota por fecha: `fechaObjetivo` solo se muestra.
