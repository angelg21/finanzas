---
name: f-build
description: Etapa 2 del pipeline. Construye la feature NNN tarea por tarea según su progress.md, con un commit por tarea, y termina cuando el usuario valida las pantallas en el navegador. Úsalo solo con una spec aprobada.
argument-hint: [NNN]
---

Construir la feature **$ARGUMENTS**.

## Antes de tocar código

1. Lee `CLAUDE.md`, `docs/features/$ARGUMENTS-*/spec.md` y `progress.md`. Si la spec está en estado borrador o el usuario no la ha leído, páralo.
2. Confirma la rama: `git branch --show-current` debe ser `feat/$ARGUMENTS-...`. Si no, cámbiate o páralo.
3. Lee `docs/diseno.md` y los componentes de `src/components/` que vas a reutilizar. Nada de piezas nuevas que no estén en la spec.

## Por cada tarea de progress.md, en orden

1. Si la tarea es "invisible en pantalla" (dinero, reparto, invariante, importador): escribe primero la prueba en `src/lib/*.test.ts`, córrela y **mírala fallar**, y solo entonces la función. Si la tarea toca `src/db/` o `drizzle/`, lanza al subagente `guardian-datos` con el diff antes de aplicar la migración y atiende su veredicto.
2. Implementa lo mínimo que cierra la tarea. Nombres en español, centavos enteros, tokens y piezas existentes.
3. `pnpm verify:fast` en verde. Si falla, arregla la causa: nunca la prueba.
4. Marca la tarea en `progress.md` con la fecha y haz un commit: `feat(NNN): T3 · lo que hace` en español, con el cuerpo explicando el porqué si no es obvio.
5. Si descubres algo que la spec no previó, no lo resuelvas en silencio: anótalo en "Notas" de `progress.md` y, si cambia el alcance, pregunta.

## Al terminar las tareas

1. Levanta `pnpm dev` si no está corriendo y genera `pnpm capturas` con las rutas de la feature. Mira las capturas tú mismo con la herramienta de lectura de imágenes y compáralas con `docs/referencias/` y con la sección "Pantallas" de la spec. Corrige lo que no coincida.
2. Pide al usuario que valide las pantallas en su navegador, en móvil y en escritorio, y que anote la fecha en "Validación en navegador" de `progress.md`. **Sin esa anotación no se pasa a `/f-verify`.**
3. Marca "Construida" y "Validada" en progress.md cuando corresponda y haz commit.

Recuerda el `/clear` antes de `/f-verify $ARGUMENTS`.
