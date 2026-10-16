---
name: revision-005-deudas
description: Spec 005 (deudas y préstamos): T5 migración 0005 APTA (sha, mediciones); T6, T7 y T13 APTA CON CAMBIOS (deuda rota tumba inicio; editarDeuda esparcía; prestar deja Por asignar en negativo); qué vigilar en T14 y T15
metadata:
  type: project
---

**T5, migración `0005_polite_sir_ram.sql`: APTA (2026-10-15), revisada sin commit y antes de aplicarse en ninguna base.** sha256 `99dc3f2350f8f3e5…`. Si al aplicarla el hash en `__drizzle_migrations` es otro, alguien la editó después de la revisión.

Medido:

- Las 14 sentencias son idénticas a `generateMigration(0004_snapshot, schema)`, y quedan 0 pendientes contra `0005_snapshot`. `schema.ts` se tocó 2 minutos después de generar, pero solo en comentarios.
- En una base vacía, las 6 migraciones corren en una transacción (un `begin` y un `commit` en el log) y quedan 539300 = 539300 tras semilla y demo.
- En una copia con datos reales y la 0004 revertida (como producción), la 0004 y la 0005 corren juntas en una transacción. Todos los checks quedan `convalidated`.
- Con un pago (200), un préstamo (140) y un cobro (50), sale 510300 = 510300. Las 6 formas malas dan 23514, la deuda inexistente 23503 y el borrado de una deuda con movimientos 23503.
- Control: el mismo check sin `::text`, tras un ADD VALUE en la transacción, da 55P04. Con `::text`, pasa.
- No se probó en la imagen de Supabase: el clasificador negó `docker run` (ver [[entorno-de-prueba]]). La T14 de 002 ya había corrido el ADD VALUE de la 0001 dentro de la transacción con los event triggers de Supabase.

**Why:** en producción, la 0004 y la 0005 se aplican juntas en una sola transacción. Usar un valor de enum recién añadido tumba el despliegue entero.

**How to apply (lo que queda abierto para T6, T7 y T13):**

- La base no ata el `sentido`. Un `pago_deuda` puede apuntar a una deuda "me_deben", y un `prestamo` o `cobro_prestamo` a una "debo". Tampoco exige que el sobre sea Deudas o "Por asignar", ni cuentas en dólares. El escritor de T7/T13 tiene que validarlo dentro del candado `(5, deudaId)`. Revisarlo ahí.
- Los mapas de `tipo_sobre` son `Record<string, …>` con un respaldo: `nombreTipoSobre` en el inicio, `descripcion` en `/sobres`, `nombreTipo` en `/sobres/[id]` e `iconoPorTipo` en `icono-sobre.tsx`. Cuando la semilla de T6 cree Deudas, saldrá "deudas" en crudo y el icono Target. tsc no lo detecta: el ADR 0012 dice "no compila", pero eso solo vale para los mapas de `tipo_movimiento`.
- El enum `tipo_movimiento` sale ahora de `tiposDeMovimiento` en `src/lib/saldos.ts`. Reordenarlo o renombrarlo ahí cambia la base. Un RENAME VALUE rompería en silencio el check por texto, porque caería en `else false`.
- Las sumas de SQL (`saldosPorSobre`, `saldosPorCuenta`, `saldoDeSobre`) todavía no cuentan los tres tipos; están planeadas para T6. Entre T5 y T6 nada escribe esos tipos.

**T6 (consultas y semilla), sin commit: APTA CON CAMBIOS (2026-10-15).** Medido en copias `finanzas_g005_t6*`, ya borradas:

- Sin filas nuevas, las sumas de la T6 son idénticas a las de HEAD (el SQL viejo, copiado del diff) en las 118 filas: 539300.
- Con un ingreso de 1000, reasignaciones a Deudas, 2 pagos, 1 préstamo y 1 cobro: SQL = `saldosTras` y 585300 = 585300. Pendientes 0 / 32000 / 9000. `sobreDeudas` da 7500 y lo recibido en el mes, 38500, igual que `recibidoDesdePorAsignarPorMes`. `repartirPorAsignar` ve el cobro en "Por asignar" (con saldo+1 da sinSaldo; con el exacto, guarda).
- Base vacía con migrate, seed dos veces y demo: Deudas id 7 entre Ocasiones (6) e Inversión (8), sin regla; 539300.
- **Hallazgo principal:** `medidasPorSobre` llama a `deudasConPendiente`, y `pendienteDe` lanza. Una deuda rota tumba `sobresConNivel` y `datosDelReparto`, es decir, el inicio, `/sobres`, `/nuevo/ingreso` y `/sobres/repartir`, con sus acciones. Es la misma clase de fallo que cerró 789fbc6. Casos medidos: préstamo en una deuda "debo", pago por encima del pendiente y monto mayor que 2^53. Con el último, el mensaje lleva `JSON.stringify` de la fila completa, con persona y nota.
- Conexiones: 7 en `datosDelReparto`, 8 en el inicio y 9 de 10 en la acción del ingreso. En cada caso, una más que antes.

**T7 (escrituras en `src/db/guardar-deudas.ts`), sin commit: APTA CON CAMBIOS (2026-10-15).** Medido en `finanzas_g005_t7`, ya borrada; la real quedó con la misma huella.

- **Bien:** candado `(5, deudaId)` en pagar, editar y borrar; `(3, origen)` en apartar. Editar contra pagar, borrar contra pagar y apartar contra repartir: 20 rondas cada uno, salen los dos órdenes, ningún pendiente negativo, ningún huérfano y "Por asignar" nunca en negativo. Reintentos: con otro monto, otra deuda u otro origen da "otra" con +0 filas; en vuelo con el mismo id espera ~1 s y da "ya-estaba"; un id de un gasto da "otra".
- **Hallazgo (media):** `editarDeuda` esparce `cambios` en `.set()`. Un `sentido` o una `referencia` de más se escriben (medido: debo → me_deben con un pago, y la referencia pisada). El script del autor ya llama con `{ ...fila }`, que trae `sentido`.
- **Baja:** `pagarDeuda` no exige monto = monto_usd. Medido: 100 USDT contra 50 USD, cuadre USD intacto, pero la cuenta USDT diverge.
- **Info:** el escritor no valida la cuenta prevista (VES aceptada), el id en `registrarDeuda` ni la fecha del pago. Apartar contra un gasto del mismo origen no espera y deja el sobre en negativo, como el gasto solo.

**How to apply (T8, T10 a T14):** comprobar que `editarDeuda` arme el `set` campo por campo. En T11/T12, la acción tiene que buscar el reintento ANTES de `prepararPago` o `prepararApartado`: los dos rechazan una deuda pagada o un origen en 0, y dirían error en vez de "ya estaba". En T13, que el cobro tome `(5, deudaId)`, y que nadie tome `(3, x)` y `(5, y)` en órdenes distintos.

**How to apply (T7, T8, T9, T11, T13 y T14):** comprobar que se corrigió lo de arriba. En T8, la cuota tampoco puede tumbar el reparto. En T14, el patrimonio de `/cuentas` usará `deudasConPendiente`: el mismo riesgo. `pasos` de `lib/sobres.ts` sigue siendo `Record<string>` sin `deudas` (T9). `/sobres/[id]` no pasa `debidoCentavos` (T11). Hasta la T8, Deudas sale como editable en `/sobres/reglas`, y también se ofrece en la captura de gasto.

**T13 (préstamo y cobro; `pagarDeuda` pasa a `saldar`), sin commit: APTA CON CAMBIOS (2026-10-16).** Medido en `finanzas_g005_t13`, ya borrada; la real quedó con la misma huella.

- **Bien:** préstamo todo o nada: 10 fallos (23514, P0001 por trigger, validaciones) dejan +0. Reintentos: solo lo idéntico da "ya-estaba", combinando `resolverReintentoDeDeuda` y `resolverReintento` con `deudaId`; el id de un registrar o de un gasto da "otra". Mismo id a la vez: 15/15 una sola. En vuelo: espera ~1 s. Cobro contra cobro, editar y borrar: 0 negativos y 0 huérfanos. Los casos de pago de T7 dan igual; solo cambian los textos de los mensajes.
- **Hallazgo (media):** `prestar` no mira el saldo del origen ni toma `(3, origen)`. Es el único escritor que deja "Por asignar" en negativo: con un préstamo mayor que el saldo, o en carrera con repartir (20 de 20 rondas). El cuadre se mantiene y nada se cae.
- **Info:** `prestar` esparce `deuda` en el insert, así que un `creadoEn` de más se escribe; el `id` lo frena la base (428C9).

**How to apply (T14 y T15):** comprobar si se corrigió lo de "Por asignar" o si la spec decidió dejarlo. La acción de prestar debe comparar la deuda y el movimiento: el 2026-10-16 ya lo hacía. Herramienta: `e7c92f93…/scratchpad/t13/sonda-t13.mts`.

Ver también [[defectos-datos-encontrados]] y [[rls-supabase]].
