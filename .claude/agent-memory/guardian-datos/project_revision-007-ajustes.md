---
name: revision-007-ajustes
description: Spec 007 (deshacer, Mover, recibido): ad01eeb SEGURO (2026-10-22); criterio 11 (retiro con vista previa y firma, 4460c75) APTO el 2026-10-23 con H1 media (el retiro se come el reparto de otro ingreso y el mensaje culpa a Mover); el neto con piso ya no existe, ahora "Mover no cuenta"
metadata:
  type: project
---

**Criterio 11, 4460c75 (2026-10-23): APTO para datos.** Retirar lo repartido al deshacer un cobro o borrar un ingreso (`src/lib/retiro.ts`, `src/db/retiro.ts`, `deshacer-pago.ts`, `borrar-ingreso.ts`). Sin migración. Medido en `finanzas_gret_a` (ya borrada) con `fff6d62f…/scratchpad/gretiro/sonda-retiro.mts <basico|otroingreso|otroingresonov|carreras|forzado|tormenta|filas|firma|volumen>` y `propiedades.mts`:

- Bien: cuadre en todo; PA nunca < 0; ninguna fila ≤ 0 (200 mil casos de `planDeRetiro`); orden de candados (5,d) → fila → (3,PA) → filas FOR UPDATE sin ciclos, tormenta 0 interbloqueos; repartir y borrar esperan ~460 ms detrás de deshacer y al revés da `cambio`; cuota igual al retirar un apartado; 20 mil posteriores, deshacer 138 ms.
- **H1 media:** newest-first se lleva el reparto propio de OTRO ingreso B. Luego borrar B queda impedido con "salió con Mover o con un préstamo" sin que haya ninguno, y el remedio (Mover) deja el fijo contado: propuesta de noviembre sin Familia 100, Familia en 0. Igual con borrar un ingreso viejo en vez de deshacer.
- **H2 baja:** la firma es `id:centavos`, no cubre los saldos de "Así queda", y el retiro no toma (3, sobre) de los sobres de los que retira. Mover o apartar desde Gastos o Deudas, un pago o un gasto en medio: el sobre queda en −100 (10 de 10) con la vista previa diciendo 0, sin "Algo cambió".
- Info (solo SQL o futuro): no filtra `sobres.activo` (descuadra 2000 con un archivado); un ingreso fuera de PA retira apartados de ese sobre; monto ≠ USD da 23514; PA negativo previo retira de más; filas de meses pasados y demo-* entran.

**How to apply:** en la próxima vuelta de la 007 o de 006, comprobar si se decidió H1 (política de qué retirar, o el mensaje con la causa real) y H2 (saldos en la firma o (3, sobre) tras (3, PA) en orden de id). Cuando llegue archivar sobres o el importador, exigir el filtro `activo` y que el retiro solo use PA.

**Contexto:** desde el 2026-10-22 lo recibido ya no es neto con piso: cuenta solo las reasignaciones desde PA sin la marca `-mover-` (criterio 10 redecidido). Lo de abajo sobre el piso es historia.

**Auditoría de la 007 sobre `main` ad01eeb (2026-10-22): SEGURO DE APLICAR.** Se fusionó el 2026-10-17 antes de verify y review, por pedido del desarrollador. Sin migración: ni 611ba73 ni fd89e34 tocan `schema.ts` ni `drizzle/`. Lo de `src/db`: `mover.ts`, `deshacer-pago.ts` (lo movió fd89e34 desde `guardar-deudas.ts` y `editar-movimientos.ts`), y lo recibido **neto** en `recibidoDesdePorAsignarPorMes` (con piso 0 al leer) y `sobreDeudas().recibidoEnElMesCentavos` (sin piso). Las etiquetas con # de la T3 ya no existen: las reemplazó la 008.

Medido en copias `finanzas_g007_a` y `_vol`, ya borradas:

- Con los datos existentes, neto = bruto, porque la demo no tiene ninguna reasignación hacia PA. Las 5 claves de mes son iguales, y Deudas da 0 = 0.
- Ida y vuelta, entre dos sobres que no son PA, y los meses pasados: bien.
- **Mover contra deshacer un cobro**, con orden forzado: B espera ~460 ms y ve el saldo nuevo, 10 de 10.
- **Tormenta de seis escritores** (deshacer cobro, cobrar, mover desde PA, repartir, apartar y prestar): 20 rondas, 0 interbloqueos, PA nunca en negativo, y el cuadre se mantiene.
- Comprobaciones: `comprobar-004` (21 ✓), `-005` (39 ✓), `-005-criterios` (15 ✓) y `-007 --url` (42 ✓). `verify:fast --forzar` da 954 de 954.

**Hallazgos (ninguno bloquea):**

- **Baja, diverge del criterio 10.** El piso de 0 se aplica a la suma del mes al leerla, así que el déficit se arrastra. Medido: Familia (fijo 100) devuelve 150 (100 de octubre y 50 de un sobrante de septiembre). Los dos ingresos siguientes le proponen 100 y 50. Arreglo: piso corrido en orden `(fecha, id)`, o escribir en la spec que lo devuelto de meses pasados se vuelve a pedir.
- **Info.** Mover desde Deudas a un sobre que no es PA sube la cuota dentro del mes (310 → 325). Desde Deudas a PA, la cuota no cambia y el ingreso siguiente pide lo que falta (310 y luego 30). Antes de la 007, nada sacaba dinero de Deudas salvo pagar.
- **Info.** Mover desde Deudas a la vez que un pago deja Deudas en −30, 10 de 10 en los dos órdenes, porque `saldar` no toma `(3, Deudas)`. Es la clase de gasto/apartar.
- **Info.**
  - El mismo id con otro origen y otro destino a la vez guarda 2 filas, 10 de 10.
  - Pagar, deshacer y reintentar la misma captura vuelve a meter el pago.
  - Deshacer un cobro ya gastado deja la cuenta en −20.
  - Con 300 mil filas, lo recibido tarda 215 ms, contra 67 ms del bruto (sort con external merge).

**Why:** desde la 007, lo recibido decide qué propone el reparto y la cuota de Deudas con dinero que va y vuelve. Un error ahí no se ve en el cuadre, solo en la propuesta.

**How to apply:**

- En la próxima revisión de reparto o de deudas, comprobar si se decidió el piso corrido.
- Si `pagarDeuda` empieza a tomar `(3, Deudas)`, debe ser después de `(5, d)`, como en deshacer.
- Con el importador: una reasignación hacia PA fechada en el pasado cambia lo recibido de ese mes.
- Herramientas en `fff6d62f…/scratchpad/g007/`: `sonda-007.mts <equiv|neto|deudas|inactivos|carreras|tormenta|reintentos|bordes|todo>`, que solo corre en `finanzas_g007_*`, más `volumen.sql` y `tiempos.mts`.

Ver también [[revision-004-reparto]], [[revision-005-deudas]], [[defectos-datos-encontrados]] y [[entorno-de-prueba]].
