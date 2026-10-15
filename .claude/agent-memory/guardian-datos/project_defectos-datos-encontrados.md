---
name: defectos-datos-encontrados
description: Defectos y huecos de datos que encontré en auditorías (con fecha), abiertos y cerrados; revisado completo en la segunda vuelta de T14 de 002 y ampliado en T3 de 003, T4/T5 de 004 (2026-10-14) y 97437d7 (2026-10-15)
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

- **Baja / decisión.** `recibidoDesdePorAsignarPorMes` suma lo bruto: una devolución a "Por asignar" no descuenta lo que el fijo ya recibió. Hoy nada escribe esas devoluciones; llegarán con "Mover".
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

- `sobresConNivel` lanza si un tope, un saldo o la suma anual no es un entero seguro (`exigirEntero` en `lib/sobres.ts`), o si `sum(monto*veces)` desborda (22003). Como `datosDelReparto` lo usa, eso tumba `registrarIngreso`, `repartir`, el inicio, `/sobres` y `/nuevo/ingreso`.
  - Medido con un tope de 2^53+1 y con una partida de 2^62×4 metidos por SQL.
  - Desde la app no se llega: `guardarReglas` y `AporteFueraDeRango` lo acotan.
  - El RangeError lleva el monto en el mensaje y no pasa por `registrarFalla`. Es la misma familia que "tasa ≤ 0".
  - La captura de gasto no lo usa.
- Las conexiones simultáneas pasan de 4 a 6 en `datosDelReparto` y de 5 a 7 en el inicio. La acción del ingreso usa 8 de las 10 que postgres-js abre por defecto. Medirlo junto con el pooler (T15).
- El nivel se calcula en dos sitios: `sobresConNivel` (SQL) y `/sobres/[id]` (JS). Hoy dan lo mismo.

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
