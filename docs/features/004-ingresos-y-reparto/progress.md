# 004 · Progreso

Rama: `feat/004-ingresos-y-reparto`. Spec: `spec.md`.

## Tareas

Cada tarea cabe en 30 a 60 minutos y termina en verde con un commit. Se marca con la fecha al cerrarla.

- [x] T1 (2026-10-14) · `src/lib/reparto.ts` con sus pruebas, viéndolas fallar primero: `proponerReparto` con suma exacta, fijos una vez al mes, porcentajes por mayor residuo, topes con redistribución y los dos cobros del ejemplo (criterios 1 a 5).
- [x] T2 (2026-10-14) · `src/lib/ingresos.ts` con sus pruebas, viéndolas fallar primero (criterios 6 a 9):
  - `prepararIngreso` y `validarAsignaciones`;
  - las referencias de captura de ingreso y reasignación en `captura.ts`;
  - `saldosTras` ampliado a ingreso y reasignación, con la prueba del invariante.
- [x] T3 (2026-10-14) · `src/lib/reglas.ts` con sus pruebas, viéndolas fallar primero: `validarReglas`, con porcentajes con decimales a puntos base, suma de 100 % y rangos (criterio 11).
- [x] T4 (2026-10-14) · Migración con el check `reglas_reparto_porcentaje_maximo` (`pnpm db:generate` y `pnpm db:migrate`) y consultas de `src/db/reparto.ts`:
  - reglas con su sobre, tope y saldo;
  - lo recibido en el mes desde "Por asignar";
  - categorías de ingreso por uso, la última cuenta de ingreso y "Por asignar".

  Revisión de `guardian-datos` antes de aplicar la migración (criterio 12).

- [x] T5 (2026-10-14) · Escrituras:
  - `registrarCaptura` generalizado a `captura-<uuid>-%`;
  - `repartirPorAsignar` con candado y nueva comprobación del saldo;
  - `guardarReglas` en una transacción.

  Revisión de `guardian-datos` (criterios 7, 10 y 11).

- [x] T6 (2026-10-14) · `/nuevo/ingreso` en móvil (criterios 6 a 8 y 13):
  - página, `formulario-ingreso.tsx` con `useActionState`, `acciones.ts` con zod y sesión, y `registrar-con-fallas.ts`;
  - `TarjetaReparto`, con la propuesta recalculada en el cliente y los dos envíos sin JavaScript.
- [x] T7 (2026-10-14) · Escritorio de `/nuevo/ingreso` (7 + 5) y los accesos: el mosaico del inicio, el de `/nuevo` y la píldora de la captura de gasto (criterios 15 y 16).
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
- T2 (2026-10-14): `aCentavos` lee "1.200" como 1,20 (sin coma, el punto es decimal; regla de la spec 001). En un ingreso, donde los montos pasan de mil, es fácil teclearlo así queriendo decir 1.200. No se cambia la regla en silencio: la propuesta de reparto se recalcula al escribir y el pie dice "Repartido 1,20 de 1,20", así que el error se ve antes de guardar. Si en la validación en navegador molesta, se decide aparte.
- T2: los montos de cada sobre se leen con `aCentavosExactos` (nuevo en `dinero.ts`), que rechaza fracciones de centavo en vez de redondearlas (criterio 8). El monto del ingreso sigue con `aCentavos`, como dice la spec.
- T4 (2026-10-14), `guardian-datos`: APTO. Migración `0004_fluffy_the_hood` aplicada en local (5 migraciones, el check existe, ninguna regla lo incumplía).
  - **Antes de `pnpm db:migrate:produccion`**, el desarrollador puede comprobar en el SQL Editor que no hay porcentajes mayores de 100 % (espera 0 filas) y que van 4 migraciones:
    `select r.id, s.nombre, r.tipo, r.valor from reglas_reparto r join sobres s on s.id = r.sobre_id where r.tipo = 'porcentaje' and r.valor > 10000;` y `select count(*) from drizzle.__drizzle_migrations;`.
    Si hubiera una, la migración falla entera con el código 23514 y no deja nada a medias.
  - El check no se difiere: pasar una regla de fijo a porcentaje exige cambiar `tipo` y `valor` en la misma sentencia (`guardarReglas` lo hace así).
  - "Recibido en el mes" suma lo bruto: si un día "Mover" devuelve dinero de un sobre a "Por asignar", lo devuelto seguirá contando como fijo cubierto. Se decide en la feature de Mover.
  - Con "Por asignar" inactivo, `datosDelReparto` le da saldo 0 (porque `saldosPorSobre` solo trae activos). La página no lo muestra: con "Por asignar" inactivo no deja registrar.
- T6 (2026-10-14): **sin JavaScript, los formularios con `conFallas` respondían en blanco**, también la captura de gasto desde la 002 (T12). Al responder un envío sin JavaScript, `useActionState` del servidor llama `$$IS_SIGNATURE_EQUAL` con la envoltura de `this`, y React solo reconoce la acción original: lanzaba "Tried to encode a Server Action from a different instance". Comprobado con el navegador sin ventana y scripts apagados: gasto e ingreso daban el error; con la firma atada a la acción original (`src/lib/fallas.ts`), los dos responden con su formulario. La aserción de `fallas.test.ts` que exigía copiar la firma tal cual se cambió por una que comprueba que delega en la original, y una prueba nueva fija el `this`. Toca la captura de gasto, pero solo para arreglar su envío sin JavaScript (criterio 13 de la 001); su camino con JavaScript no cambia.
- T5 (2026-10-14), `guardian-datos`: APTO CON CAMBIOS, aplicados.
  - Un reintento de reparto se reconoce dentro de la transacción, tras el candado y antes de mirar el saldo: si no, el reintento de un reparto que se llevó todo decía "no alcanza", y uno hacia otros sobres guardaba un segundo reparto (no chocaba con el índice: las referencias son por sobre).
  - `repartirPorAsignar` también rechaza listas vacías, filas sin la referencia de la captura y destinos inactivos (un sobre inactivo no sale en `saldosPorSobre` y descuadraría Cuentas).
  - `guardarReglas` lee los sobres editables y el de emergencia dentro de la transacción en vez de aceptarlos de fuera: así nunca desactiva la regla de un fondo (que el desglose no reactiva) ni pone el tope en otro sobre.
  - Informativo: `guardarReglas` y el desglose calculan `max(orden) + 1` con candados distintos y pueden repetir un orden; no cambia ningún monto (el empate lo decide `sobreId`).
  - Informativo: la relectura tras un choque ahora es un LIKE sin índice (24 ms con 500 mil filas); solo corre tras un choque o al repartir, nunca en la captura normal de un gasto.
