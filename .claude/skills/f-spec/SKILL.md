---
name: f-spec
description: Etapa 1 del pipeline. Convierte una idea en una spec con criterios de aceptación, pantallas y datos, más el plan de tareas y la rama. Úsalo cuando el usuario quiera una funcionalidad nueva o cuando pidan "implementa X" sin spec.
argument-hint: [idea]
---

Especificar: **$ARGUMENTS**

## Antes de escribir

1. Lee `CLAUDE.md`, la sección del plan (`docs/plan-financiero-y-app.md`) que cubre la idea y `docs/diseno.md`. Si la idea toca datos, lee también `src/db/schema.ts`.
2. Comprueba que no exista ya una feature abierta: `/f-status`. Una sesión, una feature: si hay una abierta sin fusionar, páralo y dilo.
3. **Trazabilidad.** Si la idea no está en el plan ni en `docs/observaciones.md`, detente: propón primero el cambio al plan en dos frases y espera a que el usuario lo apruebe. Sin trazabilidad no hay spec.

## Qué produces

1. Número `NNN` correlativo (mira `docs/features/`) y slug corto en español.
2. `docs/features/NNN-slug/spec.md` a partir de `docs/features/_plantillas/spec.md`. Reglas:
   - Criterios de aceptación en forma "dado, cuando, entonces". Marca ★ lo que toque dinero, el invariante, datos del usuario o lo que sería imperdonable en producción. Cada ★ tendrá una prueba.
   - Pantallas descritas para móvil y escritorio con las piezas de `docs/diseno.md` por nombre. Si hace falta una pieza nueva, descríbela aquí.
   - Datos: tablas, columnas, migración, cambios en semillas y demo, destino de los datos existentes.
   - "Pruebas antes del código": solo lo invisible en pantalla (dinero, reparto, invariante, importador), como funciones puras en `src/lib/`.
   - Fuera de alcance explícito.
3. `docs/features/NNN-slug/progress.md` a partir de la plantilla, con tareas `T1..Tn` de 30 a 60 minutos cada una, en orden de dependencia, cada una con un resultado comprobable. Para datos: primero esquema y migración, luego semillas, luego consultas, luego pantallas. La última tarea es siempre "actualizar plan, diseño y observaciones si cambiaron".
4. Rama: `git switch -c feat/NNN-slug` desde `main` con el árbol limpio. Un commit `docs: spec de NNN-slug`.

## Cierre

Resume la spec en cinco líneas y pide al usuario que la lea y corrija. No construyas nada en esta etapa. Recuerda el `/clear` antes de `/f-build NNN`.
