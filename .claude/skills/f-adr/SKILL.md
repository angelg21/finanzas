---
name: f-adr
description: Registra una decisión de arquitectura en docs/adr/ con contexto, decisión, consecuencias y alternativas descartadas. Úsalo cuando se tome una decisión que cueste deshacer, o cuando se acepte un riesgo de auditoría.
argument-hint: [decisión en una frase]
---

Registrar la decisión: **$ARGUMENTS**.

1. Lee `docs/adr/README.md` y los ADR existentes para no contradecir ninguno sin decirlo. Si esta decisión reemplaza a otra, la nueva lo dice y la vieja recibe al final una línea "Reemplazada por NNNN" (único cambio permitido a un ADR aceptado).
2. Número correlativo de cuatro cifras y slug en español: `docs/adr/NNNN-slug.md`.
3. Formato, corto, una pantalla:
   - Título `# NNNN · Decisión`.
   - `Fecha: AAAA-MM-DD. Estado: aceptada.`
   - **Contexto**: qué problema o presión obliga a decidir, en tres a cinco frases.
   - **Decisión**: qué se hace, en afirmativo.
   - **Consecuencias**: qué cambia en el código y en el trabajo, lo bueno y lo malo.
   - **Alternativas descartadas**: cada una con el porqué en una frase.
4. Si la decisión cambia una regla dura o un comando, actualiza `CLAUDE.md` en la misma pasada; si cambia el método, `docs/WORKFLOW.md`; si cambia el producto, el plan. Un tema, un documento dueño.
5. Commit `docs(adr): NNNN slug`.
