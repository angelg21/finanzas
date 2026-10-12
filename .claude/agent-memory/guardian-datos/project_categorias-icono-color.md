---
name: categorias-icono-color
description: Decisión spec 001 ampliada (2026-10-11): icono y color de categorías por nombre, sin check ni enum en la base; condiciones que dejé para T13 a T16 y el importador, y en qué quedaron
metadata:
  type: project
---

`categorias.icono` y `categorias.color` son `text not null`, con valores por defecto 'etiqueta' y 'pizarra' (migración 0002, T12). La base no tiene check ni enum, a propósito: añadir un icono no debe pedir una migración. La validación está en `validarCategoria` de `src/lib/categorias.ts`. En T12 di por buena esa decisión: no encontré ningún riesgo de dinero, porque las categorías no tocan saldos.

**Why:** se comprobó con BEGIN/ROLLBACK que la base acepta `''` y `'#ff0000'` como icono y color. Un nombre desconocido no pierde datos, pero puede romper el render si el registro de iconos no tiene una alternativa, y eso tumbaría `/nuevo/gasto`, la pantalla más importante.

**How to apply:**

- T13 (APTO el 2026-10-11, confirmado en /f-review el 2026-10-12 con una base existente y otra migrada desde cero) y T14 (el registro y `CirculoCategoria` caen en el valor por defecto, con prueba) cumplen mis condiciones.
- T15: APTO el 2026-10-11, tras una ronda de cambios. La capa db bloquea y cuenta (`bloquearYContar`), y la acción de restaurar usa `repetidaDe`. Si alguien quita ese `for update`, vuelve la carrera que lanza 23503 y la del cambio de tipo.
- La unicidad de nombre en la base es exacta, no por `clave()`. Las equivalencias solo las detiene `lib`.
- Importador: todo valor que no pase por `validarCategoria` necesita una prueba contra el catálogo (un hexadecimal de Gestor de Gastos es el caso típico). Debe emparejar categorías por `clave()`, no crear subcategorías: `padre_id` bloquea el borrado con 23503 y `destinoAlEliminar` no cuenta las hijas.
- Los valores por defecto de `schema.ts` importan las constantes de `lib` desde T12 (import relativo).
- La FK `movimientos.categoria_id` es NO ACTION: la base rechaza borrar una categoría con movimientos (medido). Eso respalda el criterio 21. Si una migración añade `on delete cascade` o `set null` aquí, es NO APLICAR.

Ver también [[defectos-datos-encontrados]].
