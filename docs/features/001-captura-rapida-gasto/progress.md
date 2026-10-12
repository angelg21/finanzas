# 001 · Progreso

Rama: `feat/001-captura-rapida-gasto`. Spec: `spec.md`.

## Tareas

Cada tarea cabe en 30 a 60 minutos y termina en verde con un commit. Se marca con la fecha al cerrarla.

- [x] T1 · (2026-10-11) `src/lib/dinero.ts`: `aTasa`, `bolivaresDesdeUsd`, `usdDesdeBolivares`, `formatearTasa`. Pruebas primero (criterios 6 y 7), verlas fallar, implementar.
- [x] T2 · (2026-10-11) `src/lib/gastos.ts`: `prepararGasto` para los tres casos con los números exactos de los criterios 1 a 4, el mínimo de 1 centavo del 7 y los errores de 5 y 6; `sobreSugerido` (8). `src/lib/fechas.ts`: `hoyEnCaracas` y `fechaValida` (11). Pruebas primero.
- [x] T3 · (2026-10-11) `src/db/consultas.ts`: categorías de gasto por uso en 90 días, cuentas activas con `es_propia`, sobres aptos para gasto, última cuenta propia en dólares usada en un gasto. `src/db/movimientos.ts`: `registrarMovimientos` en transacción. Lanzar `guardian-datos` antes de dar por cerrada.
- [x] T4 · (2026-10-11) `src/app/nuevo/gasto/acciones.ts`: `registrarGasto` con zod, confirmación de Inversión, revalidación de `/`, `/movimientos`, `/sobres`, `/cuentas` y estado de éxito con el resumen.
- [x] T5 · (2026-10-11) `/cuentas`: el total y el cuadre suman todas las cuentas activas, también la de la prima, que conserva su marca (criterio 16).
- [x] T6 · (2026-10-11) Piezas `CampoMonto` y `SelectorPildoras` en `src/components/formulario.tsx`, con radios nativos y la elegida en `palido`; tono `palida` en `Pildora`.
- [x] T7 · (2026-10-11) Pantalla `/nuevo/gasto` en móvil: cabecera con píldoras de tipo, formulario completo en el orden de la spec, estado de éxito con "Registrar otro" e "Ir al inicio", foco y teclado numérico.
- [x] T8 · (2026-10-11) Escritorio: `TarjetaPalida` "Antes y después" con saldos del sobre y la cuenta, actualizada al cambiar monto, cuenta o sobre. Enlaces del "+", de "Registrar movimiento" y del mosaico "Gasto" a la nueva ruta.
- [ ] T9 · `pnpm capturas -- /nuevo/gasto /cuentas` en claro y oscuro, comparar con las referencias y la sección "Pantallas"; cronometrar un gasto en dólares desde el celular; ajustar.
- [x] T10 · (2026-10-11) Documentos: ADR nuevo "la cuenta de la prima cuenta en el cuadre" (y la tasa en diezmilésimas) con `/f-adr`; invariante en el plan (sección 4) y en `CLAUDE.md`; plan (fase 1: casilla del formulario de captura); diseño (piezas nuevas y tono `palida`); observaciones si cambió algo.

## Validación en navegador

El desarrollador anota aquí, con fecha, qué pantallas miró y en qué ancho. Sin esta nota no se pasa a `/f-verify`.

-

## Etapas

- [x] Spec leída y corregida por el desarrollador (2026-10-11)
- [ ] Construida (todas las tareas con commit)
- [ ] Validada en navegador
- [ ] Verificada: `pnpm verify` en verde, cada ★ con su prueba
- [ ] Revisada: veredicto APTO PARA FUSIONAR
- [ ] Fusionada en `main` el AAAA-MM-DD

## Notas

Lo que se aprendió, lo que quedó fuera y por qué.

- 2026-10-11 · Revisión de la spec antes de construir. Corregido: el gasto del criterio 2 vale 868 centavos, no 869 (doble redondeo). Decidido con el desarrollador: se permite gastar desde la cuenta de la prima y su saldo entra en el cuadre (criterio 16); la forma de pago empieza siempre en Dólares; montos sin separador de miles; "hoy" en hora de Caracas; un gasto en Bs que vale menos de medio centavo se guarda con 1 centavo; se acepta la diferencia cambiaria de la cuenta Bolívares.
- 2026-10-11 · T2 sumó dos funciones puras que la spec no nombraba y la construcción necesita: `tasaDecimal` (la tasa como el texto `"241.8000"` que guarda `numeric(14,4)`) y `diaAnterior` (el atajo "Ayer"). `prepararGasto` recibe `hoy` como segundo argumento y devuelve todos los errores por campo a la vez.
- 2026-10-11 · `guardian-datos` sobre T3: APTO CON CAMBIOS. Atendido ya: `aCentavos` y `aTasa` leían con `Number`, así que "1e3" valía 1.000 y "0x10" valía 16; ahora solo aceptan cifras y un decimal, y redondean el tercer decimal sin flotantes ("1.005" → 101). La cuenta de respaldo ya no depende solo del nombre "Binance". `registrarMovimientos` es un solo INSERT, atómico por sí mismo, sin BEGIN ni COMMIT aparte; un lote con una fila inválida sigue sin dejar ninguna fila. Queda como condición:
  - **T4**: el `check` de la base solo valida la forma. La acción acepta `sobreId` solo si está en `sobresParaGasto()` y `categoriaId` solo si está en `categoriasDeGastoPorUso()`. Lee las cuentas de `saldosPorCuenta()` (activas), con la moneda de la base y no del formulario, y la cuenta Bolívares como la cuenta VES activa. El botón se desactiva mientras se envía (doble toque).
  - **T5 y T10**: `saldosPorCuenta` y `saldosPorSobre` filtran por activa/activo. Una cuenta o un sobre desactivado con saldo descuadra. El ADR decide entre sumar todo sin filtrar o "solo se desactiva con saldo cero". T10 también corrige los comentarios de `src/db/schema.ts` sobre "cuentas propias" y "no cuenta en los sobres".
  - **Antes de T7**: los gastos que se guarden al validar en el navegador llevan `origen = manual` y ninguna referencia, y `db:demo:limpiar` no los borra. En la base local, que hoy solo tiene filas `demo-*`, se borran al terminar la validación con `delete from movimientos where origen = 'manual' and referencia_externa is null`. Nunca en una base con datos reales.
  - **Para `/f-audit`**: repetir la prueba del lote inválido contra el pooler de Supabase (puerto 6543). Además, `src/db/semilla-demo.ts` usa `Math.round(usd * tasa)` y `toFixed` fuera de `dinero.ts`.
- 2026-10-11 · T4 añadió `saldosTras` a `src/lib/gastos.ts`, una función pura con pruebas. Aplica las filas a los saldos para el resumen tras guardar y le servirá al "Antes y después" de T8; así la acción no hace otra consulta después de insertar. La confirmación de Inversión viaja como `confirmarSobre=<id>`: si se cambia de sobre después del aviso, no vale. La acción todavía no tiene pantalla; se ejercita de punta a punta en T7.
- 2026-10-11 · Desde el celular, por la IP de la red, Next 16 bloqueaba sus recursos de desarrollo y la app no arrancaba: el botón de tema no respondía, ni el foco ni la sugerencia de sobre. `next.config.ts` permite las IP privadas en `allowedDevOrigins`, solo en desarrollo. Comprobado con una captura entrando por 10.15.18.252: ya aparece la insignia de Next y no hay ninguna solicitud bloqueada.
- 2026-10-11 · T7, cómo quedó y la evidencia:
  - Lo que se ve según la forma de pago se decide en CSS con `:has()` sobre el radio marcado: funciona sin JavaScript y no parpadea al cargar.
  - React 19 reinicia el formulario al terminar cada acción. Por eso el estado lleva `ronda` y los campos se montan de nuevo con lo tecleado.
  - "Hoy" y "Ayer" son un grupo de radios `atajoFecha` que la acción ignora; sin JavaScript manda el campo de fecha.
  - Piezas añadidas: `EnlaceBoton`, el mismo estilo que `Boton` pero como enlace, para "Registrar otro" e "Ir al inicio" sin JavaScript; y `envolver` en `SelectorPildoras`, para que las tres formas de pago se vean sin desplazar.
  - Límite de plataforma: iOS Safari no abre el teclado con el foco automático sin un toque previo. El campo recibe el foco, pero el teclado solo se abre solo en Android. Se mide en T9.
  - Evidencia, con el formulario enviado como un navegador sin JavaScript (`curl` con los campos ocultos de Next) contra la base local:
    - criterio 1: 4200 USDT = 4200;
    - criterio 2: transferencia 2000 → 483600 a `241.8000` y gasto de 210000 VES = 868, con aviso del vuelto;
    - criterios 5 y 6: errores junto al campo, también con "1e3";
    - criterio 9: primero el aviso y, confirmado, se guarda;
    - criterio 11: rechaza 2099-01-01;
    - criterio 16: gasto desde la cuenta de la prima y `/cuentas` sigue diciendo "Cuadra con los sobres" (el cuadre anterior habría dado 528464 contra 527864);
    - envíos hostiles: sobre "Por asignar", una categoría de ingreso y Bolívares como cuenta en dólares, todos rechazados.
    - Las 11 filas de prueba se borraron después; la base vuelve a 118 filas, todas `demo-*`.
- 2026-10-11 · El desarrollador pidió un calendario acorde con la app: el del navegador "está muy feo" y no se puede estilizar. Ahora es `SelectorFecha` (`src/components/calendario.tsx`), con píldoras Hoy, Ayer y Otra fecha y un calendario propio. Las funciones de fecha (`celdasDelMes`, `moverMes`, `mesDe`, `etiquetaFecha`, `fechaLarga`, `nombreMes`) son puras, tienen pruebas en `src/lib/fechas.test.ts` y se vieron fallar antes de implementarlas. Sin JavaScript, el campo nativo dentro de `<noscript>`. Lo vi abierto en claro y en oscuro, con el formulario abierto a mano solo para la captura. Esa captura destapó un choque de clases: "Hoy" no se marcaba porque dos fondos competían en el mismo elemento. Ahora la forma de la píldora va aparte de sus colores.
