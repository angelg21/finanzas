# 007 · Progreso

Rama: `feat/007-ajustes-de-uso`. Spec: `spec.md`.

## Tareas

- [x] T1 · (2026-10-17) `src/lib/mover.ts` y `src/lib/etiquetas.ts`, con su prueba mínima primero.
- [x] T2 · (2026-10-17) Deshacer un pago o un cobro: escritor con candados, `/movimientos/[id]` para esos tipos y las filas del historial de la deuda enlazadas (criterios 1 a 3).
- [x] T3 · (2026-10-17) Etiquetas en `/movimientos`: filtro en las consultas, las píldoras y el total (criterios 4 a 6).
- [x] T4 · (2026-10-17) `/nuevo/mover`: escritor con candado, acción con `conFallas`, confirmación de Inversión y enlaces desde Registrar y `/sobres` (criterios 7 a 9).
- [x] T5 · (2026-10-17) Plan, diseño y observaciones.

## Validación en navegador

- 2026-10-22, el desarrollador: recorrió la lista de pasos que el agente le dio para esta feature (lo que se ve en pantalla, sin carreras ni fallas de red, que van en `/f-verify`) y respondió "sí, está verificado". No dijo en qué ancho.

## Etapas

- [x] Spec escrita a partir del pedido del desarrollador (2026-10-17)
- [x] Construida (todas las tareas con commit, 2026-10-17)
- [x] Validada en navegador (2026-10-22)
- [x] Verificada: `pnpm verify` en verde, cada ★ con su prueba (2026-10-22)
- [ ] Revisada: veredicto APTO PARA FUSIONAR
- [x] Fusionada en `main` el 2026-10-17, por pedido del desarrollador antes de validar, verificar y revisar (ver notas)

## Notas

- 2026-10-17 · El desarrollador pidió los tres arreglos ya, con las pruebas anotadas para después. En cola, en este orden: tercera revisión de la 002 (se cortó al reiniciar la sesión), `/f-verify` y `/f-review` de la 006, y `/f-verify` y `/f-review` de la 007.
- T2: `deshacerPagoOCobro` en `src/db/guardar-deudas.ts` toma el candado de la deuda y, en un cobro, después el de "Por asignar": el mismo orden en todas partes (ningún camino toma el del reparto y luego el de la deuda).
- T3: la etiqueta se lee aparte con `leerEtiqueta`, sin tocar `Filtros` ni las pruebas de la 003, y viaja en `enlace()` de la página. La lista de etiquetas es una consulta más (`etiquetasDelPeriodo`), sobre las notas con #.
- T4: `src/db/mover.ts` con el candado del origen, como apartar; el reintento se reconoce antes de mirar el saldo. "Mover" de Registrar lleva ahora a `/nuevo/mover`.
- Recorrido de punta a punta (2026-10-17) en Edge sin ventana contra el servidor de desarrollo y la base local, con «Cuadra con los sobres» tras cada paso (29 de 29): mover 10 de Gastos del mes a Familia y de vuelta; pasar del saldo del origen, rechazado; desde Inversión, la advertencia sin mover y luego "Sí, mover de Inversión"; un gasto con "#Prueba007", su píldora, el filtro "#prueba007 · 3,00" y una etiqueta inválida que no filtra; registrar y deshacer un cobro de Carlos y un pago a Papás desde su fila del historial, con "Deshecho" al volver. La base terminó con sus 121 movimientos.
- **Fusión adelantada (2026-10-17)**, por pedido del desarrollador ("arréglalo ya, sin perder tiempo en pruebas; anota las pruebas para después"): con `pnpm verify` en verde y el recorrido, sin validación del desarrollador, `/f-verify` ni `/f-review`. En cola para `/f-verify 007`: deshacer un cobro ya repartido (Por asignar que no alcanza), carreras de deshacer contra repartir y de mover contra repartir, y `scripts/comprobar-007.ts` con los ★.
- **/f-verify (2026-10-22), sobre `main`.** Una prueba por criterio ★, escrita desde su texto:
  - ★ 1: `src/app/(con-sesion)/movimientos/[id]/valores.criterios.test.ts`, la fila de un pago o un cobro enlaza a `/movimientos/[id]` desde Movimientos o desde la deuda, y se vuelve a la deuda con "Deshecho". `comprobar-007`: el pago y el cobro se abren con su tipo, monto, persona y cuenta; ningún otro tipo, tampoco el préstamo, y deshacer por id otra cosa responde "no existe".
  - ★ 2 y ★ 3: `scripts/comprobar-007.ts`, contra la base local con los datos de demostración, que deja como estaba (33 de 33 ✓):
    - deshacer el cobro y el pago deja cuentas y sobres exactamente como antes de cada uno, y el préstamo y la deuda recuperan su pendiente (50 y 100); el cuadre, después de cada paso;
    - con 15 en Por asignar, deshacer un cobro de 20 responde "Por asignar tiene 15,00; le faltan 5,00" y no cambia nada;
    - una deuda pagada y un préstamo cobrado del todo vuelven a "abierta" con todo su pendiente;
    - cuatro carreras de deshacer un cobro contra un reparto con 20 en Por asignar: gana uno solo y nunca baja de 0; cuatro de deshacer un pago de 40 contra un pago de 70 preparado como si la deuda debiera 100: la deuda termina en 100 o en 30, nunca pagada de más.
  - ★ 6: lo reemplazó la spec 008 (etiquetas como entidad, `?etiqueta=` es su id); se verifica en su ★ 5.
  - ★ 7: `comprobar-007`: una reasignación de hoy de Planes a Gastos del mes por 10,00 con su nota; más que el saldo, la base vuelve a mirar y no guarda; justo el saldo sí y el origen queda en 0, y ahí ni 0,01; al mismo sobre o a uno que no existe, la base lo rechaza; cuatro pares de movimientos de 60 a la vez desde 100: solo cabe uno; cuatro carreras de mover desde Por asignar contra un reparto: gana uno. `src/lib/mover.test.ts` cubre los límites del formulario. `pnpm humo` con sesión: `/nuevo/mover` → 200.
  - ★ 8: `src/lib/mover.test.ts` ("★ 8 · desde Inversión pide confirmar, y solo con la confirmación sale la fila"); el texto de la confirmación está en `formulario-mover.tsx` y lo vio el desarrollador.
  - ★ 9: `comprobar-007`: el mismo id dos veces, después de que el primero vaciara el origen, devuelve lo guardado y no "sin saldo", con una sola fila. La sesión y `conFallas`: `src/app/sesion.criterios.test.ts`, `src/app/fallas.criterios.test.ts` y `comprobar-002-servidor`.
  - `pnpm verify --forzar`: `Tests  940 passed (940)`, `✓ subida (6.8 s)`, `✓ /nuevo/mover → 200`, `✓ verify:full en verde en 43.7 s. Árbol sellado.`
- **Revisión (2026-10-22), primera vuelta:** `revisor`, **NO APTO**, sobre `14c19ea`, con `pnpm verify --forzar` en verde y `comprobar-007` 33 de 33. Hallazgos:
  1. **Medio-alto, dinero.** `recibidoDesdePorAsignarPorMes` (004) y `sobreDeudas().recibidoEnElMesCentavos` (005) sumaban lo que salía de Por asignar y no restaban lo que volvía, que antes de Mover no existía. Ir y volver 10 entre Por asignar y Deudas subía la cuota de octubre de 310,00 a 315,00 sin que cambiara ningún saldo; con un fijo como Familia, el reparto siguiente lo daba por cubierto y mandaba ese dinero a los porcentajes.
  2. **Bajo.** `/nuevo/mover` elegía "Por asignar" como origen sin que la spec lo pidiera: olvidar tocar "De" sacaba dinero de un sobre no elegido, el envío que dispara el 1.
  3. **Bajo.** Los avisos de éxito vivían en la dirección: "Deshecho" quedaba junto al error del pago siguiente, y "Movido" volvía al recargar.
  4. **Bajo.** Deshacer un cobro ya repartido ofrecía "Sí, deshacer" y solo después decía que Por asignar no alcanzaba, sin nombrar Mover.
  5. **Bajo, estructura.** `guardar-deudas.ts` (354) y `editar-movimientos.ts` (330) pasaban el aviso de 320, y la lectura de deshacer vivía en el archivo de editar.
  6. **Bajo, pruebas.** Los ★ 8 y 9 no tenían prueba en la acción: `comprobar-007` llamaba directo a `src/db`.
- Arreglos (2026-10-22):
  - **1**: las dos consultas cuentan neto: lo que va de Por asignar al sobre, menos lo que vuelve del sobre a Por asignar, en el mes. Para los fijos nunca menos de cero; para Deudas el neto tal cual, porque solo reconstruye lo apartado al empezar el mes. `comprobar-007` ahora va y vuelve 10 entre Por asignar y Deudas, y entre Por asignar y Familia, sin que cambien lo recibido ni la cuota; manda 15 y devuelve 5 (cuenta 10); y devuelve de Planes más de lo recibido (queda en 0). Con el código anterior, 3 ✗ ("cuota 31000→31500"); con el arreglo, en verde. `comprobar-004`, `-005` y `-005-criterios`, en verde. La spec suma el criterio 10, que lo deja escrito.
  - **2**: Mover no trae ni origen ni destino elegidos. Con `--url`, ningún sobre marcado.
  - **3**: `src/components/aviso-pasajero.tsx`: el aviso quita su parámetro de la dirección al mostrarse y se va al enviar otro formulario de la página. En Movimientos, el inicio, la deuda, Sobres y Por completar. En Edge con JavaScript: `/sobres?movido=1` deja "Movido" y la dirección sin `?movido`; en `/deudas/95?borrado=deshecho`, un pago de 0 deja solo "Escribe un monto mayor que cero". Sin JavaScript queda como antes.
  - **4**: `pagoOCobroParaDeshacer` dice antes si Por asignar no alcanza: "Por asignar tiene 15,00; le faltan 5,00. Devuelve lo que falta a Por asignar con Mover y vuelve a intentarlo.", y la pantalla no ofrece "Sí, deshacer". El mensaje de la acción sigue siendo el de la spec.
  - **5**: deshacer (la lectura y la escritura) pasa a `src/db/deshacer-pago.ts` (99 líneas); `guardar-deudas.ts` queda en 312 y `editar-movimientos.ts` en 302.
  - **6**: `comprobar-007 --url`, por la acción sin JavaScript: desde Inversión, sin confirmar pide la confirmación y no guarda; con ella guarda y vuelve a Sobres; reenviar lo mismo deja una sola fila; deshacer un cobro ya repartido lo dice antes y no ofrece el botón.
  - Las comprobaciones, de nuevo: `-004`, `-005`, `-005-criterios`, `-006`, `-007 --url`, `-008`, `-009 --url`, `-010 --url` y `-006-revision --url`, todas en verde. `pnpm verify --forzar`: `Tests  954 passed (954)`, `✓ verify:full en verde en 45.2 s. Árbol sellado.`
- **`guardian-datos` (2026-10-22), sobre `ad01eeb`:** **SEGURO DE APLICAR**. Con los datos de hoy, lo recibido neto da igual que el bruto anterior; el cuadre se mantuvo en todo lo que probó, también con seis escritores a la vez (20 rondas, 0 interbloqueos). Hallazgos, ninguno bloquea:
  1. **Baja.** El piso de cero se aplicaba a la suma del mes: devolver 150 de un fijo que recibió 100 dejaba −50 por dentro, y los ingresos siguientes volvían a pedir los 150. **Arreglado:** el piso va sobre la marcha, en el orden de los movimientos (`acumulado = max(0, acumulado + delta)`). `comprobar-007`: devolver de Familia 50 más de lo recibido y mandarle después 10 cuenta 10; con el piso anterior, 0 (✗).
  2. **Info.** Sacar de Deudas con Mover hacia otro sobre cambia la cuota dentro del mes. **Decidido y escrito** en la spec, criterio 10: ese dinero deja de estar apartado.
  3. **Info.** Mover desde Deudas a la vez que un pago podía dejar Deudas en negativo: el pago no tomaba el candado de Deudas. **Arreglado:** el pago toma `(3, Deudas)` después de `(5, deuda)`, el orden de deshacer. `comprobar-007` suma seis carreras de un pago contra mover desde Deudas (0 mal); dieron verde también sin el candado, porque el orden malo no se dio sin forzarlo: el arreglo se sostiene en el orden de candados, como el de deshacer.
  4. a 7. **Info**, sin cambio: el mismo id de captura con otro origen y destino a la vez (solo con un id fabricado); reintentar un pago deshecho (como al borrar un gasto, 006); deshacer un cobro ya gastado deja la cuenta en negativo (la spec solo protege Por asignar); `recibidoDesdePorAsignarPorMes` tarda 215 ms con 300 mil filas (despreciable con el volumen real); una reasignación hacia un segundo "Por asignar" inactivo solo existe por SQL.
  - Las comprobaciones `-004`, `-005`, `-005-criterios`, `-006` y `-007 --url`, en verde; `pnpm verify --forzar`: `Tests  954 passed (954)`, `✓ verify:full en verde en 51.7 s. Árbol sellado.`
- **Revisión (2026-10-22), segunda vuelta:** `revisor`, **NO APTO**, sobre `d0c533b`. Hallazgos:
  1. **Medio-alto, dinero.** El piso sobre la marcha de `ceff7c7` volvía a abrir el hallazgo 1 al revés: sobre → Por asignar → sobre, con lo recibido en 0, contaba la vuelta entera como recibido. Gastos del mes → Por asignar 100 → Gastos del mes 100 le quitaba 100 al fijo; Deudas → Por asignar 50 → Deudas 50 bajaba la pista de "faltan 310" a "faltan 260". "Ida y vuelta neutro" y "el piso sobre la marcha" no se cumplen a la vez con un solo contador: hacía falta una decisión.
  2. **Medio, dinero.** La cuota leía lo recibido sin piso y el reparto con piso: Deudas → Por asignar 50 → Familia dejaba la cuota en 310, y Deudas → Familia 50 directo en 335, con los mismos saldos.
  3. **Bajo.** Desde Inversión, cambiar el monto tras el aviso y pulsar Enter guardaba sin volver a confirmar: la confirmación solo llevaba el origen.
  4. **Bajo.** "Pago guardado" (`/deudas/[id]?guardado=`) y "Apartado guardado" (`/deudas?guardado=apartado`) seguían en la dirección.
  5. **Info.** `comprobar-007.ts` en 698 líneas, al borde del techo.
- Arreglos y decisión (2026-10-22):
  - **1 y 2, decidido en la spec (criterio 10, reescrito):** lo recibido es el neto del mes con el piso de cero solo al final, y la cuota de Deudas lee esa misma cifra (`greatest(0, …)` en las dos consultas). Ir y volver, en cualquier orden, no cambia nada; soltar de Deudas, a Por asignar o a otro sobre, sube la cuota igual; lo soltado de más a Por asignar el fijo lo vuelve a pedir (para soltar un sobrante sin que se reponga, se mueve directo al sobre que lo necesita). Esto deja el hallazgo 1 de `guardian-datos` como comportamiento decidido, no como defecto.
  - **3:** `confirmacionDeInversion(origen, monto)` en `src/lib/mover.ts`, con su prueba (falló antes): cambiar el monto o el origen después del aviso pide confirmar otra vez.
  - **4:** `AvisoGuardado` y "Apartado guardado" usan `AvisoPasajero`. En Edge, `/deudas/207?guardado=pago`, `?borrado=deshecho` y `/deudas?guardado=apartado` muestran el aviso, limpian la dirección y no vuelven al recargar.
  - **5:** lo de las revisiones pasa a `scripts/comprobar-007-revision.ts` (466 líneas; `comprobar-007.ts` queda en 510): ida y vuelta en los dos sentidos con Deudas y Familia, soltar de Deudas a Por asignar contra soltar a otro sobre, devolver de más, lo soltado de más que se vuelve a pedir, la carrera de pago contra mover y, con `--url`, las páginas (con la confirmación atada al monto). 17 de 17 ✓. Con el código de la vuelta anterior, 3 ✗.
  - `comprobar-004`, `-005`, `-005-criterios` y `-007`, en verde. `pnpm verify --forzar`: `Tests  955 passed (955)`, `✓ verify:full en verde en 50.9 s. Árbol sellado.`
- **Revisión (2026-10-22), tercera vuelta:** `revisor`, **NO APTO**, sobre `28dcdfd`. Los arreglos 3 y 4 de la segunda vuelta cierran. Hallazgos:
  1. **Medio, dinero.** La frase del criterio 10 "soltar dinero de Deudas, a Por asignar o a otro sobre, sube la cuota" solo se cumplía con lo recibido del mes en 0. Tras el sueldo, que le da a Deudas su cuota, devolver 50 a Por asignar deshace el reparto (cuota 310, "faltan 50") y mandarlos a Familia suelta lo apartado (cuota 335, "faltan 25"), con los mismos saldos. Con un solo contador no se pueden tener a la vez ida y vuelta neutro y los dos destinos iguales; la prueba solo miraba lo recibido en 0.
  2. **Info, de la 005.** Un ingreso con fecha de un mes anterior resta lo recibido de ese mes de la cuota del mes de hoy en la fila de Deudas: con octubre cubierto, fechado el 30 de septiembre vuelve a proponer 310. **Pendiente aparte:** la fila de Deudas debería leer lo recibido del mes de hoy, como la cuota.
- **Decisión (2026-10-22), escrita en el criterio 10:** el comportamiento del código, explícito. Devolver a Por asignar deshace primero lo recibido en el mes (se vuelve a pedir este mes, la cuota no cambia); lo de más, o lo que va de Deudas a otro sobre, suelta lo apartado (sube la cuota de los meses que quedan). Que los dos caminos den cifras distintas con los mismos saldos es intencional: uno deshace el reparto y el otro suelta lo apartado. `comprobar-007-revision` suma el caso con un reparto del mes dentro: devolver 5 deja lo recibido en 15 y la cuota igual; mandar 5 a Familia sube la cuota (31.000 → 31.300); devolver 30 más de lo recibido deja la cuota como al soltar 30 a otro sobre (32.500). 21 de 21 ✓ con `--url`.
