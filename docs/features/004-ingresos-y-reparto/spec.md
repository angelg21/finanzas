# 004 · Ingresos y reparto a los sobres

Fecha: 2026-10-14. Estado: aprobada.

## Para qué

Hoy la app solo registra gastos. Cuando el desarrollador cobra, no hay cómo anotarlo, y los sobres no se llenan con dinero real: "Ingreso" en `/nuevo` no lleva a ninguna parte. El plan pide que el reparto ocurra el día del cobro, antes de gastar nada: "Primero te pagas a ti". Esta feature registra el ingreso, propone el reparto según las reglas, deja ajustarlo y lo guarda con un clic. Además da una pantalla para editar las reglas, porque las sembradas no reproducen la tabla del plan.

## Trazabilidad al plan

- Fase 1: "Sobres con reglas de reparto y confirmación de un clic" (línea 219), y "los ingresos y movimientos entre cuentas" que faltan (línea 217). Los movimientos entre cuentas quedan para otra feature.
- Sección 4, línea 153: "Al registrar un ingreso, la app propone el reparto según las reglas: monto fijo a gastos, monto fijo a familia, el resto por prioridad y porcentaje, con tope en el sobre de emergencia. Se confirma con un clic y se puede ajustar."
- ADR 0002: cada ingreso cae en "Por asignar" y el reparto son reasignaciones, que no tocan cuentas. "Por asignar" debe quedar en cero.
- ADR 0006: un ingreso en la cuenta de la prima entra en "Por asignar" como cualquier otro.

Decisiones del desarrollador al especificar (2026-10-14):

- **los montos fijos se cubren una vez al mes**, no en cada cobro;
- **se incluye una pantalla para editar las reglas**.

## Criterios de aceptación

### El reparto

1. ★ **Suma exacta.** Dado un monto a repartir, la propuesta asigna centavos enteros a cada sobre y lo que no tenga destino queda como "sin asignar". La suma de lo asignado y lo sin asignar es exactamente el monto. Ningún sobre recibe un monto negativo.
2. ★ **Fijos primero, una vez al mes.**
   - Las reglas fijas se atienden antes que las de porcentaje, sin importar su `orden`. Entre fijas, por `orden`.
   - Lo que pide una regla fija es su valor menos lo que ese sobre ya recibió desde "Por asignar" en el mes de la fecha del ingreso (día de Caracas).
   - Ejemplos con la regla de Gastos del mes en 450:
     - si ya recibió 450 en octubre, un segundo cobro de octubre le propone 0;
     - si recibió 200, le propone 250.
   - Si el monto no alcanza para todos los fijos, se llenan en orden hasta agotarlo y no queda nada para los porcentajes.
3. ★ **Porcentajes sobre lo que queda.** Lo que queda tras los fijos se reparte entre las reglas de porcentaje en proporción a su valor (puntos base). El redondeo se cuadra por mayor residuo y, en los empates, por `orden`, de modo que la suma sea exactamente lo que quedaba.
4. ★ **Topes.**
   - Un sobre con `tope_centavos` (Emergencia; una meta con monto objetivo) nunca recibe en la propuesta más de lo que le falta para el tope: `tope − saldo`, y 0 si ya llegó.
   - Lo que le sobra se reparte entre los demás sobres de porcentaje en proporción a sus valores, como dice el plan ("cuando esté lleno, esa fila se reparte entre metas e inversión").
   - Si todos llegaron a su tope, el resto queda sin asignar.
5. ★ **Ejemplo del plan, con las reglas sembradas.** Un primer cobro de octubre de 1.200,00 USD, sin nada recibido en el mes y Emergencia lejos del tope, propone:
   - Gastos del mes 450,00, Familia 100,00 y Ocasiones 25,00;
   - de los 625,00 que quedan: Emergencia 250,00, Planes 187,50 e Inversión 187,50.

   Un segundo cobro de octubre de 800,00 propone 320,00 / 240,00 / 240,00, sin fijos.

### El ingreso

6. ★ **Cae en la cuenta y en "Por asignar".**
   - Registrar un ingreso guarda una fila `ingreso` con su cuenta destino, el sobre "Por asignar", su categoría de ingreso, la fecha y la nota.
   - Se guarda también una fila `reasignacion` de "Por asignar" a cada sobre con monto mayor que cero. Las reasignaciones van en USD, como en el demo.
   - Las cuentas válidas son las de USD, USDT y USDC, convertidas 1 a 1 a USD. La cuenta en bolívares no se ofrece.
7. ★ **Todo o nada, y sin duplicados.**
   - El ingreso y sus reasignaciones se insertan en una sola sentencia: o se guardan todas o ninguna.
   - Cada captura lleva un `idCaptura`. Las referencias son `captura-<uuid>-ingreso` y `captura-<uuid>-reasignacion-<sobreId>`.
   - Un reintento con el mismo id no duplica nada. Es "ya estaba" solo si lo guardado es igual y reciente, con las mismas reglas que la captura de gasto (ADR 0010).
8. ★ **Lo que se ve es lo que se guarda.**
   - El formulario muestra la propuesta con un campo por sobre, y se puede cambiar cualquier monto.
   - El servidor guarda exactamente los montos confirmados; no vuelve a calcularlos.
   - Se rechazan, con el error en su campo:
     - montos negativos o con más de dos decimales;
     - una suma mayor que el ingreso;
     - un sobre que sea "Por asignar", que esté inactivo o que no exista.
   - Si la suma es menor, se pide un segundo clic: "Quedan X en Por asignar".
9. ★ **El invariante se mantiene.** Tras guardar, la suma de los sobres es igual a la suma en USD de las cuentas: la pantalla Cuentas sigue diciendo "Cuadra". Con todo repartido, "Por asignar" queda donde estaba antes del ingreso.

### Repartir lo que ya está en "Por asignar"

10. ★ **Saldo existente.**
    - Si "Por asignar" tiene saldo (un ingreso guardado con algo sin repartir, o lo que traiga después el saldo inicial de una cuenta), `/sobres` y el inicio muestran un enlace "Repartir". Lleva a una pantalla con la misma propuesta y los mismos ajustes, con el saldo como monto.
    - Al confirmar se guardan solo reasignaciones.
    - Nunca se reparte más que el saldo, ni con dos pestañas a la vez: la escritura se hace con un candado y vuelve a comprobar el saldo dentro de la transacción.

### Las reglas

11. ★ **Editar las reglas.** En `/sobres/reglas` cada sobre activo, salvo "Por asignar", tiene una de tres opciones: monto fijo mensual, porcentaje o sin regla.
    - Fijo: de 0,01 a 21.474.836,47 USD (`cabeEnRegla`).
    - Porcentaje: de 0,01 % a 100 %, con hasta dos decimales.
    - No se guarda si los porcentajes no suman exactamente 100 %. Si no hay ningún porcentaje, se avisa de que lo que quede tras los fijos se quedará en "Por asignar".
    - El tope de Emergencia se edita aquí.
    - El aporte de un sobre de tipo fondo (Ocasiones) se muestra, pero se cambia en su desglose, como hoy.
    - Guardar es una transacción: todas las reglas cambian juntas o ninguna.
    - Cambiar una regla no toca ningún movimiento pasado: solo cambia las propuestas siguientes.
12. ★ **La base protege el porcentaje.** Un check en `reglas_reparto` impide un porcentaje mayor que 10000 puntos base.

### Lo de siempre

13. **Sin JavaScript.**
    - En `/nuevo/ingreso`, el primer envío muestra la propuesta con sus campos y el segundo la guarda.
    - Con JavaScript, la propuesta se recalcula al escribir el monto o cambiar la fecha, y se guarda con un clic.
    - `/sobres/reglas` y `/sobres/repartir` son formularios normales.
14. **Sesión y capas.**
    - Cada página empieza con `await exigirSesion()`, y cada acción con `leerSesion` y su `return`.
    - La aritmética vive en `src/lib/` y las escrituras en `src/db/`.
    - Los errores se registran con `registrarFalla`.
15. **Accesos.** El mosaico "Ingreso" del inicio, el de `/nuevo` y la píldora "Ingreso" de la captura de gasto llevan a `/nuevo/ingreso`. "Mover" sigue en el selector.
16. **La captura de gasto no se toca.** `/nuevo/gasto` no se vuelve más lenta; solo cambia el enlace de su píldora "Ingreso".

## Pantallas

**`/nuevo/ingreso`**, en móvil:

- Cabecera como la de la captura de gasto, con las píldoras Gasto · Ingreso · Mover e Ingreso activa.
- `Tarjeta` con el formulario:
  - `CampoMonto`, con la unidad de la cuenta;
  - Cuenta: `SelectorPildoras` con Binance, Segunda billetera, Efectivo y Cuenta prima. Viene elegida la cuenta del último ingreso, o la primera si no hay ninguno;
  - Categoría: `SelectorPildoras` con `categoria`: Sueldo remoto, Proyecto local y Otros ingresos, ordenadas por uso;
  - `SelectorFecha` y Nota.
- **TarjetaReparto** (pieza nueva, en `src/components/reparto.tsx`), una `TarjetaPalida`:
  - título "Reparto";
  - una fila por sobre con regla: nombre, una pista y un campo de monto (`Entrada` con `inputMode="decimal"`, 16 px en el celular). Las pistas son, por ejemplo:
    - "fijo · faltan 250 este mes";
    - "40 %";
    - "tope 2.700 · faltan 650";
  - un pie con "Repartido 1.200,00 de 1.200,00" o "Quedan 50,00 en Por asignar".
- Botón principal "Registrar y repartir". El estado de éxito ofrece "Registrar otro" e "Ir a sobres".

**`/nuevo/ingreso`**, en escritorio: el formulario en 7 columnas y `TarjetaReparto` en 5, como el "Antes y después" de la captura de gasto.

**`/sobres/repartir`**:

- arriba, el saldo de "Por asignar" en el hero;
- debajo, `TarjetaReparto` con ese monto y el botón "Repartir".

Se entra desde el hero "Por asignar" de `/sobres` (que gana el enlace) y desde el aviso del inicio "Tienes X sin asignar".

**`/sobres/reglas`**:

- `Tarjeta` con una fila por sobre: nombre, `SelectorPildoras` Fijo · % · Ninguna y el campo del valor. Ocasiones lleva su aporte y el enlace "Desglose";
- debajo, el tope de Emergencia;
- el pie "Porcentajes: 100 %", en `negativo` si no suman 100;
- botón "Guardar reglas".

Se entra desde `/sobres`, con el enlace "Reglas de reparto" en el encabezado.

Se compara contra `docs/referencias/ui-referencia.png` y `docs/diseno.md`, igual que la captura de gasto.

## Datos

- **Migración** (`pnpm db:generate`): un check `reglas_reparto_porcentaje_maximo`, `tipo <> 'porcentaje' or valor <= 10000`. Antes de aplicarla, se comprueba que las reglas existentes, en local y en producción, cumplen: las sembradas son 4000, 3000 y 3000. En producción la corre el desarrollador con `pnpm db:migrate:produccion` antes de publicar.
- **Sin tablas nuevas.** El reparto son reasignaciones, como dice el ADR 0002, que descartó una tabla de "hijos".
- **Consultas nuevas**, en `src/db/reparto.ts`:
  - las reglas activas con su sobre (tipo, tope, saldo), ordenadas;
  - lo recibido desde "Por asignar" por sobre en un mes;
  - las categorías de ingreso por uso;
  - la cuenta del último ingreso;
  - el sobre "Por asignar" por su tipo. Si no existe o está inactivo, la página lo dice y no deja guardar.
- **Escrituras:**
  - `registrarCaptura` se generaliza para releer todas las filas `captura-<uuid>-%` de origen manual, y no solo `-gasto` y `-transferencia`;
  - `repartirPorAsignar` usa `pg_advisory_xact_lock` y vuelve a comprobar el saldo;
  - `guardarReglas` es una transacción.
- **Semillas y demo:** sin cambios. Las reglas sembradas siguen; el desarrollador las ajusta en producción desde `/sobres/reglas`. El demo ya imita la decisión: el segundo cobro del mes va solo a los porcentajes.
- Los datos existentes no se tocan.

## Fuera de alcance

- Ingresos en bolívares: piden una tasa y chocan con "los bolívares son de Gastos del mes".
- Mover entre cuentas, por ejemplo de la prima a Binance (observación 1), y el saldo inicial de una cuenta (observación 3). Van en la feature de cuentas y transferencias.
- Editar o borrar un ingreso o un reparto ya guardado.
- Reglas distintas según el monto del ingreso (las columnas "con 1.200" y "con 2.000" del plan).
- Reordenar las reglas arrastrando, el reparto automático o programado, y las metas con cuota mensual calculada (fase 2).
- Cambiar las semillas.

## Pruebas antes del código

Funciones puras, con su `.test.ts`, viéndolas fallar primero:

- `src/lib/reparto.ts`, `proponerReparto({ monto, reglas, recibidoEnElMes, saldos })`, criterios 1 a 5:
  - suma exacta;
  - fijos primero y una vez al mes, también cuando el monto no alcanza;
  - porcentajes por mayor residuo con desempate por orden;
  - tope con redistribución, y todos en su tope;
  - sin reglas, o solo fijos;
  - los dos cobros del ejemplo;
  - montos enormes y entradas inválidas que lanzan.
- `src/lib/ingresos.ts`, criterios 6 a 8:
  - `prepararIngreso(entrada, hoy, cuenta)`: el monto con `aCentavos`, la fecha válida, la moneda 1 a 1, y las filas de ingreso y reasignaciones sin las de 0;
  - `validarAsignaciones(monto, asignaciones, sobresValidos)`: suma, signo, decimales, sobres permitidos y el "quedan X";
  - las referencias de captura de ingreso y reasignación.
- `src/lib/gastos.ts`: `saldosTras` ampliado a ingreso y reasignación, para comprobar el invariante (criterio 9).
- `src/lib/reglas.ts`, `validarReglas(entradas)`, criterio 11: porcentajes con decimales a puntos base, suma de 100 %, rangos y "sin regla".

Contra la base local, con referencia `demo-comprobar-004-*` y dejando la base como estaba, en `scripts/comprobar-004.ts`:

- ingreso y reparto con "Cuadra" antes y después;
- reintento sin duplicados;
- repartir en paralelo sin pasarse del saldo.

## Riesgos y decisiones

- **"Una vez al mes" se mide por lo recibido desde "Por asignar".** Cuenta lo que dio el reparto: el de un ingreso, "Repartir" y "Apartar". Lo que se mueve a mano con Mover no lo cubre ni hace que lo pida otra vez (criterio 10 de la 007, decidido por el desarrollador el 2026-10-22).
- **La propuesta en el cliente y en el servidor** sale de la misma función pura. Si los saldos cambian entre que se abre la pantalla y se guarda, el servidor guarda lo confirmado: los montos son decisión del usuario, y el tope es una regla para proponer, no un candado.
- **Por asignar se identifica por su tipo.** No hay índice único. La semilla crea uno; si hubiera dos, se usa el de menor `orden` y se registra en las notas.
- **Las reglas sembradas no dan la tabla del plan** (187,50 y 187,50 frente a 175 y 200). Se acepta: la pantalla de reglas existe para eso.
- **`reglas_reparto.valor` sigue siendo integer** (riesgo menor ya aceptado en el ADR 0010), con el tope validado en la acción.
