---
name: prima-en-cuadre
description: Decisión 2026-10-11 (spec 001): la cuenta de la prima (es_propia=false) cuenta en el cuadre; riesgos de la nueva redacción "todas las cuentas activas"
metadata:
  type: project
---

Desde la spec 001 (decidido con el desarrollador el 2026-10-11) la cuenta de la prima puede ser origen de gastos y de ventas a bolívares, y su saldo entra en el cuadre. La invariante pasa de "suma de sobres = suma USD de cuentas propias" a "suma de sobres = suma USD de todas las cuentas activas". `es_propia` queda como marca legal ("A nombre de mi prima") y para reglas del plan (saldo bajo, nunca invertir), no como exclusión. El cambio de `/cuentas` es T5 y la redacción (plan, CLAUDE.md, ADR que matiza el 0002) es T10.

**Why:** en la práctica se gasta desde ella y la app no puede impedirlo. Con la redacción vieja, cualquier movimiento de la prima rompía el cuadre: medido el 2026-10-11, un gasto de 15 USD desde la prima dejó sobres=530983 frente a propias=532483.

**How to apply:**

- Hasta que T5 esté hecho, "No cuadra" en `/cuentas` tras un gasto desde la prima es lo esperado. Después de T5, ya es un defecto.
- La redacción "cuentas activas" no se cumple por construcción. Desactivar una cuenta o un sobre con saldo rompe el cuadre: Efectivo inactiva con 9500 dio todas_activas=520483 y Planes inactivo dio sobres=402483. Hay que exigir una regla (solo se desactiva con saldo cero) o sumar sin filtrar por `activa`/`activo`.
- Los comentarios de `src/db/schema.ts` sobre `esPropia` y sobre `sobres` siguen con la redacción vieja; T10 debe corregirlos.

Ver también [[defectos-datos-encontrados]].
