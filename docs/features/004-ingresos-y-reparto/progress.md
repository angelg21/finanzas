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
- [x] T8 (2026-10-14) · `/sobres/repartir` con su acción, y los enlaces "Repartir" en el hero de `/sobres` y en el aviso del inicio (criterio 10).
- [x] T9 (2026-10-14) · `/sobres/reglas` con su acción, y el enlace "Reglas de reparto" en `/sobres` (criterio 11).
- [x] T10 (2026-10-14) · `scripts/comprobar-004.ts` contra la base local, con referencia `demo-comprobar-004-*` y dejando la base como estaba:
  - ingreso y reparto con "Cuadra" antes y después;
  - reintento sin duplicados;
  - dos repartos en paralelo sin pasarse del saldo.

  Capturas de las tres pantallas en los dos anchos y temas.

- [x] T11 (2026-10-14) · Actualizar plan, diseño y observaciones:
  - `docs/diseno.md` con `TarjetaReparto` y las tres pantallas;
  - el plan: "Sobres con reglas de reparto y confirmación de un clic", hecho, y los ingresos;
  - la observación 1 (el flujo de ingreso por la prima) con lo que quede pendiente para la feature de cuentas.

## Validación en navegador

El desarrollador anota aquí, con fecha, qué pantallas miró y en qué ancho. Sin esta nota no se pasa a `/f-verify`.

- 2026-10-15: el desarrollador revisó las pantallas en el navegador y las dio por buenas sin anotar observaciones: `/nuevo/ingreso`, `/sobres/repartir`, `/sobres/reglas` y sus accesos, más los iconos de sobres, los últimos movimientos del inicio y los círculos de las cuentas. No detalló anchos.

## Etapas

- [x] Spec leída y aprobada por el desarrollador (2026-10-14)
- [x] Construida (todas las tareas con commit, 2026-10-14)
- [x] Validada en navegador (2026-10-15)
- [x] Verificada: `pnpm verify` en verde, cada ★ con su prueba (2026-10-15)
- [x] Revisada: veredicto APTO PARA FUSIONAR (2026-10-15)
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
- T8 (2026-10-14): sin JavaScript, repartir todo dejaba "Por asignar" en 0 y la página dejaba de montar el formulario, así que la respuesta no decía "Reparto guardado". El formulario se monta siempre y el estado vacío vive dentro de él. Comprobado en el navegador con los scripts apagados.
- T5 y T8 (2026-10-14), segunda medición de `guardian-datos`: APTO. Reintento igual, en vuelo o tras repartirlo todo da "ya estaba"; hacia otros sobres o con otro monto, "otra" sin filas nuevas; cinco repartos a la vez nunca pasan del saldo; `guardarReglas` deshace todo ante cualquier error y no toca fondos ni otros topes. Queda informativo: si un sobre se reactiva entre abrir `/sobres/reglas` y guardar, el envío no trae su campo y el guardado se rechaza con un error en un campo que la pantalla no muestra. Hoy ninguna pantalla reactiva sobres.
- T9 (2026-10-14): probado en el navegador con y sin JavaScript (95 % rechazado, guardar, recargar, volver a 40/30/30). Las reglas de la base local quedaron como las sembradas. `/sobres/reglas` y `/sobres/repartir` tienen su título en la barra de escritorio.
- T10 (2026-10-14): `pnpm exec tsx scripts/comprobar-004.ts` en verde, dos veces seguidas; deja la base con sus 118 movimientos demo y las reglas sembradas. Desvío de la spec: `registrarCaptura` y `repartirPorAsignar` exigen referencias `captura-<uuid>-…`, así que lo que pasa por ellas usa ids que empiezan por `0c040004` en vez de `demo-comprobar-004-*`; el guion los borra al terminar y, si una corrida se cortó, al empezar la siguiente. Capturas de `/`, `/nuevo`, `/sobres`, `/nuevo/ingreso`, `/sobres/repartir` y `/sobres/reglas` en los dos anchos y temas, en `capturas/`. Las filas que dejaron las pruebas en el navegador (20, todas `captura-*` de esta sesión) se borraron de la base local.
- 2026-10-15, **fuera del pipeline, por decisión del desarrollador**: los sobres pasan de iniciales a `IconoSobre` (observación 10). No está en la spec de la 004; va en esta rama, en su propio commit, para validarlo junto con ella. Toca `/sobres`, el inicio, `/sobres/[id]` y las filas de `TarjetaReparto`; `datosDelReparto` trae además el tipo y el nivel de cada sobre. `nivelDeSobre` y `pasoDeSobre` en `src/lib/sobres.ts` con sus pruebas; el mapa de tonos del anillo, que estaba repetido en el inicio y en `/sobres`, sale de ahí. `comprobar-004` sigue en verde.
- 2026-10-15, **fuera del pipeline, por decisión del desarrollador**: los últimos movimientos del inicio dejan `TarjetaMovimiento` (tarjetas menta, dos) y usan `FilaMovimiento`, como `/movimientos`: cinco, agrupados por día, en una tarjeta junto a Cuentas, solo en escritorio como antes. `TarjetaMovimiento` quedó sin uso y se quitó.
- 2026-10-15, **fuera del pipeline, por decisión del desarrollador**: las cuentas dejan las iniciales y usan `CirculoCuenta`, un círculo de color con icono como el de las categorías, según su tipo y su moneda (`src/lib/cuentas.ts`, con prueba). Binance en amarillo con ₿, Segunda billetera turquesa, Efectivo verde con $, Cuenta prima azul con un banco y Bolívares rojo con un billete. El amarillo es un token nuevo, `cuenta-cripto`, con el icono en pino porque en blanco no se lee (`paleta-cuentas.test.ts`). En `/cuentas` y en la tarjeta Cuentas del inicio.
- Verificación (2026-10-15): los 12 ★ tienen su prueba, escrita desde el texto del criterio.
  - ★ 1 a 5: `src/lib/reparto.criterios.test.ts`.
  - ★ 6 a 10: `src/lib/ingresos.criterios.test.ts`.
  - ★ 11: `src/lib/reglas.criterios.test.ts`.
  - Lo que solo se ve en la base (★ 7 en una sola sentencia, ★ 9 "Cuadra", ★ 10 con el candado, ★ 11 en una transacción y sin tocar movimientos, ★ 12 el check) lo comprueba `scripts/comprobar-004.ts`. Su salida: 20 ✓ y `✓ comprobar-004: todo en verde`, con la base en sus 118 movimientos demo antes y después.
  - Gates de `pnpm verify`:
    - `✓ tipos (2.9 s)`
    - `✓ lint (8.2 s)`
    - `✓ formato (4.1 s)`
    - `✓ estructura (0.1 s)`
    - `✓ unitarias (3.0 s)`: 27 archivos y 493 pruebas.
    - `✓ build (9.4 s)`
    - `✓ humo (3.5 s)`
    - `✓ verify:full en verde en 31.4 s. Árbol sellado.`
- Revisión (2026-10-15): `revisor`, **APTO PARA FUSIONAR** al primer intento; `guardian-datos`, **APTO** sobre `97437d7`, el único commit que tocó `src/db` sin pasar por él. Ninguno de los hallazgos bloquea:
  - "1.200" se guarda como 1,20 (la nota de T2). **Decidido por el desarrollador (2026-10-15): se queda así, el punto se lee como decimal.**
  - `/sobres/reglas`: el aviso "Reglas guardadas" sigue en pantalla mientras se vuelve a editar, aunque lo de la pantalla ya no sea lo guardado.
  - `/sobres/reglas`: los cinco grupos de radios tienen la misma leyenda "Regla"; el nombre del sobre queda fuera del `fieldset`, y un lector de pantalla no sabe de qué sobre es cada uno.
  - `sobresConNivel` lanza un error si un tope pasa de 2^53 o las partidas desbordan un bigint, y ese error tumba el ingreso y el reparto con el monto en el mensaje. Desde la app no se llega (`guardarReglas` y las partidas lo impiden); conviene que deje `porcentaje: null` en vez de lanzar, y vigilarlo en el importador.
  - El nivel se calcula dos veces, en SQL en `sobresConNivel` y en JS en `/sobres/[id]`; hoy coinciden en 8 escenarios. `datosDelReparto` pasa de 4 a 6 conexiones a la vez, con los mismos tiempos; hay que volver a medirlo con el pooler de Supabase.
  - `scripts/humo.mjs` no cubre las tres rutas nuevas; a mano, sin sesión, dan 307 a `/entrar`.
  - La base local quedó como estaba: 118 movimientos `demo-*`, 0 `captura-*`, las seis reglas activas con 40/30/30.
- Arreglos tras la revisión, por decisión del desarrollador (2026-10-15):
  - `022990f`: en `/sobres/reglas`, el aviso "Reglas guardadas" se va al tocar cualquier campo y vuelve con el siguiente guardado; cada grupo de radios se anuncia como "Regla de <sobre>" (`detalleEtiqueta` en `SelectorPildoras`, solo para el lector de pantalla).
  - `789fbc6`: `nivelParaIcono` pinta sin medida un sobre con una medida fuera de los enteros seguros, en vez de lanzar con el monto; la suma del desglose va en `numeric`. `nivelDeSobre` sigue exigiendo enteros y su prueba no cambió.
  - `08c4ce7`: el humo cubre `/nuevo/ingreso`, `/sobres/repartir` y `/sobres/reglas`.
- Segunda vuelta (2026-10-15): `revisor`, **APTO PARA FUSIONAR**, sin hallazgos abiertos (probado en Edge con y sin JavaScript y en el árbol de accesibilidad); `guardian-datos`, **APTO** sobre `789fbc6`, con datos normales idéntico a antes. `pnpm verify --forzar` en verde, 495 pruebas. Quedan informativos, todos solo por SQL:
  - El mensaje de `789fbc6` dice más de lo que arregla: con un tope de 2^53+1, la propuesta sigue lanzando en `registrarIngreso` y en `/sobres/repartir`, ahora desde `validar` de `lib/reparto.ts` (así desde T1). El guardado no se afecta. Si se quiere cerrar, que la propuesta trate ese tope como "sin tope" o que lo frene el importador.
  - Con una partida de 2^62×4, `/sobres/18` lanza en `aporteMensualCentavos` (de antes de 97437d7).
  - `nivelParaIcono` descarta todo el nivel si una medida está fuera de rango, también la marca de negativo.
  - La suma en `numeric` cuesta unos 15 ms más con 200 mil partidas; con las de verdad, nada.
