# 0008 · El icono y el color de una categoría se guardan por nombre

Fecha: 2026-10-11. Estado: aceptada.

## Contexto

El desarrollador pidió categorías con icono y color, como en Gestor de Gastos (ampliación de la spec 001). Hay que decidir qué se guarda en la base para el icono y para el color. La app tiene dos temas, una paleta propia en tokens (regla dura: nada de colores sueltos) y un juego de iconos de línea, nunca emojis. La captura de gasto es la pantalla que más importa que sea rápida.

## Decisión

`categorias.icono` y `categorias.color` son `text` con el **nombre** del catálogo de `src/lib/categorias.ts`: `huella`, `lavanda`. Nunca un hexadecimal ni el nombre de un componente.

- El icono de cada nombre está en `src/components/iconos-categoria.tsx`, con 128 iconos de `lucide-react` importados uno a uno.
- El tono de cada color está en los tokens `--cat-*` de `globals.css`, en claro y en oscuro, cada uno con 3:1 o más de contraste para el icono blanco.
- La aplicación valida contra el catálogo y la base no lleva enum ni `check`.

## Consecuencias

- El color sigue al tema, y la paleta o un icono pueden cambiar de dibujo sin tocar datos.
- Añadir un icono es una línea en el catálogo y otra en el registro, sin migración.
- Un nombre desconocido (un dato viejo, un import) cae en `etiqueta` y `pizarra` en vez de romper la pantalla. Lo prueban `src/components/iconos-categoria.test.ts` y `src/components/paleta-categorias.test.ts`.
- El importador de Gestor de Gastos tendrá que traducir sus colores y símbolos al catálogo, nunca copiar un hexadecimal.
- La base acepta cualquier texto en esas columnas: la única barrera es la validación de la aplicación y la caída al valor por defecto.

## Alternativas descartadas

- Hexadecimal en la base: rompe la regla de tokens y no se adapta al tema oscuro.
- Enum o `check` en la base: obliga a migrar cada vez que se añade un icono, y no protege el caso real, que es quitar o renombrar uno en el código.
- Todo el juego de lucide (más de mil iconos) en un selector: pesaría cientos de KB en la captura de gasto.
- Emojis: el desarrollador los descartó de forma expresa.
