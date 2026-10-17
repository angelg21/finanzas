---
name: captura-idempotente
description: Spec 002 criterio 19 ampliado (T12, 2026-10-13, NO APTO y luego APTO el mismo día): idCaptura UUID → captura-<uuid>-<tipo> con el índice único; huecos medidos, corrección aplicada (23505 + huella + 15 min) y residuales
metadata:
  type: project
---

Ampliación aprobada por el desarrollador: "al volver a tocar Guardar gasto se registra una sola vez" también cuando el primer intento llegó y la respuesta se perdió. Diseño de T12: `page.tsx` genera `idCaptura` por apertura, viaja oculto y en `ValoresGasto` (se conserva en errores, en la confirmación de Inversión y en las fallas de red), cada fila lleva `referenciaExterna = captura-<uuid minúsculas>-gasto|-transferencia` con `origen=manual`, y `registrarMovimientos` hacía `.onConflictDoNothing()` sin target: lista vacía = "ya estaba".

**Primera vuelta, 2026-10-13: NO APTO.** Medido con la acción real sobre copias:

- Bien: el mismo par dos veces da +2 y luego +0. Con dos procesos a la vez, un solo par (5 de 5 rondas). Los checks y las FK siguen lanzando con ON CONFLICT DO NOTHING (no los esconde). `db:demo:limpiar` no toca `captura-*`. `comprobar-001` en verde.
- **Mal 1 (alta).** Cualquier choque se toma como "ya estaba" sin comparar el contenido. El mensaje "Sin conexión: el gasto no se guardó" invita a corregir antes de reintentar. Con el mismo id: vendiendo y luego dólares 3,50 desde Efectivo dio +0 filas y una confirmación de 3,50 USD desde Efectivo, mientras la base tiene 2100 Bs. Corregir 15 a 1,50 confirma 1,50 y la base guarda 15. Cambiar a Transporte y Familia confirma Familia con saldo 0. El cuadre se mantiene y nada en pantalla lo delata.
- **Mal 2 (alta).** De dólares a vendiendo con el mismo id: ON CONFLICT inserta la transferencia, que queda confirmada. El `throw` de "Se insertaron 1 de 2" llega después del commit y la respuesta dice "No se pudo guardar". El reintento responde "guardado" con 2100 Bs, pero el gasto en Bs nunca existe y Bolívares sube 483600.
- **Mal 3 (media).** Si el reintento llega con el primero aún en vuelo, el insert espera (1520 ms) y la acción responde con los saldos leídos antes. El sobre aparece en 55564 cuando el real es 54064. Con dos procesos a la vez, a veces la respuesta mezcla sobres de antes con cuentas de después.

**Corrección pedida.** Insert plano, sin ON CONFLICT: un 23505 aborta la sentencia entera, así que nunca queda a medias (medido). Capturar `cause.code === "23505"` con `cause.constraint_name === "movimientos_origen_referencia_unico"` (drizzle 0.45 envuelve el PostgresError en `cause`). Después leer las filas guardadas por las dos referencias. Si coinciden campo a campo con las preparadas, es "ya estaba": releer los saldos (solo en ese camino raro) y confirmar con lo guardado. Si difieren, responder un error que diga que ya hay un gasto de esa captura con otros datos, y dar un id nuevo. El id NO debe cambiar al editar en el cliente: así una edición tras un primer intento que sí llegó duplicaría.

**Segunda vuelta, 2026-10-13: APTO.** Cambios:

- `registrarMovimientos` volvió a ser estricta: un duplicado lanza 23505 y no deja nada.
- `registrarCaptura` captura el 23505 de `movimientos_origen_referencia_unico` y lee las DOS referencias posibles del id.
- `resolverReintento` (lib) da "ya-estaba" solo si coinciden el número de filas y la huella por fila (sin orden, nota "" igual a null) y todo tiene ≤ 15 min. Si no, devuelve "otra": un error y un id nuevo.
- El camino "ya estaba" vuelve a leer los saldos.

Medido en copia con la acción real:

- C, D, E y F dan "otra" con +0 filas. D ya no deja la transferencia sola.
- G muestra el saldo real (54064). G2 (monto distinto en vuelo) y G3 (dólares en vuelo, reintento vendiendo) dan "otra" sin transferencia huérfana.
- Dos procesos: un par en 5 de 5 rondas, con saldos iguales y correctos en las dos respuestas.
- Ventana: 16 min da "otra", 14 min da "ya estaba". Con el id nuevo se registra un gasto nuevo, y su reintento no duplica.
- Las tasas 40, 36,25 y 1234567,8912 hacen coincidir la huella, porque numeric devuelve el texto igual a `tasaDecimal`.
- `comprobar-001` en verde, y los `db:demo` no tocan `captura-*`.

Residuales:

- Un contenido idéntico con un id reutilizado en menos de 15 minutos se toma como "ya estaba".
- ~~No hay edición ni borrado de movimientos~~: desde 006 (T3, 2026-10-17) se pueden editar y borrar. El reintento de la captura original después de editar da "otra" con +0 filas. Si el gasto se borró, el reintento lo vuelve a meter (ver [[revision-006-editar]]).
- La ventana compara el reloj de la app con el `creado_en` de la base.
- Para `/f-verify` faltan pruebas contra la base de C, D y G (`registrarCaptura` no tiene prueba en el repo).

**Why:** el defecto no rompe el cuadre ni se ve en pantalla. Solo aparece cuando el dinero real no coincide con lo que la app dijo que guardó.

**How to apply:** en la segunda vuelta, repetir los casos C (vendiendo→dólares), D (dólares→vendiendo), E (monto) y G (en vuelo) con `t12/accion.cts` y `dos-procesos.sh` del scratchpad. También revisar que `registrarMovimientos` no tenga semántica de choque genérica, porque el importador futuro la heredaría. Residual sin medir: un id reutilizado tras un éxito (Next reutiliza la página en atrás/adelante) con el mismo contenido se tragaría como "ya estaba"; se puede acotar con `creado_en` reciente.

Ver también [[defectos-datos-encontrados]] y [[entorno-de-prueba]].
