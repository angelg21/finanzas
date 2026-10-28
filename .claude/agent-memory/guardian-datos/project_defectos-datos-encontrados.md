---
name: defectos-datos-encontrados
description: Defectos y huecos de datos que encontré en auditorías (con fecha), abiertos y cerrados; revisado completo en la segunda vuelta de T14 de 002 y ampliado en 003, 004, 97437d7, 005, T3 de 006, la 0006 de 008, 009, 007 y su criterio 11 (2026-10-23: retiro que se come el reparto de otro ingreso, firma sin saldos)
metadata:
  type: project
---

Antes de dar algo por cerrado, comprobar si estos puntos siguen abiertos. Última revisión completa: segunda vuelta de T14 de 002, el 2026-10-14 (ver [[auditoria-t14-002]]).

**Abiertos, nuevos en la segunda vuelta de T14 (2026-10-14). Ninguno bloquea.**

- **Baja.** Carrera en el desglose. `agregarPartidaYSincronizar` lee las partidas sin bloquear nada. Con dos envíos a la vez (dos pestañas, o un doble clic sin JS), la regla queda calculada sin la partida del otro. Medido: 19 de 20 rondas con la regla por debajo del desglose. No toca el cuadre, y la próxima edición lo recalcula. Corrección: `select ... for update` de la regla o del sobre al empezar la transacción, o `pg_advisory_xact_lock(sobreId)`.
- **Baja, solo pantalla.** Tres sitios siguen con el reloj del servidor (UTC en Vercel), de 20:00 a 24:00 de Caracas:
  - `fechaLarga` en `(con-sesion)/layout.tsx`;
  - `diasRestantesDelMes` en `(con-sesion)/page.tsx`;
  - `etiquetaFecha` en `movimientos/page.tsx`: un gasto de hoy sale como "Ayer".

  Medido con TZ=UTC el 31 de octubre a las 21:00: "domingo, 1 de noviembre" y 29 días restantes.

- **Baja.** `movimiento.tsx` ahora llama a `aTasa(m.tasa)`, que lanza si la tasa es ≤ 0. La base no tiene un check `tasa > 0`: una fila así, metida por SQL o por el futuro importador, tumbaría la lista de movimientos y el inicio. Las 4 tasas que hay hoy pasan la ida y vuelta.
- **Info.** `fijarAporteManual` no comprueba que el sobre no tenga desglose; solo lo oculta la página. El campo `mes` de zod responde en inglés ("Invalid input", "Too big…"). Solo se ve con peticiones fabricadas.
- **Info.** Un error de `fs` al leer la cadena de producción imprimiría la ruta completa con el usuario de Windows, solo en la terminal propia. Los mensajes normales muestran `~/.finanzas/produccion.env`.

**Abiertos, nuevos en T3 de 003 (2026-10-14). Informativos, ninguno bloquea** (ver [[revision-003-movimientos]])

- `totalesPorCategoria` no tiene `orderBy`. Con montos empatados, el punto del mayor residuo va a la categoría que la consulta devuelve primero. Medido con tres de 1000: Servicios 34, sin variación entre planes. Para que sea determinista: `orderBy(desc(suma), categorias.id)`.
- Una suma por encima de 2^53 centavos (90 billones de USD): `mapWith(Number)` redondea (9007199254740993 → …992) y `distribuirPorCategoria` lanza, lo que da un 500 en ese periodo. Por encima de 9,2e18, la consulta da 22003. Solo es posible con datos absurdos; vigilarlo en el importador.
- Las tres consultas de `/movimientos` van sin una instantánea común. Un gasto que entre entre una y otra descuadra "Todas · X" con los días hasta recargar.

**Abiertos, nuevos en T4 de 004 (2026-10-14). Ninguno bloquea** (ver [[revision-004-reparto]])

- ~~**Baja / decisión.** `recibidoDesdePorAsignarPorMes` suma lo bruto.~~ **Cerrado en fd89e34 (007)**: neto, con piso 0 al leer. Abre su propio residual (ver 007, abajo).
- **Baja.** `sobrePorAsignar` elige el de menor orden aunque esté inactivo, y entonces `datosDelReparto` le pone saldo 0, porque `saldosPorSobre` filtra `activo`.
- **Info.** `datosDelReparto` abre 4 conexiones a la vez (medido: 4 pids) y no comparte instantánea. Su saldo de "Por asignar" no sirve como guarda para escribir.

**Abiertos, nuevos en T5 de 004 (2026-10-14)** (ver [[revision-004-reparto]])

- **Cerrados en 7dd832a (segunda vuelta, medidos):**
  - el reintento que daba `sinSaldo` y el reparto a otros sobres que se guardaba otra vez;
  - `editables` y el tope que venían de fuera;
  - el destino inactivo, la referencia nula y la lista vacía.
- **Siguen abiertos (info):**
  - `fijarReglaFija` no reactiva una regla y no comparte el candado 4. A la vez que `guardarReglas`, repite el `orden` (20 de 20), sin efecto en los montos.
  - El LIKE tarda 24 ms con 500 mil filas, en cada reparto (dos veces: en la acción y bajo el candado).
  - Dos filas al mismo sobre dan `guardadas=0`; desde la acción no se puede llegar ahí.
  - No hay check `tope > 0` en la base; ahora lo frena `guardarReglas`.

**Abiertos, nuevos en la auditoría de 97437d7 (2026-10-15). Info, ninguno bloquea** (ver [[revision-004-reparto]])

- **Cerrado en 789fbc6 (medido el 2026-10-15):** `sobresConNivel` lanzaba con medidas fuera de los enteros seguros, o con `sum(monto*veces)` desbordado (22003). Ahora usa `nivelParaIcono` y la suma va en numeric, así que `datosDelReparto`, el inicio, `/sobres` y el guardado del ingreso ya responden.
- **Siguen abiertos (info, de antes de 97437d7, solo por SQL):** con un tope que no es un entero seguro en un sobre con regla, `validar` de `lib/reparto.ts` (desde T1) lanza con el monto en el mensaje. Lo hace en:
  - `registrarIngreso` al proponer;
  - `/sobres/repartir` cuando "Por asignar" tiene saldo;
  - el formulario del cliente.

  Con un desglose así, `/sobres/[id]` lanza en `aporteMensualCentavos`. La acción `repartir` y el guardado del ingreso responden. Desde la app no se llega: `guardarReglas` y `AporteFueraDeRango` lo acotan.

- Info, en 789fbc6: un sobre en negativo con un tope fuera de rango pierde la marca de negativo.
- Las conexiones simultáneas pasan de 4 a 6 en `datosDelReparto` y de 5 a 7 en el inicio. La acción del ingreso usa 8 de las 10 que postgres-js abre por defecto. Medirlo junto con el pooler (T15).
- El nivel se calcula en dos sitios: `sobresConNivel` (SQL) y `/sobres/[id]` (JS). Hoy dan lo mismo.

**Abiertos, nuevos en T5 de 005 (2026-10-15). Info, ninguno bloquea la migración** (ver [[revision-005-deudas]])

- La base no ata el `sentido` de la deuda al tipo del movimiento, ni el sobre (Deudas o "Por asignar"), ni la moneda. Lo tiene que frenar el escritor de T7/T13.
- Los mapas de `tipo_sobre` son `Record<string>` con un respaldo: tsc no avisa de que falta `deudas`.
- `deudas` no tiene en la base un tope (`TOPE_REGLA_CENTAVOS`) ni el largo de `persona`; solo los valida `lib`.

**Abiertos, nuevos en T6 de 005 (2026-10-15)** (ver [[revision-005-deudas]])

- **Media.** Una deuda rota (préstamo en una "debo", pago por encima del pendiente, monto mayor que 2^53) hace lanzar a `sobresConNivel` y a `datosDelReparto`, porque `pendienteDe` lanza dentro de `medidasPorSobre`. Se caen el inicio, `/sobres`, `/nuevo/ingreso` y `/sobres/repartir`. La base no lo impide.
- **Baja.** `consultarDeudas` pasa la fila entera a `pendienteDe`. Con un monto inválido, el error lleva persona y nota a los registros.
- **Info.**
  - El nivel de Deudas difiere entre `/sobres` y `/sobres/[id]`.
  - Conexiones: 9 de 10 en la acción del ingreso.
  - Con 300 mil filas, `saldosPorCuenta` pasa de 29 a 41 ms.

**Abiertos, nuevos en T7 de 005 (2026-10-15)** (ver [[revision-005-deudas]])

- **Media.** `editarDeuda` hace `.set({ ...cambios })`: un `sentido`, una `referencia` o un `id` que vengan de más se escriben (el tipo `Omit` no lo impide en tiempo de ejecución). Medido: una deuda "debo" con un pago pasó a "me_deben" y su referencia quedó pisada.
- **Baja.** `pagarDeuda` acepta monto ≠ monto_usd: la cuenta USDT pierde 100 y la deuda baja 50.
- **Info.** El escritor no valida la cuenta prevista, el id de `registrarDeuda` ni la fecha. Una deuda rota no se arregla editando, porque `deudaPorId` lanza "Pendiente negativo: N", con el monto pero sin persona.

**Abiertos, nuevos en T13 de 005 (2026-10-16)** (ver [[revision-005-deudas]])

- **Media.** `prestar` puede dejar "Por asignar" en negativo. Pasa con un solo préstamo mayor que su saldo (3000 → −10000), y en carrera con `repartirPorAsignar`: 20 de 20 rondas en −200. Repartir y apartar lo protegen con `(3, PA)` y el saldo; prestar no hace ninguna de las dos cosas. El cuadre se mantiene, y `datosDelReparto` y `sobresConNivel` responden.
- **Info.** `prestar` (igual que `registrarDeuda`) esparce la fila de la deuda en el insert, y un `creadoEn` de más se escribe. Los escritores de deudas no validan la fecha, la tasa ni el monto de destino: un pago con fecha 2099, tasa y 999 VES de destino entra.

**Cerrados en la rama de 005, medidos en /f-review (2026-10-16)**

- T6 media: una deuda rota ya no tumba `sobresConNivel` ni `datosDelReparto`; `cuotaDelMes` da null.
- T6 baja: `pendienteDe` ya no vuelca la fila en el mensaje (leído).
- T7 media: `editarDeuda` escribe campo por campo. Medido: el sentido y la referencia de más no se escriben.
- T7 baja: pagar exige 1 a 1.
- T13 media: prestar desde "Por asignar" toma `(3, PA)` y vuelve a mirar el saldo. Medido en los dos órdenes: nunca queda en negativo.
- T13 info: los inserts de deudas van campo por campo.

**Abiertos, nuevos en /f-review de 005 (2026-10-16)** (ver [[revision-005-deudas]])

- **Baja, solo por SQL.** Con una `fecha_prevista` que `esFecha` rechaza (0050-01-01, 10000-01-01, 0044-03-15 BC), `cuotaDeDeudas` lanza fuera del `.catch` de `cuotaDelMes` (`reparto.ts`). Se caen el ingreso con su acción, `/sobres/repartir` con la suya, `/sobres/reglas`, `/deudas` y `/deudas/apartar`. La app lo frena al validar; el escritor de `src/db` no.
- **Info.** `cuotaDelMes` se traga cualquier error sin registrarlo. `datosDelReparto` abre 9 conexiones y la acción del ingreso llena las 10.
- **Sigue abierto, decidido en la spec:** desde otro sobre, prestar puede dejarlo en negativo, como un gasto.

**Abiertos, nuevos en T3 de 006 (2026-10-17). Ninguno bloquea** (ver [[revision-006-editar]])

- **Baja, defensa.** `editarGasto` y `editarIngreso` hacen spread del plan en `.set` y usan `plan.venta.id`. Un plan fabricado borra filas ajenas, cambia el tipo o pisa la referencia. Hoy el plan sale de lib y no pasa.
- **Baja, futuro.** Editar o borrar un movimiento de una cuenta o un sobre archivado descuadra (medido: 500).
- **Baja.** Un id entre 2^31 y 2^53 en `/movimientos/[id]` da un 500 (22003) en vez del 404.
- **Info.** Una referencia `captura-` en mayúsculas lleva a una venta doble al editar.
- **Info.** Si se borra el gasto, el reintento de la captura original lo vuelve a meter.

**Abiertos, nuevos en la 0006 de 008 (2026-10-17). Ninguno bloquea** (ver [[revision-008-etiquetas]])

- ~~**Media, operativo.** `respaldo.ts`, con el código de una feature que añade una tabla, falla contra producción antes de migrar.~~ **Cerrado en a3d9bc4.** `resumir` usa `to_regclass` y escribe "todavía no existe". Medido con la 0007 el 2026-10-22: el respaldo pasa antes y después de migrar.
- **Baja.** `etiquetas` sin marca demo: lo que cree una sonda o `comprobar-008` en la base local no lo borra `db:demo:limpiar`.
- **Info.**
  - Checks evaluados por orden alfabético.
  - Nombre y clave de la etiqueta sin check en la base.
  - `etiquetaId = null` por defecto en `editarGasto` y `editarIngreso`.

**009 (2026-10-22)** (ver [[revision-009-por-completar]])

- **Cerrados en 0d8904e (medidos en la 2.ª vuelta):** el check con NULL (0008, casos 4, 5 y 21 → 23514); la venta compartida rota por borrar/editar uno; la categoría sin validar en varios y los pendientes sin contar en categorías; el id reusado que daba "completados" (ahora `otra`). Lección: al revisar cualquier check nuevo, evaluar su expresión con filas a medias y buscar NULL.
- **Abiertos, Baja.** El último gasto de un grupo de varios hereda la venta compartida entera (editar la encoge, borrar la borra), porque "compartida" se decide contando los gastos que quedan.
- **Abiertos, Info.**
  - Ese conteo va antes del candado de la venta: dos borrados simultáneos la dejan sin gastos.
  - Mismo id con otros pendientes a la vez: el catch de 23505 da "ya" (vendiendo) o entran los dos grupos (dólares).
  - `categoriasConUso` no cuenta pendientes: la página promete borrar y el escritor archiva.
  - Anotar no compara contenido en un reintento. La base acepta fechas raras, una referencia vacía y un monto > 2^53.

**Criterio 11 de la 007, d069e51 (2026-10-23). NO APTO; abierto** (ver [[revision-007-ajustes]])

- **Media-alta.** Dos deshacer no son neutros si entre medio hubo un Mover, un préstamo desde PA o un ingreso bajado por debajo de su reparto, con una entrada después. El orden de registro deja reparto contado como recibido. El mensaje pide devolver desde un sobre que ya devolvió.
- **Cerrados en d069e51 (medidos):** el reparto propio de otro ingreso ya no se retira; la firma cubre los saldos; el retiro toma (3, sobre), y Mover, apartar y pago esperan.

**Criterio 11 de la 007, 4460c75 (2026-10-23). APTO; superado por d069e51**

- ~~**Media.** El retiro (del más reciente) se lleva el reparto propio de otro ingreso.~~ Cerrado para cobros, ingresos y Repartir; sigue la clase con Mover (arriba).
- ~~**Baja.** La firma no cubre los saldos; sin (3, sobre).~~ Cerrado.
- **Info.** Sin filtro de sobre activo (descuadra al archivar); un ingreso fuera de PA retira apartados; monto ≠ USD da 23514; PA negativo previo retira de más; meses pasados y demo-* entran.

**007, auditada en main ad01eeb (2026-10-22). Ninguno bloquea** (ver [[revision-007-ajustes]])

- ~~**Baja.** El piso de 0 de lo recibido arrastra el déficit.~~ **Superado el 2026-10-22:** ya no hay neto ni piso; lo recibido excluye Mover por la marca `-mover-` (criterio 10 redecidido).
- **Info.**
  - Mover desde Deudas a la vez que un pago: Deudas en negativo (10 de 10), porque `saldar` no toma `(3, Deudas)`.
  - Deudas → un sobre que no es PA sube la cuota dentro del mes.
  - Mismo id de captura con otro origen y otro destino a la vez: 2 filas.
  - Deshacer y luego reintentar la captura del pago lo vuelve a meter.
  - Deshacer un cobro ya gastado deja la cuenta en negativo.
  - Lo recibido tarda 215 ms con 300 mil filas (antes 67).

**Abiertos de antes**

- **Baja.** `reglas_reparto.valor` sigue siendo `integer`. Desde 790ee93 lo vigila `cabeEnRegla`: el tope de 21.474.836,47 USD se rechaza con un mensaje y sin escribir.
- **Info.** `guardarCategoria` guarda como gasto, sin avisar, cualquier `tipo` distinto de "ingreso".
- **2026-10-11.** El check `movimientos_forma_por_tipo` solo valida la forma. La base acepta un sobre "Por asignar", una categoría de ingreso, VES desde una cuenta USDT o una cuenta inactiva; lo frena la acción (22 de 22 manipulaciones rechazadas en T14). Tampoco hay checks para `tasa > 0`, `monto_destino > 0` ni `tope > 0`. Vigilar en cada escritor nuevo, sobre todo en el importador.
- **2026-10-11, T15 de 001.** Una categoría que cambia de tipo durante la validación de un gasto. La unicidad de categorías distingue mayúsculas en la base y no en `lib`.
- **2026-10-12.** Dos `db:seed` a la vez en una base vacía: una sale con 23505.
- **2026-10-11.** `captura-*` no lo borra `db:demo:limpiar`.
- **Pendientes de T15.** El pooler de transacción, sin medir. Residuales de T3, T4 y T12: `tsx ... --produccion` solo lo frena `isTTY`; la restauración corre como superusuario; falta `auth.users`; comprobar PG 18; faltan las pruebas de base de `registrarCaptura`. Ver [[guardas-produccion]], [[respaldo-produccion]] y [[captura-idempotente]].

**Cerrados en la segunda vuelta de T14 (790ee93, 2026-10-14), con medición**

- **H1. TLS en la app.** `conexionSegura` en `index.ts`. Mediciones en [[auditoria-t14-002]].
- **H2/H3. Partida y regla en una transacción.** `agregarPartidaYSincronizar` y `eliminarPartidaYSincronizar`, con `AporteFueraDeRango`: rollback con 0 filas, y borrar recalcula (1700 → 900). Al quitar la última partida, la regla se queda como está, a propósito.
- **H4. Sin flotante en los formularios.** `centavosATexto` hace la ida y vuelta exacta, también con 2147483647. `formatearTasa(aTasa())`.
- **H5. Mes de Caracas en las consultas.** En `consultas.ts`, TZ=UTC y la zona de Caracas dan lo mismo: 14200 y septiembre-octubre, igual que el SQL.
- **H6. Nota de la prima.** La base nueva nace con la nota del ADR 0006. La local conserva la vieja, como se esperaba.
- **H7. `veces` y `mes` solo con cifras.** Se rechazan "0x10", "1e1", " 3", "3.0", "+3" y "３". Una `veces` vacía vale 1 y un `mes` vacío queda en null.

**Cerrados antes:**

- afc2286: BigInt en los fondos;
- `enDolares[0]`;
- tasa < 1;
- `sslmode` repetido y AggregateError;
- RLS en vivo, 10 de 10;
- 64af718, 17bbedf, b1c3fa1, b8c1a07 y bfd4636;
- `for update` en categorías.

**Escrituras ajenas en la base real (resueltas):** las del revisor el 2026-10-12, ids 660 a 674, y `demo-comprobar-001-*`. Método para atribuirlas en [[entorno-de-prueba]].

**Why:** el dinero que no cuadra no se ve en pantalla. Sin esta lista, cada revisión empieza de cero y repite mediciones.

**How to apply:** en cada revisión, cruzar lo abierto con el código actual (grep y git log) antes de citarlo. Cuando algo se cierre, moverlo a "Cerrados" con la evidencia.

Ver también [[prima-en-cuadre]], [[categorias-icono-color]], [[rls-supabase]] y [[entorno-de-prueba]].
