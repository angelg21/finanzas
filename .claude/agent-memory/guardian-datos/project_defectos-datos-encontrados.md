---
name: defectos-datos-encontrados
description: Defectos y huecos de datos que encontré en auditorías (con fecha), para comprobar en la siguiente revisión si siguen abiertos
metadata:
  type: project
---

Antes de dar algo por cerrado, comprobar si estos puntos siguen abiertos.

- **2026-10-11, T3 de 001.** `aCentavos`/`aTasa` en `src/lib/dinero.ts` usan `Number()`, así que aceptan "0x10" (1600), "0b11" (300) y "1e3" (100000). Eso contradice el criterio 5 de la spec 001 ("es texto" → error). Además, "1.005" da 100 por redondeo flotante.
- **2026-10-11.** El check `movimientos_forma_por_tipo` solo valida la forma. Medido con BEGIN/ROLLBACK, la base aceptó un gasto con sobre "Por asignar", categoría de ingreso, moneda VES desde una cuenta USDT y desde una cuenta inactiva. La acción de servidor tiene que validar los ids contra las consultas de cuentas, sobres y categorías activas, y tomar la moneda de la cuenta leída de la base.
- **2026-10-11.** `src/db/semilla-demo.ts` usa `tasa.toFixed(4)` y `Math.round(usd * tasa)` fuera de `dinero.ts`, y tiene una variable `bs` muerta. Es anterior a 001 y viola la regla de centavos.
- **2026-10-11.** Mezcla de demo y datos de prueba. Los gastos que se guardan desde el formulario llevan `origen=manual` y `referencia_externa=null`, así que `db:demo:limpiar` no los borra. Al limpiar la demo quedan saldos negativos (el cuadre se mantiene) y quedan datos inventados sin marcar. Ese día la base local tenía 118 filas, todas `demo-*`.
- **2026-10-11.** La transacción de `registrarMovimientos` (drizzle → `client.begin` de postgres-js, con `prepare: false`) es correcta por diseño. No se pudo ejecutar contra el pooler de Supabase porque no hay pooler local. Queda pendiente para `/f-audit` antes de desplegar.

Ver también [[prima-en-cuadre]] y [[entorno-de-prueba]].
