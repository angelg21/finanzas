# 001 · Captura rápida de gasto

Fecha: 2026-10-11. Estado: borrador.

## Para qué

Anotar un gasto desde el celular en menos de diez segundos, con menos pasos que en Gestor de Gastos. Si esto es lento, la app se abandona en dos semanas; por eso es la primera feature. Cubre los tres casos reales: pagar en dólares desde una cuenta, pagar en bolívares vendiendo USDT en el momento, y pagar en bolívares del saldo que ya se tenía.

## Trazabilidad al plan

- Sección 4, "El riesgo número uno del proyecto": la captura rápida es la función más importante de la fase 1.
- Sección 4, "Gasto en bolívares, el único caso especial": cuánto USDT se vendió, a qué tasa, para qué categoría; la app crea la transferencia a bolívares y el gasto; la tasa es un campo del movimiento.
- Sección 4, "Sobres y reparto": el sobre de inversión avisa si se intenta gastar desde él.
- Sección 6, fase 1: "Flujo de gasto en bolívares" y "formulario de captura rápida". La parte PWA de esa misma línea queda para la feature 002.

## Criterios de aceptación

Los montos se escriben como los teclea el usuario ("42", "1.234,56", "19.99") y se guardan en centavos enteros. La tasa es bolívares por dólar.

1. ★ **Gasto en dólares.** Dado que escribo monto `42`, pago "Dólares" desde la cuenta Binance, categoría Comida, sobre Gastos del mes y fecha de hoy, cuando guardo, entonces existe un movimiento de tipo `gasto` con `monto_centavos = 4200`, `moneda = USDT`, `monto_usd_centavos = 4200`, cuenta origen Binance, sobre origen Gastos del mes, categoría Comida, `origen = manual`, sin `tasa`. La suma de sobres sigue siendo igual a la suma de cuentas propias.
2. ★ **Gasto en bolívares vendiendo USDT.** Dado que indico que vendí `20` USDT a tasa `241,8` y gasté `2.100` Bs en Comida, cuando guardo, entonces se crean en una sola transacción dos movimientos con la misma fecha: una `transferencia` de Binance a Bolívares con `monto_centavos = 2000` (USDT), `monto_usd_centavos = 2000`, `monto_destino_centavos = 483600` (Bs), `moneda_destino = VES`, `tasa = 241.8000`; y un `gasto` desde Bolívares con `monto_centavos = 210000` (Bs), `moneda = VES`, `monto_usd_centavos = 869` (2.100 ÷ 241,8 = 8,685, redondeado al centavo), `tasa = 241.8000`, sobre Gastos del mes, categoría Comida. El saldo en bolívares de la cuenta Bolívares queda en `273600` centavos de Bs: el vuelto.
3. ★ **Gasto en bolívares del saldo.** Dado que ya tengo bolívares y gasto `500` Bs a tasa `241,8` en Transporte sin vender USDT, cuando guardo, entonces existe un solo movimiento `gasto` desde Bolívares con `monto_centavos = 50000`, `moneda = VES`, `monto_usd_centavos = 207` (500 ÷ 241,8 = 2,068), `tasa = 241.8000`.
4. ★ **Si los bolívares gastados superan los recibidos**, dado que vendí `10` USDT a `240` (2.400 Bs) y escribo que gasté `2.500` Bs, cuando guardo, entonces el gasto se registra completo (`250000` centavos de Bs, `1042` centavos USD) y la cuenta Bolívares queda con saldo negativo de `10000` centavos de Bs; la pantalla lo avisa pero no lo impide, porque el saldo previo en bolívares puede cubrirlo.
5. ★ **Montos inválidos.** Dado que el monto está vacío, es `0`, es negativo o es texto, cuando guardo, entonces no se crea ningún movimiento y veo el mensaje de error junto al campo. `1.234,56` y `1234.56` se aceptan y valen lo mismo.
6. ★ **Tasa.** Dado que el pago es en bolívares, cuando la tasa está vacía, es `0` o negativa, entonces no se guarda nada y veo el error. La tasa acepta coma o punto decimal y se guarda con cuatro decimales. Si el pago es en dólares, la tasa no se pide ni se guarda.
7. ★ **La aritmética de conversión es exacta en centavos.** Dado un monto en USD y una tasa, Bs = redondeo(centavos USD × tasa); dado un monto en Bs y una tasa, USD = redondeo(centavos Bs ÷ tasa). Nunca hay flotantes en el resultado y 0 Bs son 0 USD.
8. **Sobre sugerido.** Dado que elijo una categoría, cuando no he tocado el sobre, entonces el sobre se preselecciona así: Familia → Familia; Regalos → Ocasiones; cualquier otra → Gastos del mes. Siempre puedo cambiarlo.
9. **Inversión es intocable.** Dado que elijo el sobre Inversión, cuando guardo, entonces la app me pide confirmar con un segundo clic en un aviso visible ("Inversión es intocable. ¿Gastar igual?") antes de registrar.
10. **Sobre en negativo.** Dado que el gasto deja el sobre por debajo de cero, cuando guardo, entonces se registra igual y la confirmación lo dice ("Gastos del mes queda en −12,00 USD; reasigna desde otro sobre").
11. **Fecha.** Por defecto hoy, con atajo "Ayer" y un selector de fecha. No se aceptan fechas futuras.
12. **Velocidad.** Dado que abro la pantalla en el celular, entonces el campo de monto tiene el foco y el teclado numérico abierto; las categorías son píldoras en una fila horizontal ordenadas por uso en los últimos 90 días; la cuenta es la última usada (Binance si no hay historial); el sobre viene sugerido; hay un solo botón "Guardar gasto". Nada obligatorio además de monto y categoría. Objetivo: tres toques y un número para un gasto normal en dólares.
13. **Después de guardar.** Veo una confirmación con lo registrado ("42,00 USD en Comida desde Binance") y dos acciones: "Registrar otro" (mismo pago, misma cuenta, categoría despejada) e "Ir al inicio". Los saldos de inicio, sobres y cuentas reflejan el gasto al volver.
14. **Sin JavaScript** el formulario sigue guardando: es un formulario HTML con server action; el foco automático, el teclado numérico y la sugerencia de sobre son mejoras.
15. **Accesos.** El botón "+" de la barra inferior, el botón "Registrar movimiento" de la barra lateral y el mosaico "Gasto" del inicio abren directamente esta pantalla. Los mosaicos "Ingreso" y "Mover" siguen yendo al selector actual.

## Pantallas

**Ruta** `/nuevo/gasto`. El selector `/nuevo` se mantiene para Ingreso y Mover.

**Móvil**, una columna dentro del panel:

1. Cabecera: título "Nuevo gasto" y una fila de tres píldoras Gasto · Ingreso · Mover (la activa en `palido`); las otras dos enlazan al selector.
2. `Tarjeta` del formulario, en este orden:
   - **CampoMonto** (pieza nueva): la cifra a 36 px en negrita con el código de moneda a la derecha, fondo `tarjeta-hover`, `inputMode="decimal"`, foco automático. La moneda que muestra cambia con la forma de pago: USD, USDT o USDC según la cuenta, o Bs.
   - **Forma de pago**: `SelectorPildoras` (pieza nueva) con tres opciones: "Dólares", "Bolívares vendiendo USDT", "Bolívares del saldo". Debajo, según la opción: cuenta de origen (`SelectorPildoras` con las cuentas en dólares) para la primera; para la segunda, dos `Entrada` en una fila: "USDT vendidos" y "Tasa Bs/USD", más la cuenta de donde salen (Binance por defecto); para la tercera, solo "Tasa Bs/USD".
   - **Categoría**: `SelectorPildoras` desplazable en horizontal, cada píldora con `Avatar` pequeño de iniciales y el nombre, ordenadas por uso.
   - **Sobre**: `SelectorPildoras` con los sobres excepto "Por asignar"; el sugerido queda marcado. Inversión muestra la marca "intocable".
   - **Fecha**: píldoras "Hoy" y "Ayer" más una `Entrada` de tipo fecha.
   - **Nota**: `Entrada` opcional, una línea.
   - `Boton` primario ancho completo "Guardar gasto". Si el sobre es Inversión, el primer clic muestra el aviso y cambia el texto a "Sí, gastar de Inversión".
3. Estado de éxito en la misma `Tarjeta`: resumen con `Cifra`, `Pildora` de la categoría y la cuenta, aviso de sobre negativo o de vuelto en bolívares si aplica, y los botones "Registrar otro" (primario) e "Ir al inicio" (secundario).

**Escritorio**, rejilla de doce columnas: el formulario en siete columnas y, en cinco, una `TarjetaPalida` "Antes y después" con el sobre elegido (saldo actual y saldo tras el gasto, `Progreso` si tiene tope) y la cuenta de origen (saldo actual y tras el gasto; en el caso de bolívares, los Bs que quedarán). Se actualiza al cambiar monto, cuenta o sobre, con JavaScript; sin él, muestra los saldos actuales.

**Piezas nuevas**, en `src/components/formulario.tsx`:

- `CampoMonto`: entrada numérica grande con unidad a la derecha; recibe `moneda`, `name`, `defaultValue`, `autoFocus`.
- `SelectorPildoras`: grupo de radios accesible renderizado como píldoras desplazables; recibe `name`, `opciones` (valor, texto, detalle opcional, avatar opcional), `valorInicial`; sin JavaScript funciona como radios nativos. La elegida usa `bg-palido text-palido-texto`.

## Datos

Sin cambios de esquema ni migración. Todo cabe en `movimientos` con el `check` de forma por tipo:

- Dólares: un `gasto` con `cuenta_origen_id`, `sobre_origen_id`, `categoria_id`.
- Bolívares vendiendo USDT: una `transferencia` (cuenta USDT → Bolívares, `monto_destino_centavos` y `moneda_destino = VES`, `tasa`) y un `gasto` desde Bolívares en `VES` con `tasa`. Las dos filas se insertan en una transacción de base de datos.
- Bolívares del saldo: un `gasto` desde Bolívares en `VES` con `tasa`.

Consultas nuevas en `src/db/consultas.ts`: categorías de gasto ordenadas por uso en 90 días, cuentas activas, sobres aptos para gasto, última cuenta usada en un gasto. Operación nueva en `src/db/movimientos.ts`: `registrarMovimientos(filas)` dentro de una transacción. Las semillas y los datos de demostración no cambian.

## Fuera de alcance

- Registrar ingresos y mover dinero entre cuentas o sobres (features siguientes).
- Editar o borrar un gasto ya guardado.
- Crear categorías o cuentas desde el formulario.
- Instalación como PWA, atajos de pantalla de inicio y uso sin conexión (feature 002).
- Captura por Telegram y cualquier interpretación con IA (fase 2).
- Tasa sugerida automáticamente: la escribe el usuario cada vez.

## Pruebas antes del código

Funciones puras en `src/lib/`, cada una con `.test.ts` que se ve fallar antes de implementar:

- `src/lib/dinero.ts`: `aTasa(texto)` → tasa en diezmilésimas como entero (`"241,8"` → `2418000`), rechaza vacío, cero y negativo; `bolivaresDesdeUsd(usdCentavos, tasaDm)` y `usdDesdeBolivares(bsCentavos, tasaDm)` con redondeo al centavo y aritmética entera; `formatearTasa(tasaDm)` para mostrarla.
- `src/lib/gastos.ts`: `prepararGasto(entrada)` devuelve las filas a insertar para los tres casos (criterios 1, 2, 3 y 4 con sus números exactos) o un error con mensaje para los criterios 5 y 6; `sobreSugerido(nombreCategoria, sobres)` para el criterio 8; `fechaValida(texto, hoy)` para el criterio 11.

Lo demás se prueba después de mirar, en `/f-verify`.

## Riesgos y decisiones

- **Tasa como entero en diezmilésimas** en memoria (la base ya la guarda como `numeric(14,4)`): evita flotantes en la conversión y cumple la regla de centavos. Se registra en el ADR si durante la construcción se confirma.
- **Los bolívares siempre pertenecen al sobre de gastos del mes** por regla del plan; en el flujo en bolívares el sobre de la venta no se toca (es una transferencia) y el gasto sale del sobre elegido. Si el usuario elige otro sobre para un gasto en Bs, se respeta: la regla del plan es un valor por defecto, no un candado.
- **"Última cuenta usada"** mira el último gasto manual; sin historial, Binance. No se guarda preferencia aparte.
- **Riesgo de velocidad**: el selector de forma de pago añade un toque en el caso de bolívares. Se acepta porque el caso en dólares sigue en tres toques; se mide en `/f-build` con el cronómetro en la mano.
- **Sin autenticación todavía**: la server action es pública como todo lo demás. Se trata en `/f-audit` al cerrar la fase 1 y antes de desplegar.
