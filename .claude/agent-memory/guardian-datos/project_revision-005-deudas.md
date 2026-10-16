---
name: revision-005-deudas
description: Spec 005 (deudas y préstamos): T5, migración 0005 APTA antes de aplicarse (2026-10-15), sha y mediciones; qué vigilar en T6, T7 y T13 (sentido de la deuda, sobre Deudas, mapas de tipo_sobre, enum en lib)
metadata:
  type: project
---

**T5, migración `0005_polite_sir_ram.sql`: APTA (2026-10-15), revisada sin commit y antes de aplicarse en ninguna base.** sha256 `99dc3f2350f8f3e5…`. Si al aplicarla el hash en `__drizzle_migrations` es otro, alguien la editó después de la revisión.

Medido:

- Las 14 sentencias son idénticas a `generateMigration(0004_snapshot, schema)`, y quedan 0 pendientes contra `0005_snapshot`. `schema.ts` se tocó 2 minutos después de generar, pero solo en comentarios.
- En una base vacía, las 6 migraciones corren en una transacción (un `begin` y un `commit` en el log) y quedan 539300 = 539300 tras semilla y demo.
- En una copia con datos reales y la 0004 revertida (como producción), la 0004 y la 0005 corren juntas en una transacción. Todos los checks quedan `convalidated`.
- Con un pago (200), un préstamo (140) y un cobro (50), sale 510300 = 510300. Las 6 formas malas dan 23514, la deuda inexistente 23503 y el borrado de una deuda con movimientos 23503.
- Control: el mismo check sin `::text`, tras un ADD VALUE en la transacción, da 55P04. Con `::text`, pasa.
- No se probó en la imagen de Supabase: el clasificador negó `docker run` (ver [[entorno-de-prueba]]). La T14 de 002 ya había corrido el ADD VALUE de la 0001 dentro de la transacción con los event triggers de Supabase.

**Why:** en producción, la 0004 y la 0005 se aplican juntas en una sola transacción. Usar un valor de enum recién añadido tumba el despliegue entero.

**How to apply (lo que queda abierto para T6, T7 y T13):**

- La base no ata el `sentido`. Un `pago_deuda` puede apuntar a una deuda "me_deben", y un `prestamo` o `cobro_prestamo` a una "debo". Tampoco exige que el sobre sea Deudas o "Por asignar", ni cuentas en dólares. El escritor de T7/T13 tiene que validarlo dentro del candado `(5, deudaId)`. Revisarlo ahí.
- Los mapas de `tipo_sobre` son `Record<string, …>` con un respaldo: `nombreTipoSobre` en el inicio, `descripcion` en `/sobres`, `nombreTipo` en `/sobres/[id]` e `iconoPorTipo` en `icono-sobre.tsx`. Cuando la semilla de T6 cree Deudas, saldrá "deudas" en crudo y el icono Target. tsc no lo detecta: el ADR 0012 dice "no compila", pero eso solo vale para los mapas de `tipo_movimiento`.
- El enum `tipo_movimiento` sale ahora de `tiposDeMovimiento` en `src/lib/saldos.ts`. Reordenarlo o renombrarlo ahí cambia la base. Un RENAME VALUE rompería en silencio el check por texto, porque caería en `else false`.
- Las sumas de SQL (`saldosPorSobre`, `saldosPorCuenta`, `saldoDeSobre`) todavía no cuentan los tres tipos; están planeadas para T6. Entre T5 y T6 nada escribe esos tipos.

Ver también [[defectos-datos-encontrados]] y [[rls-supabase]].
