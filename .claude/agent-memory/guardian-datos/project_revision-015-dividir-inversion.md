---
name: revision-015-dividir-inversion
description: Spec 015 (Inversión → largo plazo + Negocios, tipo_sobre 'negocios'): 694f56e SEGURO DE APLICAR (2026-11-26), 0011 sha 2d13cad7…; script de división medido; semilla por tipo; una baja (semilla cortada en base vacía) y cuatro info
metadata:
  type: project
---

**694f56e, auditado en main el 2026-11-26: SEGURO DE APLICAR**, antes de que el desarrollador lo corra en producción (migrar → publicar → `db:dividir-inversion:produccion`). La base local ya estaba dividida por el autor.

Medido en copias `finanzas_g015_*`, ya borradas; la real quedó con la misma huella.

- **0011** (`ALTER TYPE tipo_sobre ADD VALUE 'negocios'`): sha256 `2d13cad7…` = hash de la real; igual a lo que genera el snapshot 0010; 0 pendientes contra el 0011. El migrador real la corre dentro de `begin … commit` sin error (PG 17), también con 0010 y 0011 pendientes juntas. Para tener una copia "antes de la 0011" hay que recrear el enum (`rename` + `create type` + `alter column using tipo::text::tipo_sobre`): solo `sobres.tipo` depende de él.
- **Script**: vista previa sin TTY no escribe; aplicar solo renombra, crea Negocios con saldo 0 y parte la regla; saldos por sobre y cuenta iguales con el oráculo SQL; la segunda corrida dice "ya está dividido". Variantes medidas: fijo 10000 → 6667/3333; 1 pb → 1 y Negocios sin regla; regla inactiva intacta; renombrado conserva el nombre; un "NEGOCIOS" existente lo frena. El candado `(4,0)` es el mismo que el de `guardarReglas` (esperó 2,8 s con el candado tomado por psql); dos corridas a la vez dan una sola división.
- **Reparto**: con la división, la propuesta de los demás sobres no cambia e inversión + negocios = lo que recibía Inversión (5 montos).
- **Semilla por tipo**: dividida, migrada sin dividir, todo renombrado con una segunda meta y base vacía, sin duplicar ni pisar. La base vacía queda con 20 % y 10 %.

**Abiertos:**

- **Baja.** La semilla no es transaccional. Si la primera, en una base vacía, se corta entre los sobres y las reglas, la segunda deja Negocios sin regla y los porcentajes en 90 %: `negociosNuevo` depende de que Negocios se cree en esa misma corrida (`seed.ts:84-88`, `:141`). No aplica a producción.
- **Info.**
  - Las dos fotos de saldos van en READ COMMITTED: cualquier movimiento que se confirme entre ellas aborta la división ("Cambiarían 2 saldos"), sin escribir nada.
  - Si la división confirma entre `reglasPorSobre` (fuera del candado) y `guardarReglas`, se deshace la partición en silencio: Inversión vuelve a 30 % y Negocios queda con `activa=false`. Los porcentajes siguen sumando 100. Un formulario viejo se rechaza (falta el campo de Negocios).
  - Con regla fija, en el mes de la división Negocios pide su tercio entero aunque Inversión ya recibió el fijo (0 → 3333).
  - `estado()` sin `orderBy`: con dos sobres de inversión, elige uno al azar.

**Why:** es el primer cambio de datos de producción con un script propio (no una migración), y el primer valor nuevo de enum desde que producción tiene datos.

**How to apply:**

- Ninguna migración que **use** 'negocios' puede ir en el mismo lote que la 0011: Postgres daría 55P04 dentro de la transacción. Esto no está medido. Antes, confirmar que producción ya tiene la 0011.
- Al revisar la semilla, probar el corte a mitad con un trigger `before insert ... for each statement` que lanza.
- Las herramientas de esta auditoría están en [[entorno-de-prueba]]. Ver también [[revision-004-reparto]] y [[defectos-datos-encontrados]].
