# 004 · Progreso

Rama: `feat/004-ingresos-y-reparto`. Spec: `spec.md`.

## Tareas

Cada tarea cabe en 30 a 60 minutos y termina en verde con un commit. Se marca con la fecha al cerrarla.

- [x] T1 (2026-10-14) · `src/lib/reparto.ts` con sus pruebas, viéndolas fallar primero: `proponerReparto` con suma exacta, fijos una vez al mes, porcentajes por mayor residuo, topes con redistribución y los dos cobros del ejemplo (criterios 1 a 5).
- [ ] T2 · `src/lib/ingresos.ts` con sus pruebas, viéndolas fallar primero (criterios 6 a 9):
  - `prepararIngreso` y `validarAsignaciones`;
  - las referencias de captura de ingreso y reasignación en `captura.ts`;
  - `saldosTras` ampliado a ingreso y reasignación, con la prueba del invariante.
- [ ] T3 · `src/lib/reglas.ts` con sus pruebas, viéndolas fallar primero: `validarReglas`, con porcentajes con decimales a puntos base, suma de 100 % y rangos (criterio 11).
- [ ] T4 · Migración con el check `reglas_reparto_porcentaje_maximo` (`pnpm db:generate` y `pnpm db:migrate`) y consultas de `src/db/reparto.ts`:
  - reglas con su sobre, tope y saldo;
  - lo recibido en el mes desde "Por asignar";
  - categorías de ingreso por uso, la última cuenta de ingreso y "Por asignar".

  Revisión de `guardian-datos` antes de aplicar la migración (criterio 12).

- [ ] T5 · Escrituras:
  - `registrarCaptura` generalizado a `captura-<uuid>-%`;
  - `repartirPorAsignar` con candado y nueva comprobación del saldo;
  - `guardarReglas` en una transacción.

  Revisión de `guardian-datos` (criterios 7, 10 y 11).

- [ ] T6 · `/nuevo/ingreso` en móvil (criterios 6 a 8 y 13):
  - página, `formulario-ingreso.tsx` con `useActionState`, `acciones.ts` con zod y sesión, y `registrar-con-fallas.ts`;
  - `TarjetaReparto`, con la propuesta recalculada en el cliente y los dos envíos sin JavaScript.
- [ ] T7 · Escritorio de `/nuevo/ingreso` (7 + 5) y los accesos: el mosaico del inicio, el de `/nuevo` y la píldora de la captura de gasto (criterios 15 y 16).
- [ ] T8 · `/sobres/repartir` con su acción, y los enlaces "Repartir" en el hero de `/sobres` y en el aviso del inicio (criterio 10).
- [ ] T9 · `/sobres/reglas` con su acción, y el enlace "Reglas de reparto" en `/sobres` (criterio 11).
- [ ] T10 · `scripts/comprobar-004.ts` contra la base local, con referencia `demo-comprobar-004-*` y dejando la base como estaba:
  - ingreso y reparto con "Cuadra" antes y después;
  - reintento sin duplicados;
  - dos repartos en paralelo sin pasarse del saldo.

  Capturas de las tres pantallas en los dos anchos y temas.

- [ ] T11 · Actualizar plan, diseño y observaciones:
  - `docs/diseno.md` con `TarjetaReparto` y las tres pantallas;
  - el plan: "Sobres con reglas de reparto y confirmación de un clic", hecho, y los ingresos;
  - la observación 1 (el flujo de ingreso por la prima) con lo que quede pendiente para la feature de cuentas.

## Validación en navegador

El desarrollador anota aquí, con fecha, qué pantallas miró y en qué ancho. Sin esta nota no se pasa a `/f-verify`.

-

## Etapas

- [x] Spec leída y aprobada por el desarrollador (2026-10-14)
- [ ] Construida (todas las tareas con commit)
- [ ] Validada en navegador
- [ ] Verificada: `pnpm verify` en verde, cada ★ con su prueba
- [ ] Revisada: veredicto APTO PARA FUSIONAR
- [ ] Fusionada en `main` el AAAA-MM-DD

## Notas

- Decisiones del desarrollador al especificar (2026-10-14):
  - los fijos se cubren una vez al mes;
  - se incluye la pantalla para editar las reglas.
- Exploración previa (subagente, 2026-10-14):
  - no existía nada del flujo de ingreso, y "Ingreso" en `/nuevo` no llevaba a ninguna parte;
  - el demo ya reparte el segundo cobro del mes solo a porcentajes;
  - las reglas sembradas (40 / 30 / 30 tras los fijos) no dan la tabla del plan.
