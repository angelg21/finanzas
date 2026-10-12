---
name: defectos-datos-encontrados
description: Defectos y huecos de datos que encontré en auditorías (con fecha), para comprobar en la siguiente revisión si siguen abiertos
metadata:
  type: project
---

Antes de dar algo por cerrado, comprobar si estos puntos siguen abiertos.

**Abiertos**

- **2026-10-11.** El check `movimientos_forma_por_tipo` solo valida la forma. Medido con BEGIN/ROLLBACK, la base aceptó un gasto con sobre "Por asignar", categoría de ingreso, moneda VES desde una cuenta USDT y desde una cuenta inactiva. La acción de servidor tiene que validar los ids contra las consultas de cuentas, sobres y categorías activas, y tomar la moneda de la cuenta leída de la base. (Así se hizo en T4; vigilarlo en cada acción nueva que escriba movimientos.)
- **2026-10-11, sigue igual en T12.** `src/db/semilla-demo.ts` usa `tasa.toFixed(4)` y `Math.round(usd * tasa)` fuera de `dinero.ts`, y tiene una variable `bs` muerta. Es anterior a 001 y viola la regla de centavos.
- **2026-10-11.** Mezcla de demo y datos de prueba. Los gastos que se guardan desde el formulario llevan `origen=manual` y `referencia_externa=null`, así que `db:demo:limpiar` no los borra. Al limpiar la demo quedan saldos negativos (el cuadre se mantiene) y quedan datos inventados sin marcar.
- **2026-10-11.** La transacción de `registrarMovimientos` (drizzle → `client.begin` de postgres-js, con `prepare: false`) es correcta por diseño. No se pudo ejecutar contra el pooler de Supabase porque no hay pooler local. Queda pendiente para `/f-audit` antes de desplegar.
- **2026-10-11, T12 de 001.** `seed.ts` inserta las 15 categorías base con `onConflictDoNothing` sobre (tipo, nombre). En cuanto T15-T18 permitan renombrar o borrar, un `pnpm db:seed` vuelve a crear la base renombrada o borrada (sin movimientos). Lo archivado no revive, porque el nombre sigue ocupado. Revisarlo en T13.
- **2026-10-11, T12.** Con `icono`/`color` `not null default`, "nunca elegido" y "eligió etiqueta+pizarra" son indistinguibles. T13 debe actualizar solo si **ambas** columnas siguen por defecto, nunca columna por columna, y aceptar ese caso residual.

**Cerrados**

- T3 de 001: `aCentavos`/`aTasa` aceptaban "0x10", "1e3" y redondeaban "1.005" en flotante. Se corrigió en b8c1a07; en T12 ya no hay `Number()` sobre el texto completo.

Ver también [[prima-en-cuadre]], [[categorias-icono-color]] y [[entorno-de-prueba]].
