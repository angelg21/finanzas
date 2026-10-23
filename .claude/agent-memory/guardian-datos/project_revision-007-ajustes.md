---
name: revision-007-ajustes
description: Spec 007 (deshacer pago/cobro, Mover entre sobres, recibido neto): auditada en main ad01eeb el 2026-10-22, SEGURO DE APLICAR; fusionada sin pasar por mí; el piso a cero del neto solo aplaza; Mover desde Deudas contra pagar queda en negativo
metadata:
  type: project
---

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
