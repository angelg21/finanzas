---
name: revision-004-reparto
description: Feature 004 (ingresos y reparto): T4 SEGURO DE APLICAR y T5 APTO CON CAMBIOS el 2026-10-14 (candado del reparto medido; reintento sinSaldo y reparto disjunto; editables confiados); qué vigilar en T8 y T9; producción ya tiene datos
metadata:
  type: project
---

**T4 de 004, SEGURO DE APLICAR el 2026-10-14**, sin commit al revisar. Revisé `schema.ts` (22:14:30), `drizzle/0004_fluffy_the_hood.sql` y `src/db/reparto.ts` (22:15:40). Desde el 2026-10-14, producción existe: migrada 4 de 4 y sembrada (ver la progress de 002, T15). Toda migración nueva cae sobre datos reales.

**Migración 0004:** un solo `ALTER TABLE ... ADD CONSTRAINT ... CHECK`, byte a byte lo que genera drizzle-kit. El snapshot 0004 deja 0 sentencias pendientes y la cadena de prevId está bien. Medido en copias:

- **Con una regla de 10001:** tanto `drizzle-kit migrate` como el ensayo de `migrar-produccion` fallan con "Causa: 23514 · ... violated by some row" y salen con 1. La base queda en 4 migraciones y sin el check: atómica.
- **Sana:** 5 de 5 y las 10 comprobaciones ✓.
- **Bordes del check:** 10000 pasa y 10001 falla. Un fijo de 2147483647 pasa.
- **Cambio de tipo:** pasar de fijo 45000 a porcentaje cambiando solo `tipo` FALLA. Hay que cambiar `tipo` y `valor` en la misma sentencia; el borrador de `guardarReglas` en `src/db/reglas.ts` lo hace así.
- **Suma de porcentajes:** tres porcentajes de 10000 pasan: la suma la cuida la app, no la base.
- **Demo:** limpiar + demo dan 539300 = 539300, huella del autor 6819eb1d e idempotente.
- **Base vacía:** de 0000 a 0004 y dos `db:seed`, con 6 reglas.

**Consultas de `reparto.ts`**, todas parametrizadas y con montos como `number`:

- `recibidoDesdePorAsignarPorMes` cuenta lo **bruto**: reasignaciones con origen de tipo `por_asignar`, de cualquier sobre de ese tipo y esté activo o no. El mes sale de la columna `date`: medido igual en UTC, +14, −11 y Caracas, y con el borde 31 oct / 1 nov bien separado.
- **Devolución:** si un sobre devuelve dinero a "Por asignar", sigue contando como recibido. Medido: 45000 ida y vuelta, y el siguiente cobro le propone 0 a Gastos.
- Con 300 000 filas tarda 33 ms y da 1593 entradas.
- `sobrePorAsignar` no filtra `activo`. Si el de menor orden está inactivo y hay otro activo, elige el inactivo: la página bloquea (es lo que pide la spec) y su saldo sale 0 aunque tenga dinero, porque `saldosPorSobre` filtra `activo`.

**Why:** el fijo "una vez al mes" depende de esta suma. Un error aquí no se ve en pantalla: solo cambia lo que la propuesta pide.

**How to apply:**

- **T5:** que `repartirPorAsignar` tome `porAsignarId` de `sobrePorAsignar()` en el servidor y nunca del formulario. Que vuelva a leer el saldo dentro de la transacción con el candado; el borrador de las 22:17 ya lo hace. Que `guardarReglas` mantenga `tipo` y `valor` en una sola sentencia.
- **Feature "Mover" (sobre → Por asignar):** decidir si lo recibido es bruto o neto.
- **Importador:** un ingreso directo a un sobre que no sea "Por asignar" no cuenta como fijo cubierto.

**T5 de 004, APTO CON CAMBIOS el 2026-10-14** (sin commit; archivos de las 22:17). Medido en la copia `finanzas_t5r`:

- **Bien.** El candado (3, PA) es lo que sostiene la garantía. Con 5 a la vez, guardan 2 de 5 en 10 de 10 rondas. Sin candado (mutante), PA queda en −10000. Con dos procesos, 5 de 5 rondas bien. Un ingreso sin confirmar no frena el reparto.
- **Bien en `guardarReglas`.** Todo o nada medido con 23514, 23503 y valor 0, y el tope también se deshace. Dos a la vez dieron 20 de 20 rondas con un estado entero, sin mezcla.
- **Bien en el gasto.** El arnés de T12 da lo mismo que en la segunda vuelta, y la relectura con LIKE coincide en 15 de 15 capturas.
- **Mal 1.** Un reintento tras un reparto que dejó PA por debajo del total responde `sinSaldo` en vez de "ya estaba". Medido con todo repartido (saldo 0) y con el primer intento en vuelo.
- **Mal 2.** Un reintento con el mismo id hacia otros sobres inserta un segundo reparto: +1 fila y tres filas con el mismo id.
- **Corrección medida como mutante.** Leer `guardadasDeCaptura(id, tx)` tras el candado y antes del saldo. Arregla los dos casos y mantiene el 2 de 5.
- **La acción de T8 (borrador) los tapa.** Corta antes con `saldo <= 0` y con `validarAsignaciones(saldo)`.
- **`guardarReglas` confía en `editables` y `tope.sobreId`.** Un fondo dentro de `editables` queda desactivado, y `fijarReglaFija` NO lo reactiva, porque no toca `activa`.

**How to apply (T8/T9):** volver a medir Mal 1 y Mal 2 en la acción de `/sobres/repartir`. Comprobar que T9 calcule `editables` (sin fondos ni Por asignar) y el id de Emergencia en el servidor.

Ver también [[defectos-datos-encontrados]] y [[entorno-de-prueba]].
