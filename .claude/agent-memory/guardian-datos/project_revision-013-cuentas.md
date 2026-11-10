---
name: revision-013-cuentas
description: Spec 013 (administrar cuentas), auditada el 2026-11-10 sobre a09c1a4: 0009 apta; el HAVING de saldosPorCuenta cierra el descuadre de la observación 3, pero mete archivadas con saldo en todos los formularios (la VES archivada recibe gastos sola)
metadata:
  type: project
---

**013, auditada el 2026-11-10. El autor hizo commit a09c1a4 a mitad de la revisión; los archivos de datos eran los mismos que leí (lib solo cambió de formato).**

- **0009 apta:** dos columnas `text` nulas en cuentas. El hash coincide con `__drizzle_migrations`, prevId encadena con 0008 y el esquema da 0 sentencias contra el snapshot 0009 (2 contra 0008).
- **Observación 3 cerrada en el cuadre (medido):** se archiva en 0 y luego se borra la transferencia. Con el HAVING cuadra (574300); con solo activas (como en main) faltan 500,00. La rama `saldoUsd <> 0` también se midió: una VES archivada con Bs 0 y USD 0,10 sale en la lista.
- **Concurrencia (medida):**
  - Un insert sin confirmar hace esperar a `eliminarCuenta` (1011 ms), que luego responde `con-saldo`.
  - Si el DELETE se retrasa con un trigger, el insert concurrente da 23503 y quedan 0 huérfanos (las FK son NO ACTION).
  - Un UPDATE que no cambia la cuenta no toma KEY SHARE. Por eso `eliminarCuenta` archiva en 9 ms, y la cuenta queda archivada con 200. No pasa nada porque el HAVING la muestra.
- **Rendimiento:** con 300 mil filas, 199 ms antes y 202 ms con el HAVING. La diferencia es ruido.

**Hallazgos**

- **Media.** `saldosPorCuenta` es la lista permitida de todas las acciones de registro. Con el HAVING entran también las archivadas que tienen saldo. Medido con el `registrarGasto` real: Bolívares quedó archivada, se borró un gasto viejo suyo, y los gastos en Bs y las ventas siguientes fueron a parar a Bolívares (archivada), aunque había dos VES activas. Pasa por `cuentas.find(c => c.moneda === "VES")` en 4 sitios, y el usuario nunca elige esa cuenta. Va contra los criterios 9 y 11. Arreglo: filtrar `activa` en los caminos de registro, pero dejar el HAVING para el cuadre.
- **Baja.**
  - Al archivar la cuenta prevista de una deuda abierta, su aviso de liquidez desaparece sin decir nada (`enDolares.has` en `liquidez.ts`). `cuentaPrevistaActiva` se lee en `deudas.ts:34` pero nadie lo usa.
  - Los formularios de deudas ofrecen la archivada con saldo, y luego `exigirLado` la rechaza con un error genérico.
- **Info.**
  - Una VES casi nunca llega a 0 en las dos monedas, así que no se puede eliminar, y el mensaje "pásalo con Transferir" no aplica.
  - Si se renombra o se borra una cuenta de la semilla, `db:seed` la vuelve a crear (medido).
  - `crearCuenta` calcula el orden fuera de una transacción.

**Why:** el HAVING arregla el cuadre, pero también cambia a qué cuenta va el dinero nuevo. El cuadre sigue diciendo la verdad y la cuenta equivocada no se nota.

**How to apply:** en la segunda vuelta, comprobar que los caminos de registro filtran `activa` y repetir `vesRuta` con `accion-gasto.cts` (métodos en [[entorno-de-prueba]]). Cuando lleguen sobres archivables, exigir lo mismo en `saldosPorSobre`.

Ver también [[defectos-datos-encontrados]] y [[revision-006-editar]].
