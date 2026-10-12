---
name: prima-en-cuadre
description: Decisión 2026-10-11 (spec 001, ADR 0006): la cuenta de la prima (es_propia=false) cuenta en el cuadre; desactivar con saldo descuadra y la regla "solo con saldo cero" aún no tiene pantalla
metadata:
  type: project
---

Desde la spec 001 (ADR 0006, decidido con el desarrollador el 2026-10-11), la cuenta de la prima puede ser origen de gastos y su saldo entra en el cuadre: la suma de los sobres activos debe igualar la suma USD de todas las cuentas activas. `es_propia` queda como marca legal. T5 (`/cuentas` suma la prima) y T10 (documentos y comentarios de `schema.ts`) están hechos.

**Why:** en la práctica se gasta desde ella. Con la redacción vieja, un gasto de 15 USD desde la prima dejó sobres=530983 frente a propias=532483 (medido el 2026-10-11).

**How to apply:**

- Un "No cuadra" en `/cuentas` tras un gasto desde la prima ya es un defecto.
- Las consultas filtran `activa`/`activo`. Si una cuenta o un sobre se desactiva con saldo, el cuadre se rompe: Efectivo inactiva con 9500 dio 520483, y Planes inactivo dio sobres=402483. El ADR 0006 decidió que solo se archiva con saldo cero, y lo hará cumplir la pantalla de administrar cuentas (observación 3). Esa pantalla no existía el 2026-10-11. Cuando llegue, hay que exigir que la regla esté en la acción y no solo en la interfaz.
- Cifra de referencia de la demo completa (118 filas): sobres activos = cuentas activas = 539300 (2026-10-11).

Ver también [[defectos-datos-encontrados]].
