---
name: prima-en-cuadre
description: Decisión 2026-10-11 (spec 001, ADR 0006): la cuenta de la prima (es_propia=false) cuenta en el cuadre; desactivar con saldo descuadra; cifra de la demo 524300 desde 7be2f91 (539300 antes)
metadata:
  type: project
---

Desde la spec 001 (ADR 0006, decidido con el desarrollador el 2026-10-11), la cuenta de la prima puede ser origen de gastos y su saldo entra en el cuadre: la suma de los sobres activos debe igualar la suma USD de todas las cuentas activas. `es_propia` queda como marca legal. T5 (`/cuentas` suma la prima) y T10 (documentos y comentarios de `schema.ts`) están hechos.

**Why:** en la práctica se gasta desde ella. Con la redacción vieja, un gasto de 15 USD desde la prima dejó sobres=530983 frente a propias=532483 (medido el 2026-10-11).

**How to apply:**

- Un "No cuadra" en `/cuentas` tras un gasto desde la prima ya es un defecto.
- Las consultas filtran `activa`/`activo`. Si una cuenta o un sobre se desactiva con saldo, el cuadre se rompe: Efectivo inactiva con 9500 dio 520483, y Planes inactivo dio sobres=402483. El ADR 0006 decidió que solo se archiva con saldo cero, y lo hará cumplir la pantalla de administrar cuentas (observación 3). Esa pantalla no existía el 2026-10-11. Cuando llegue, hay que exigir que la regla esté en la acción y no solo en la interfaz.
- Cifra de referencia de la demo completa (118 filas): sobres activos = cuentas activas = 539300 (2026-10-11, igual en /f-review el 2026-10-12, también en una base migrada desde cero). La demo no mueve la prima, así que esa cifra no distingue la regla vieja de la nueva. Para eso, un gasto de 1500 desde la prima dentro de BEGIN/ROLLBACK: sobres = todas = 537800, propias = 539300.
- **Desde 7be2f91 (demo de deudas, 2026-10-16), sobres = cuentas = 524300.** El 2026-10-22, `db:demo` dice "121 movimientos" y 4 deudas, con la huella sin ids 0dcb6db0/34cc5c52. El "122" de antes era un conteo errado. Sale de 539300 − 8000 (préstamo) − 10000 (pago) + 3000 (cobro). La misma cifra y la misma huella sin ids en la base real y en una vacía migrada desde cero. El 539300 solo vale para las 118 filas de antes.
- Nota de la semilla (`seed.ts`, cuenta prima): dice "Solo tránsito, saldo bajo", texto anterior al ADR 0006. Solo se escribe al crear la cuenta.
- **Actualización 2026-10-14 (T14 de 002).** Se quitó el respaldo `enDolares[0]`. Sin una cuenta propia en dólares, no se marca ninguna (`page.tsx`, líneas 34 a 38). Ese punto quedó cerrado. En T14, los gastos desde la prima en una base vacía también cuadran: −7089 = −7089.
- **Preselección (2026-10-12, revisión de 64af718).** `cuentaPorDefectoParaGasto` y `cuentaPorDefectoParaVenta` filtran `enDolaresPropia` y nunca devuelven la prima. Lo medí con la prima en orden 0, con la prima llamada "Binance" y con Binance renombrada o inactiva. Pero `page.tsx` cae en `enDolares[0]` si las dos devuelven null, y `enDolares` incluye la prima. Sin cuentas propias en dólares activas, la prima queda preseleccionada para gasto y venta (medido: inicial 4/4). Hoy no se llega a ese estado porque no hay pantalla para archivar cuentas. Cuando llegue la pantalla de administrar cuentas (observación 3), exigir que ese respaldo se quite.
- Cuando "Registrar otro" conserva la prima por `?cuenta=` o `?venta=`, no es una preselección: la spec pide "misma cuenta" y fue una elección explícita del usuario.
- Vender desde la prima está permitido (la spec dice "cualquier cuenta en dólares"). Medido: tras una venta de 15 USD desde la prima y un gasto de 15 desde ella, sobres = todas = 533782 y propias = 536782.

Ver también [[defectos-datos-encontrados]].
