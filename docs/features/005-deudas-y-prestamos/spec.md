# 005 · Deudas y préstamos

Fecha: 2026-10-15. Estado: aprobada.

## Para qué

El desarrollador debe dinero a sus padres para diciembre y a un amigo para esta semana, y le deben dinero a él. Hoy la app no tiene dónde anotarlo. Si lo anotara como gasto, lo apartado para pagar se seguiría viendo como disponible, y un pago a un amigo inflaría el gastado del mes. Esta feature da dos listas, lo que debo y lo que me deben, y un sobre "Deudas" que aparta el dinero y recibe su cuota en cada reparto. Pagos, préstamos y cobros son movimientos propios, y la app avisa cuando el dinero está en una cuenta distinta de la que se usará para pagar.

## Trazabilidad al plan

- Plan, sección 6, "Deudas y préstamos, decidido el 15 de octubre de 2026" (líneas 272 a 283). Sale de "Bajo demanda": la demanda llegó ese día (línea 269).
- Observación 11 de `docs/observaciones.md`, con el caso real:
  - debe 520 USD a sus padres para diciembre;
  - debe 250 USD a un amigo que solo cobra en USDT por Binance, mientras el dinero está en la cuenta de EE. UU.;
  - le deben 140 USD sin fecha.
- ADR 0002: los movimientos nuevos tienen forma fija por tipo, como los cuatro actuales, y el cobro entra en "Por asignar".
- ADR 0006: el invariante se mantiene. Las deudas y lo que me deben no son cuentas ni sobres: no entran en el cuadre, solo en el patrimonio neto.

**Cambios al plan**, que se escriben en la última tarea:

- El plan dice "Sobre Deudas de tipo fondo". La spec le da **un tipo propio, `deudas`**: la app tiene que encontrarlo para cobrarle los pagos y calcular su cuota, y la maquinaria de los fondos (desglose, aporte manual) no le sirve. Se comporta como un fondo de reserva, que es lo que el plan quería decir.
- El plan pide un campo "saldo pendiente" y otro "estado". Por la regla dura, los saldos se calculan y nunca se guardan: el pendiente sale de los movimientos y el estado del pendiente.

## Criterios de aceptación

Montos de ejemplo en USD. "Cuentas en dólares" son las de USD, USDT y USDC, que valen 1 a 1, como en el ingreso. La cuenta en bolívares no se ofrece en nada de esta feature.

### Registro y saldo pendiente

1. ★ **Registrar lo que ya existía.**
   - Dado una deuda o un préstamo de antes de la app, cuando se registra en `/deudas/nueva`, entonces se guarda una fila en `deudas` con:
     - sentido: "debo" o "me deben";
     - persona, de 1 a 80 caracteres sin contar espacios a los lados;
     - monto pendiente hoy, en centavos de USD, de 0,01 a 21.474.836,47 (`TOPE_REGLA_CENTAVOS`, para que la cuota siempre quepa en una regla). Se lee con `aCentavos`, como el ingreso;
     - fecha prevista, opcional, pasada o futura;
     - cuenta prevista, opcional, solo en "debo", y solo una cuenta en dólares activa;
     - nota opcional.
   - No crea ningún movimiento y no cambia ningún saldo de cuenta ni de sobre: `/cuentas` sigue diciendo "Cuadra".
2. ★ **El pendiente se calcula, nunca se guarda.**
   - En "debo", pendiente = monto inicial − suma de sus pagos.
   - En "me deben", pendiente = monto inicial + suma de sus préstamos − suma de sus cobros.
   - Estado: abierta con pendiente mayor que cero; pagada con cero. Nunca es negativo: las escrituras lo impiden (criterio 6).
   - Ejemplo: Papás, 520,00; tras un pago de 200,00 quedan 320,00 abiertos; tras otro de 320,00 está pagada.

### Los tres movimientos nuevos

3. ★ **Pago de deuda.**
   - Dado una deuda abierta que debo, cuando se registra un pago, entonces se guarda una fila `pago_deuda` con:
     - cuenta de origen en dólares;
     - el sobre Deudas como sobre de origen;
     - la deuda;
     - sin categoría.
   - Resta de la cuenta y del sobre Deudas, y baja el pendiente.
   - No cuenta en el gastado del mes, ni en la gráfica mensual, ni en el anillo de categorías.
   - El monto va de 0,01 al pendiente. La cuenta viene elegida: la prevista de la deuda; si no tiene, la primera cuenta en dólares.
   - Si el sobre Deudas no alcanza, se guarda igual y el formulario lo avisa antes de guardar: "Deudas tiene 135,00; quedará en −115,00". La cuota del siguiente reparto lo repone (criterio 11).
4. ★ **Préstamo a otro.**
   - Dado dinero en una cuenta en dólares, cuando se presta en `/deudas/prestar`, entonces se guardan juntas:
     - una deuda "me deben" con monto inicial 0, su persona, su fecha prevista opcional y su nota;
     - una fila `prestamo` con la cuenta de origen, el sobre de origen elegido y esa deuda, sin categoría.
   - Resta de la cuenta y del sobre, y no cuenta como gasto.
   - Sobres de origen: los activos, salvo Inversión ("nunca se retira", plan, sección 2) y Deudas (lo apartado para pagar no se presta). "Por asignar" sí se ofrece.
5. ★ **Cobro de préstamo.**
   - Dado algo que me deben, abierto, cuando se registra un cobro, entonces se guarda una fila `cobro_prestamo` con:
     - una cuenta de destino en dólares;
     - "Por asignar" como sobre de destino;
     - la deuda;
     - sin categoría.
   - Suma a la cuenta y a "Por asignar", y baja el pendiente.
   - No es un ingreso: no sale en la pestaña Ingresos de `/movimientos` ni en la gráfica mensual.
   - El monto va de 0,01 al pendiente. Tras guardar, se ofrece "Repartir", que lleva a `/sobres/repartir`.
6. ★ **Nunca más que lo pendiente, ni con dos pestañas.**
   - Pagos, cobros, ediciones y borrados de una misma deuda se escriben en una transacción con `pg_advisory_xact_lock(5, deudaId)`, y dentro vuelven a calcular el pendiente.
   - Un pago o un cobro mayor que el pendiente se rechaza con el error en su campo.
   - Un reintento se reconoce dentro de la transacción, tras el candado y antes de mirar el pendiente (la lección de la T5 de la 004). Si no, el reintento de un pago que saldó la deuda diría "no alcanza".
7. ★ **Todo o nada, y sin duplicados.**
   - Cada formulario lleva un `idCaptura`. Las referencias son:
     - `captura-<uuid>-deuda` en la fila de `deudas`;
     - `captura-<uuid>-pago`, `captura-<uuid>-prestamo` y `captura-<uuid>-cobro` en el movimiento;
     - `captura-<uuid>-reasignacion-<sobreId>` al apartar.
   - Un reintento con el mismo id no duplica nada. Es "ya estaba" solo si lo guardado es igual y reciente, con las reglas de la captura de gasto (ADR 0010).
   - El préstamo guarda la deuda y el movimiento en una sola transacción: los dos o ninguno.
8. ★ **La base protege la forma.**
   - El check `movimientos_forma_por_tipo` gana tres ramas:
     - `pago_deuda` y `prestamo`: cuenta de origen, sobre de origen y deuda, sin destinos ni categoría;
     - `cobro_prestamo`: cuenta de destino, sobre de destino y deuda, sin orígenes ni categoría.
   - Los cuatro tipos de siempre exigen `deuda_id` nulo.
   - El check termina en `else false`: un tipo que no esté listado no pasa.
   - Compara el tipo como texto (`tipo::text`). Así la migración se aplica en una sola transacción junto con la 0004, que sigue pendiente en producción. Postgres no deja usar un valor de enum añadido en la misma transacción (error 55P04).
   - En `deudas`, un check impide un monto inicial negativo, o igual a cero en "debo", y una cuenta prevista en "me deben".
9. ★ **El invariante se mantiene.**
   - Tras cada pago, préstamo, cobro y apartado, la suma de los sobres es igual a la suma en USD de las cuentas: `/cuentas` sigue diciendo "Cuadra".
   - Todas las sumas de saldos cuentan los tres tipos igual:
     - `saldosPorSobre`, `saldosPorCuenta` y `saldoDeSobre` en SQL;
     - `saldosTras` en `src/lib`;
     - `efectoEnSobre` de `/sobres/[id]`;
     - el signo de `FilaMovimiento`.
   - El efecto de cada tipo se decide en un solo lugar de `src/lib`: un `switch` exhaustivo que no compila si falta un tipo. Hoy `saldosTras` trata cualquier tipo desconocido como reasignación.

### El sobre Deudas

10. ★ **Un sobre propio.**
    - La semilla crea el sobre "Deudas", de tipo `deudas`, después de Ocasiones, sin fila en `reglas_reparto`.
    - La app lo encuentra por su tipo, como "Por asignar". Si no existe o está inactivo, `/deudas` lo dice y no deja pagar ni apartar. Registrar deudas sí se puede.
11. ★ **La cuota del mes.** `cuotaDeDeudas({ deudas, apartado, hoy })` calcula cuánto debe recibir Deudas este mes para tener cada deuda lista al empezar el mes de su fecha.
    - Entran las deudas abiertas que debo y que tienen fecha. Las que no tienen fecha no piden cuota: se apartan a mano.
    - `apartado` es el saldo de Deudas al empezar el mes: el saldo de hoy menos lo recibido desde "Por asignar" en el mes (día de Caracas). Así la cuota no cambia dentro del mes, aunque lleguen dos cobros.
    - Para cada mes con vencimientos, M:
      - S(M) es el pendiente de las deudas que vencen hasta M;
      - k(M) es el número de meses entre el mes de hoy y M, y como mínimo 1. Una deuda vencida o de este mes pide todo ahora;
      - la necesidad es (S(M) − apartado) / k(M), redondeada hacia arriba al dólar, como el aporte de los fondos, sin pasar de S(M) − apartado, y nunca menor que 0.
    - La cuota es la mayor de esas necesidades.
    - El caso real, con hoy 2026-10-15, apartado 0, Amigo 250,00 para el 2026-10-22 y Papás 520,00 para el 2026-12-15:
      - octubre pide 250,00 / 1;
      - diciembre pide 770,00 / 2 = 385,00;
      - la cuota es 385,00.
    - Siguiendo el caso:
      - en noviembre, con el amigo pagado, Deudas en 135,00 y Papás en 520,00, la cuota es 385,00 y en diciembre empieza con 520,00;
      - con 770,00 apartados hoy, la cuota es 0;
      - con 300,00 apartados, es 235,00.
12. ★ **Deudas en el reparto.**
    - `/nuevo/ingreso` y `/sobres/repartir` tratan a Deudas como una regla fija calculada: vale la cuota del mes y va **antes que todas las demás fijas**, que es la regla de uso del plan ("una deuda corta con un amigo se paga antes de repartir el siguiente ingreso").
    - Pide la cuota menos lo recibido desde "Por asignar" en el mes, como los demás fijos (spec 004, criterio 2).
    - Con cuota 0 no tiene fila en `TarjetaReparto`. Su pista dice, por ejemplo, "cuota · faltan 385 este mes · vence 22 oct".
    - En `/sobres/reglas`, Deudas se muestra como los fondos: solo lectura, "Cuota calculada: 385,00 este mes", con el enlace "Deudas". `reglaEditable` y `guardarReglas` lo dejan fuera.
    - El ejemplo de la spec 004 con Deudas en 385,00: un primer cobro de octubre de 1.200,00 propone 385,00 a Deudas, 450,00 a Gastos del mes, 100,00 a Familia y 25,00 a Ocasiones. Los 240,00 que quedan van 96,00 a Emergencia, 72,00 a Planes y 72,00 a Inversión.
13. ★ **Apartar lo que ya se tiene.**
    - En `/deudas/apartar` se elige un sobre de origen y un monto, y se guarda una `reasignacion` de ese sobre a Deudas.
    - Orígenes: los sobres activos con saldo mayor que cero, salvo Deudas e Inversión. "Por asignar" sí se ofrece.
    - El monto va de 0,01 al saldo del origen. Se escribe con `pg_advisory_xact_lock(3, sobreOrigenId)`, el mismo espacio del reparto, y dentro se vuelve a comprobar el saldo. Así apartar desde "Por asignar" y repartir no se pisan.

### Avisos y patrimonio

14. ★ **Aviso de liquidez.** `avisosDeLiquidez({ deudas, cuentas })` mira cada deuda abierta que debo con cuenta prevista.
    - Ordena por fecha (las que no tienen fecha, al final) y acumula por cuenta lo que hace falta.
    - Da uno de tres estados:
      - **lista**: el saldo de la cuenta prevista, en su moneda y 1 a 1, cubre lo acumulado;
      - **en otra cuenta**: no lo cubre, pero la suma de las cuentas en dólares sí;
      - **falta**: no alcanza ni la suma.
    - Texto de "en otra cuenta", con el ejemplo del plan: "Tienes 1.430,00 USD, pero en Binance solo 80,00 USDT".
    - Texto de "falta": "Te faltan 120,00 para esta deuda".
    - Ejemplo acumulado, con Binance en 600,00 USDT y 1.430,00 en total:
      - Amigo, 250,00 por Binance, para octubre: lista;
      - Papás, 520,00 por Binance, para diciembre: en otra cuenta, porque 770,00 pasa de 600,00.
    - Se muestra en `/deudas` bajo cada deuda y en `/deudas/[id]`.
15. ★ **Patrimonio neto en Cuentas.**
    - `/cuentas` muestra cuentas + me deben − debo, con los pendientes de las deudas abiertas.
    - Ejemplo: 1.430,00 en cuentas, 140,00 que me deben y 770,00 que debo dan 800,00.
    - El total de cuentas y la verificación no cambian: lo que me deben y lo que debo no entran en el cuadre.

### Editar y borrar

16. ★ **Corregir sin romper el pendiente.**
    - En `/deudas/[id]/editar` se cambian persona, fecha prevista, cuenta prevista, nota y monto inicial. El sentido no cambia.
    - El monto inicial nunca deja el pendiente en negativo: en "debo", no baja de lo ya pagado; en "me deben", no baja de lo cobrado menos lo prestado.
    - Una deuda sin movimientos se puede borrar; con movimientos no se ofrece borrar.
    - Editar y borrar van con el candado del criterio 6, así que no se cruzan con un pago en curso.

### Lo de siempre

17. **Regla de uso escrita.** `/deudas` muestra, en una `TarjetaPalida`: "Una deuda corta con un amigo se paga antes de repartir el siguiente ingreso. Presta solo lo que podrías regalar sin resentimiento."
18. **Historial.**
    - Los tres tipos salen en la pestaña Mover de `/movimientos`, en los últimos movimientos del inicio, en `/sobres/[id]` y en `/deudas/[id]`.
    - Títulos: "Pago a Papás", "Préstamo a Luis", "Cobro de Luis".
    - Signo: pago y préstamo en negativo, cobro en positivo.
    - Llevan un círculo neutro, como Mover, con su icono.
19. **Sin JavaScript.** Todos los formularios funcionan con un envío. Con JavaScript, el aviso "Deudas quedará en …" del pago se calcula al escribir el monto.
20. **Sesión y capas.**
    - Cada página empieza con `await exigirSesion()`, y cada acción con `leerSesion` y su `return`.
    - La aritmética vive en `src/lib/` y las escrituras en `src/db/`.
    - Los errores se registran con `registrarFalla`.
21. **Accesos.**
    - "Deudas" entra en el menú, después de Cuentas, con su título en la barra de escritorio.
    - `/cuentas` enlaza a `/deudas` desde el patrimonio neto.
    - La captura de gasto y `/nuevo` no se tocan.
22. **Demostración.**
    - `pnpm db:demo` agrega deudas con referencia `demo-deuda-*` y sus movimientos `demo-*`:
      - una que debo, con fecha y cuenta prevista;
      - una que debo, con un pago parcial;
      - una que me deben, sin fecha;
      - un préstamo con un cobro parcial;
      - un apartado a Deudas.
    - Las filas nuevas van al final, por la numeración posicional.
    - `pnpm db:demo:limpiar` borra primero los movimientos y luego las deudas `demo-*`.

## Pantallas

**`/deudas`**, en móvil, de arriba abajo:

- `TituloPagina` "Deudas".
- Hero:
  - "Debo", con el pendiente total en `Cifra` hero;
  - píldoras `pildora-hero`: "Apartado 135,00" (el saldo de Deudas), "Cuota de octubre 385,00" y "Me deben 140,00";
  - tres `Mosaico`: "Nueva deuda", "Prestar" y "Apartar".
- `TarjetaPalida` con la regla de uso (criterio 17).
- `Tarjeta` "Debo":
  - una `FilaLista` por deuda abierta, ordenadas por fecha;
  - en cada fila, un `Avatar` con las iniciales de la persona, la persona en mayúsculas y un subtítulo: "para el 15 dic · Binance USDT", "vence en 3 días", "vencida hace 2 días" o "sin fecha";
  - a la derecha, el pendiente en `Cifra` y debajo "de 520,00";
  - bajo la fila, el aviso de liquidez si no está lista: `Pildora` `negativa` con el texto del criterio 14;
  - al final, un `<details>` "Pagadas (n)".
- `Tarjeta` "Me deben", igual, sin aviso de liquidez.
- Sin deudas, cada tarjeta dice "Nada por aquí" con el enlace "Registrar".

**`/deudas`**, en escritorio:

- hero 7 + regla de uso 5;
- debajo, Debo 7 + Me deben 5.

**`/deudas/[id]`**:

- Hero:
  - persona y sentido;
  - pendiente en `Cifra` hero;
  - píldoras: monto inicial más préstamos, pagado o cobrado, fecha prevista y cuenta prevista;
  - `Progreso` de lo saldado.
- El aviso de liquidez, si lo hay.
- `Tarjeta` con el formulario "Registrar pago" o "Registrar cobro":
  - `CampoMonto`, con el pendiente ya escrito;
  - cuenta en `SelectorPildoras`;
  - `SelectorFecha` y nota;
  - en el pago, una línea con "Deudas tiene X; quedará en Y", en `negativo` si queda bajo cero.
- `Tarjeta` "Historial", con `FilaMovimiento` por movimiento.
- Enlace "Editar" en el encabezado.
- Pagada, el formulario se cambia por la `Pildora` `positiva` "Pagada".
- En escritorio: hero e historial en 7 columnas, y el formulario en 5, fijo al desplazarse, como `TarjetaReparto` en `/nuevo/ingreso`.

**`/deudas/nueva`** y **`/deudas/[id]/editar`**: un solo formulario en una `Tarjeta`:

- sentido en `SelectorPildoras` "Debo · Me deben" (solo al crear);
- persona en `Entrada`;
- "Cuánto se debe hoy" en `CampoMonto` USD;
- fecha prevista con `SelectorFecha` en su variante nueva `futura`;
- cuenta prevista en `SelectorPildoras`, con "Sin definir" y solo en "debo";
- nota;
- en editar, `Boton` `peligro` "Borrar" si no hay movimientos.

En escritorio, una columna de 6 centrada, como `/sobres/repartir`.

**`/deudas/prestar`**:

- persona, `CampoMonto` con la unidad de la cuenta, cuenta y sobre de origen en `SelectorPildoras`;
- `SelectorFecha` del préstamo, la de siempre: hoy, ayer u otra fecha pasada;
- fecha prevista de cobro, en la variante `futura`;
- nota.

En escritorio, 6 columnas centradas.

**`/deudas/apartar`**:

- arriba, el hero con el saldo de Deudas, lo que se debe y la cuota del mes;
- debajo, una `Tarjeta` con el sobre de origen en `SelectorPildoras`, cada uno con su saldo, y `CampoMonto`.

En escritorio, 6 columnas centradas.

**`/cuentas`**: una `TarjetaPalida` nueva, "Patrimonio neto":

- `Dato` Cuentas, `Dato` Me deben (+) y `Dato` Debo (−);
- el neto en `Cifra` `lg`;
- el enlace "Ver deudas".

En móvil va tras la verificación; en escritorio, en la columna de 5, bajo la verificación.

**Piezas nuevas o ampliadas:**

- `SelectorFecha`, variante `futura` (en `src/components/calendario.tsx`):
  - píldoras "Sin fecha" y "Elegir fecha";
  - el calendario deja elegir días futuros y apaga los pasados, pero no los prohíbe: se puede registrar una deuda ya vencida desde el campo nativo;
  - sin JavaScript, el campo de fecha nativo, como hoy.
- `IconoSobre` para el tipo `deudas`:
  - un icono de lucide (`HandCoins`);
  - un tono nuevo en el anillo de Sobres, una rejilla de pino sobre blanco, que se distinga del rayado de Familia y de los puntos de los fondos. Se valida como los demás y se anota en `docs/diseno.md`;
  - se llena hacia lo que se debe: el pendiente de las deudas abiertas que debo, con fecha o sin ella.
- `FilaMovimiento` para los tres tipos nuevos: un círculo neutro con su icono de lucide, elegido al construir y anotado en `docs/diseno.md`. Nunca emojis.
- El `Avatar` con iniciales de persona es la pieza de siempre. A diferencia de los sobres (observación 10), para personas es la convención de los contactos.

Se compara contra `docs/referencias/ui-referencia.png` y `docs/diseno.md`.

## Datos

**Migración** (`pnpm db:generate`, una sola):

- `tipo_movimiento` gana `pago_deuda`, `prestamo` y `cobro_prestamo`;
- `tipo_sobre` gana `deudas`;
- un enum nuevo, `sentido_deuda`: `debo`, `me_deben`.
- Tabla `deudas`, con `.enableRLS()` y sin políticas (`schema.test.ts` lo vigila):
  - `id`;
  - `sentido`;
  - `persona` (text, no nulo);
  - `monto_inicial_centavos` (bigint, no nulo, por defecto 0);
  - `fecha_prevista` (date, nula);
  - `cuenta_prevista_id` (FK a `cuentas`, nula);
  - `nota`;
  - `referencia` (text, con índice único donde no es nula);
  - `creado_en`.
  - Checks: `deudas_monto_valido` y `deudas_cuenta_prevista_solo_debo`, con las comparaciones como texto.
- `movimientos.deuda_id`: FK a `deudas`, nula, con índice.
- `movimientos_forma_por_tipo` reescrito como dice el criterio 8.

**Antes de aplicarla:**

- La revisa `guardian-datos`.
- Se aplica en una base local vacía, donde todas las migraciones corren en una sola transacción, como en producción con la 0004 pendiente, y después en la local de siempre.
- Los valores de un enum no se pueden quitar en Postgres. Por eso la decisión va a un ADR (0012) con `/f-adr`.

**En producción**, el desarrollador corre `pnpm db:migrate:produccion` (la 0004 y esta juntas) y `pnpm db:seed:produccion` para crear el sobre Deudas.

**Consultas**, en `src/db/deudas.ts`:

- las deudas con su pendiente, su total de préstamos y pagos o cobros, y su cuenta prevista;
- una deuda con sus movimientos;
- el sobre Deudas por su tipo, con su saldo y lo recibido en el mes;
- los totales por sentido para el patrimonio.

**Consultas que cambian:**

- `saldosPorSobre`, `saldosPorCuenta` y `saldoDeSobre` cuentan los tres tipos;
- `medidasPorSobre` mide Deudas contra lo que se debe;
- `movimientos-del-periodo` pone los tres en Mover;
- `datosDelReparto` inyecta la regla calculada de Deudas.

**Escrituras**, en `src/db/deudas.ts`:

- registrar, editar y borrar una deuda;
- prestar: la deuda y el movimiento en una transacción;
- pagar y cobrar, con candado y nueva comprobación del pendiente;
- apartar, con candado sobre el origen.

**Semillas y demo:**

- `seed.ts` agrega el sobre Deudas; es idempotente por nombre.
- `semilla-demo.ts` agrega lo del criterio 22, y su limpieza borra en orden de FK.
- Si un movimiento real apunta a una deuda demo, la limpieza falla con el error de la FK y no borra nada real.

**Datos existentes:** no se tocan. Los movimientos de siempre quedan con `deuda_id` nulo, que el check exige. El respaldo y `estado-base` toman la tabla nueva solos.

## Fuera de alcance

- **Pedir prestado con dinero que entra.** Hoy solo se registran deudas que ya existen. Cuando pase, hay que decidir adónde va ese dinero (¿"Por asignar"?) y se hace aparte.
- Perdonar o dar por perdido un préstamo, intereses, cuotas pactadas con calendario y amortización (plan, sección 5).
- Pagos o cobros en bolívares, o que cambian de moneda.
- **Mover entre cuentas** para resolver un aviso de liquidez, por ejemplo de la prima a Binance. El aviso lo dice; mover es de la feature de cuentas y transferencias (observación 1).
- Prestar más sobre un préstamo ya registrado: cada préstamo es su registro. El modelo lo admite (monto inicial más préstamos), pero la pantalla no.
- Cobros pendientes a clientes por trabajo: el plan los deja fuera de "me deben".
- Recordatorios y notificaciones de vencimiento (fase 2), y el panel de patrimonio en el tiempo (fase 3).
- Editar o borrar pagos, préstamos y cobros ya guardados.
- Cambiar desde la pantalla el lugar de Deudas en el reparto.

## Pruebas antes del código

Funciones puras, con su `.test.ts`, viéndolas fallar primero:

- `src/lib/deudas.ts`, criterios 1 a 7 y 15 a 16:
  - `validarDeuda`: persona, monto, fecha y cuenta prevista solo en "debo";
  - `pendienteDe` y `estadoDe`;
  - `prepararPago`, `prepararCobro` y `prepararPrestamo`: las filas con su forma, el monto con `aCentavos`, la moneda 1 a 1 y el tope del pendiente;
  - `montoInicialMinimo`, para editar;
  - `patrimonioNeto`;
  - las referencias nuevas en `captura.ts`.
- `src/lib/cuota-deudas.ts`, `cuotaDeDeudas`, criterio 11:
  - el caso real y su seguimiento en noviembre;
  - con lo apartado;
  - deudas vencidas, sin fecha o pagadas;
  - el redondeo al dólar sin pasar de lo que falta;
  - el cambio de año;
  - entradas inválidas que lanzan.
- `src/lib/reparto.ts`: la regla calculada de Deudas antes de los fijos y el ejemplo del criterio 12. La función de la 004 no cambia de forma: recibe la regla como una fija más.
- `src/lib/liquidez.ts`, `avisosDeLiquidez`, criterio 14: los tres estados, el acumulado por cuenta, el orden por fecha y los textos.
- `src/lib/saldos.ts`, criterio 9:
  - `efectoDe(tipo)`, exhaustivo;
  - `saldosTras` sale de `gastos.ts` a este archivo y usa `efectoDe`;
  - la prueba del invariante con los siete tipos.

Contra la base local, en `scripts/comprobar-005.ts`, con referencias `demo-comprobar-005-*` o ids de captura propios, y dejando la base como estaba:

- "Cuadra" antes y después de registrar, pagar, prestar, cobrar y apartar;
- las sumas de SQL iguales a `saldosTras` sobre todas las filas;
- un pago mayor que el pendiente, rechazado;
- dos pagos en paralelo que nunca pasan del pendiente;
- reintentos sin duplicados;
- el check, que rechaza un `pago_deuda` sin deuda y un tipo viejo con deuda;
- borrar solo sin movimientos.

## Riesgos y decisiones

Decisiones propuestas al especificar, para que el desarrollador las confirme o corrija:

- **Un tipo de sobre propio, `deudas`, y no `fondo`.** Lo explica la trazabilidad.
- **La cuota se calcula al repartir y no se guarda en una regla.** Si se guardara, quedaría vieja al cambiar el mes o al pagar. Por eso Deudas no tiene fila en `reglas_reparto`.
- **Deudas va antes que todos los fijos**, también antes que Gastos del mes, por la regla de uso. Con 1.200,00 alcanza para todos los fijos (385 + 450 + 100 + 25 = 960). Si un mes no alcanzara, Gastos del mes recibiría menos.
- **Cada deuda está lista al empezar el mes de su fecha**, no el día exacto. Es más prudente, porque el cobro de ese mes puede llegar tarde.
- **Pagos y préstamos no son gasto, y el cobro no es ingreso.** El "ahorrado" de la gráfica mensual es ingreso menos gasto, es decir, lo que crece el patrimonio. Ninguno de los tres lo cambia: cambian dinero por deuda o deuda por dinero.
- **Al registrar se escribe lo que se debe hoy**, no el monto original de hace meses. Así no hace falta un campo "ya pagado antes".
- **Deudas puede quedar en negativo**, como cualquier sobre tras un gasto. La cuota del siguiente reparto lo repone.
- **El aviso de liquidez no resuelve nada.** Si el pago exige mover dinero entre cuentas, hace falta Mover, que no existe todavía. En el caso real, el pago del proyecto llega a Binance y de ahí sale el del amigo.
- **Migración junto con la 0004:** los checks comparan como texto. Se comprueba en una base vacía (criterio 8).
- **Tamaño:** 16 tareas. Si se prefiere, se parte en dos features: 005 "lo que debo" (sobre Deudas, pagos, cuota, aviso) y 006 "lo que me deben" (préstamos, cobros, patrimonio neto). El orden de las tareas ya lo permite: el corte está tras la T12.
