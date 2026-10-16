# 005 · Progreso

Rama: `feat/005-deudas-y-prestamos`. Spec: `spec.md`.

## Tareas

Cada tarea cabe en 30 a 60 minutos y termina en verde con un commit. Se marca con la fecha al cerrarla. De la T1 a la T12 es "lo que debo"; la T13 y la T14, "lo que me deben". Si la feature se parte en dos, se corta ahí.

- [x] T1 (2026-10-15) · `src/lib/saldos.ts` con sus pruebas, viéndolas fallar primero (criterio 9):
  - `efectoDe(tipo)` exhaustivo para los siete tipos;
  - `saldosTras` sale de `gastos.ts` y usa `efectoDe`;
  - la prueba del invariante con los siete tipos.
- [x] T2 (2026-10-15) · `src/lib/deudas.ts` con sus pruebas, viéndolas fallar primero (criterios 1 a 3, 6, 7 y 16):
  - `validarDeuda`, `pendienteDe` y `estadoDe`;
  - `prepararPago` y `montoInicialMinimo`;
  - las referencias `-deuda` y `-pago` en `captura.ts`.
- [x] T3 (2026-10-15) · `src/lib/cuota-deudas.ts` con sus pruebas, viéndolas fallar primero: `cuotaDeDeudas` con el caso real, su seguimiento, lo apartado, vencidas, sin fecha y el cambio de año (criterio 11). En `reparto.criterios.test.ts`, la regla calculada de Deudas antes de los fijos y el ejemplo de 1.200,00 (criterio 12).
- [x] T4 (2026-10-15) · `src/lib/liquidez.ts` con sus pruebas, viéndolas fallar primero: `avisosDeLiquidez` con los tres estados, el acumulado por cuenta, el orden por fecha y los textos (criterio 14).
- [x] T5 (2026-10-15) · Esquema y migración (criterio 8):
  - los enums, la tabla `deudas`, `movimientos.deuda_id` y el check reescrito, comparando como texto;
  - `pnpm db:generate`, aplicada primero en una base local vacía y después en la de siempre;
  - revisión de `guardian-datos` antes de aplicarla;
  - ADR 0012 con `/f-adr`: movimientos propios para deudas y valores de enum que no se pueden quitar.
- [x] T6 (2026-10-15) · Consultas y semilla (criterios 9, 10 y 18):
  - `saldosPorSobre`, `saldosPorCuenta` y `saldoDeSobre` cuentan los tipos nuevos;
  - `medidasPorSobre` mide Deudas;
  - `movimientos-del-periodo` los pone en Mover;
  - las lecturas de `src/db/deudas.ts`;
  - el sobre Deudas en `seed.ts`.

  Revisión de `guardian-datos`.

- [x] T7 (2026-10-15) · Escrituras de "lo que debo" en `src/db/deudas.ts` (criterios 1, 3, 6, 7, 13 y 16):
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

- [x] Spec leída y aprobada por el desarrollador (2026-10-15), en una sola feature
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
- 2026-10-15 · T1: `efectoDe` da a cada tipo cuatro lados (sale o entra de cuenta, sale o entra de sobre). La cuenta de destino recibe `montoDestinoCentavos` si lo hay, o el monto, para todos los tipos que entran a una cuenta. En SQL hoy solo la transferencia usa `coalesce`; el ingreso suma `monto_centavos`. Ningún ingreso trae monto de destino, así que el resultado es el mismo, y la T6 escribe las sumas de SQL con la regla única.
- 2026-10-15 · T2: además de lo previsto, `cuentaParaPagar` (la cuenta que viene elegida), `avisoDelSobreDeudas` (la línea "Deudas tiene X; quedará en Y"), `resolverReintentoDeDeuda` para la fila de `deudas` y `deudaId` entre los campos que comparan un reintento de movimientos. En "me deben", `validarDeuda` ignora la cuenta prevista en vez de rechazarla: sin JavaScript, el formulario la envía igual.
- 2026-10-15 · T3: `reglaDeDeudas` convierte la cuota en una regla fija con orden menor que el de todas las demás (0 con las sembradas), así `proponerReparto` no cambia. Si Deudas empezó el mes en negativo, `apartado` es negativo y la cuota también lo repone, siempre que haya deudas con fecha.
- 2026-10-15 · T4, dos lecturas de la spec, las prudentes:
  - "en otra cuenta" compara la suma de las cuentas en dólares con lo acumulado de todas las deudas con cuenta prevista hasta esta, no solo las de su cuenta;
  - el "solo X" del texto es lo que queda en la cuenta prevista después de las deudas anteriores (en el ejemplo, 350,00 para Papás). El saldo entero diría "solo 600,00" para una deuda de 520,00.

  Además, lo que falta nunca pasa del pendiente de la deuda, y una cuenta prevista inactiva se trata como si no hubiera cuenta prevista: sin aviso. `formatearCifra` pasa a `dinero.ts`, compartida con `deudas.ts`.

- 2026-10-15 · T5, migración `0005_polite_sir_ram.sql`:
  - `guardian-datos`: APTA. Comparó la SQL con `generateMigration` (sin ediciones a mano) y la aplicó en una base vacía y en una copia con forma de producción (la 0004 revertida). Las 6 formas malas las rechaza el check; las de `deudas`, sus dos checks y el índice único. Hash revisado: `99dc3f23…df476e`.
  - Corrida propia: base desechable vacía, las 6 en una transacción; otra con 0000-0003 y luego 0004+0005 juntas, como producción. Sin 55P04. Enums con los valores nuevos al final, RLS en `deudas` y los 3 checks validados. Las dos borradas.
  - Base local: `pnpm db:migrate` aplicó la 0005 con el mismo hash. Las 118 filas quedan con `deuda_id` nulo.
  - El enum `tipo_movimiento` sale de `tiposDeMovimiento` (`src/lib/saldos.ts`), con el aviso de que solo se añade al final.
  - Las etiquetas y los iconos de los tipos nuevos ya están en `FilaMovimiento`, porque el mapa los exige para compilar: `BanknoteArrowUp` para el pago, `HandHelping` para el préstamo y `BanknoteArrowDown` para el cobro. Títulos, signo y círculo neutro son de la T11.
  - Pendiente para la T6, del guardián: los mapas por tipo de sobre (`page.tsx` del inicio, `/sobres`, `/sobres/[id]`, `icono-sobre.tsx`) son `Record<string, …>` y no tienen `deudas`; pasan a `Record<Sobre["tipo"], …>`.
  - Pendiente para la T7 y la T13: el check solo valida la forma. Que un pago apunte a una deuda "debo", salga de Deudas y desde una cuenta en dólares lo frena el escritor dentro del candado.
  - Sin probar: la imagen de Supabase 17.6. Al guardián se le negó `docker run` y no se intentó por otro camino. La base local es PG 17.11, y en la 002 un `ADD VALUE` ya corrió dentro de una transacción en esa imagen.
- 2026-10-15 · T6:
  - Las sumas de saldos (`saldosPorSobre`, `saldosPorCuenta`, `saldoDeSobre`) salen de `src/db/sumas-de-saldo.ts`, que arma cada CASE con `tiposCon(lado)` de `src/lib/saldos.ts`. Un tipo nuevo entra en todas a la vez.
  - Toda cuenta de destino recibe `coalesce(monto_destino, monto)`; ningún ingreso de la base local trae monto de destino.
  - `baseMovimientos` trae `deudaId` y `persona`. Las lecturas de deudas están en `src/db/deudas.ts`, y `pendientePorSentido` en `src/lib/deudas.ts`.
  - Deudas se mide contra lo que debo (`debidoCentavos` en `nivelDeSobre`). La semilla lo crea con orden 5, entre Ocasiones e Inversión, sin regla, y es idempotente.
  - Los mapas por tipo de sobre son `Record<Sobre["tipo"], …>`.
  - `guardian-datos`: APTA CON CAMBIOS. Con pago, préstamo, cobro y apartados, las sumas de SQL dan lo mismo que `saldosTras` y el cuadre se mantiene (585300 = 585300); con las filas de siempre, nada cambia de valor.
  - Arreglado del guardián:
    - H1: una deuda con datos rotos tumbaba el inicio, `/sobres` y el reparto. La medida ahora cae a "sin medida". Probado en una base desechable: el inicio y el reparto responden, y `deudasConPendiente` lanza.
    - H2: el error de `pendienteDe` llevaba la persona y la nota a los registros. Ahora no las vuelca, con su prueba.
  - Queda para la T8 y la T14 el mismo resguardo del H1 en la cuota y en el patrimonio. Para la T11, el H3: `/sobres/[id]` no pasa `debidoCentavos`, así que el nivel de Deudas difiere del de `/sobres`.
  - Para la T9: el tono de Deudas; hoy usa el de las metas.
  - Para la T7 y la T13: el escritor frena un pago a una deuda "me deben" (hoy se contaría como cobro).
  - Conexiones: el inicio abre 8 de las 10 de postgres-js, una más que antes.
  - **Pregunta abierta:** la captura de gasto ofrece todos los sobres activos menos "Por asignar", así que desde la T6 también ofrece Deudas. La spec dice que la captura no se toca. Hay que decidir si se quiere.
- 2026-10-15 · T7:
  - Las escrituras están en `src/db/guardar-deudas.ts` y las lecturas en `src/db/deudas.ts`, como `movimientos.ts` y `consultas.ts`; la spec decía un solo archivo.
  - La parte pura de apartar está en `src/lib/apartado.ts`, con sus pruebas: orígenes, monto hasta el saldo y la reasignación a Deudas.
  - `scripts/comprobar-005.ts` cubre lo que debo: registrar, apartar, pagar, dos pagos a la vez, reintentos, checks, editar y borrar. Todo en verde, y la base queda como estaba. La T13 y la T15 lo completan.
  - `guardian-datos`: APTA CON CAMBIOS. En 20 rondas de cada carrera (editar contra pagar, borrar contra pagar, apartar contra repartir), ningún pendiente quedó en negativo ni se rompió el cuadre.
  - Arreglado del guardián:
    - `editarDeuda` escribía cualquier campo de más, también el sentido y la referencia. Ahora el `set` va campo por campo, con su comprobación.
    - Pagar exige 1 a 1, y apartar, USD.
    - Registrar valida el id de captura, y registrar y editar exigen una cuenta prevista activa en dólares.
  - Para las acciones de la T11 y la T12:
    - buscar el reintento (`guardadasDeCaptura`) antes de `prepararPago` o `prepararApartado`, porque estos rechazan una deuda ya pagada o un origen sin saldo;
    - validar el id con `esIdCaptura` en zod;
    - leer las cuentas de la base;
    - la fecha del pago la valida solo `prepararPago`.
  - Para la T13: el cobro toma `(5, deudaId)`. Si alguna función toma dos candados, siempre en el mismo orden.
  - Aceptado: apartar contra un gasto del mismo sobre no comparte candado. El sobre puede quedar en negativo, como con el gasto solo.
