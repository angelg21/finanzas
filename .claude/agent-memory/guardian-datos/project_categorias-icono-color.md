---
name: categorias-icono-color
description: Decisión spec 001 ampliada (2026-10-11): icono y color de categorías por nombre, sin check ni enum en la base; condiciones que dejé para T13, T14 y el importador
metadata:
  type: project
---

`categorias.icono` y `categorias.color` son `text not null`, con valores por defecto 'etiqueta' y 'pizarra' (migración 0002, T12). La base no tiene check ni enum, a propósito: añadir un icono no debe pedir una migración. La validación está en `validarCategoria` de `src/lib/categorias.ts`. En T12 di por buena esa decisión: no encontré ningún riesgo de dinero, porque las categorías no tocan saldos.

**Why:** se comprobó con BEGIN/ROLLBACK que la base acepta `''` y `'#ff0000'` como icono y color. Un nombre desconocido no pierde datos, pero puede romper el render si el registro de iconos no tiene una alternativa, y eso tumbaría `/nuevo/gasto`, la pantalla más importante.

**How to apply:**

- T14: el registro de iconos y `CirculoCategoria` deben volver a `iconoPorDefecto`/`colorPorDefecto` cuando reciben un nombre que no está en el catálogo.
- T13 y el importador: todo valor que no pase por `validarCategoria` necesita una prueba que lo compare con el catálogo. Un hexadecimal copiado de Gestor de Gastos es el caso típico.
- Los valores por defecto de `schema.ts` están escritos a mano y no importan las constantes de `lib`. Si alguien cambia `iconoPorDefecto`, la base no se entera.
- La FK `movimientos.categoria_id` es NO ACTION: la base rechaza borrar una categoría con movimientos (medido). Eso respalda el criterio 21. Si una migración añade `on delete cascade` o `set null` aquí, es NO APLICAR.

Ver también [[defectos-datos-encontrados]].
