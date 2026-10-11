---
name: f-review
description: Etapa 4 del pipeline. Lanza al subagente revisor en contexto limpio contra la spec y el diff de la feature NNN y traslada su veredicto. Úsalo con los gates en verde.
argument-hint: [NNN]
---

Revisar la feature **$ARGUMENTS**.

1. Comprueba que `progress.md` tenga "Verificada" marcada. Si no, páralo: la revisión es sobre algo que ya pasó los gates.
2. Lanza al subagente `revisor` con este encargo, sin añadir contexto de la conversación (esa es la gracia):
   > Revisa la feature NNN. Spec en `docs/features/NNN-slug/spec.md`, progreso en `progress.md`, diff en `git diff main...HEAD`. Dictamina APTO PARA FUSIONAR o NO APTO según tu procedimiento.
3. Si la feature cambió `src/db/` o `drizzle/` y `guardian-datos` no la vio en `/f-build`, lánzalo también con el diff.
4. Cuando vuelvan los informes, trasládalos al usuario íntegros en lo esencial: veredicto, hallazgos numerados, qué se verificó. No suavices nada.
5. Si el veredicto es **NO APTO**: anota los hallazgos en "Notas" de `progress.md`, corrige la causa de cada uno, vuelve a correr `pnpm verify` y repite la revisión. Si el revisor se equivocó en un hallazgo, explícalo con evidencia ejecutada, no con argumentos.
6. Si es **APTO**: marca "Revisada" en `progress.md` con la fecha y haz commit `docs(NNN): revisión apta`.

Recuerda el `/clear` antes de `/f-ship $ARGUMENTS`.
