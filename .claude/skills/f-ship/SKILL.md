---
name: f-ship
description: Etapa 5 del pipeline. Fusiona la feature NNN en main con el historial limpio, los gates en verde en este instante y los documentos del plan al día, y publica main en el remoto privado. Sin pull request. Úsalo solo con veredicto APTO.
argument-hint: [NNN]
---

Fusionar la feature **$ARGUMENTS**.

## Condiciones, todas obligatorias

1. `progress.md` con "Revisada" marcada y veredicto APTO en sus notas.
2. Árbol limpio: `git status --porcelain` vacío.
3. `pnpm verify --forzar` en verde **ahora**, no "hace un rato". Pega la última línea.
4. El autor repasó su diff: muestra `git diff main...HEAD --stat` y pide al usuario que confirme que lo leyó línea por línea. Si cambió algo sustancial después de `/f-review`, vuelve a `/f-review`.

## Historial

- Un commit por tarea está bien; lo que no está bien son commits de "arreglo del arreglo". Si los hay, `git rebase -i` no está disponible: agrupa con `git reset --soft main` y vuelve a hacer commits coherentes por tarea, en español, Conventional Commits con el número de feature: `feat(NNN): …`.

## Documentos

- Marca en `docs/plan-financiero-y-app.md` las casillas o fases que la feature cierra.
- Si la feature resolvió puntos de `docs/observaciones.md`, márcalos como hechos.
- Marca "Fusionada" en `progress.md` con la fecha. Commit `docs(NNN): cierre`.

## Fusión

Sin pull request: la revisión ya la hizo el subagente revisor y el candado es el gate local. GitHub gratis no protege ramas en repos privados y no hace falta.

1. `git switch main && git merge --no-ff feat/NNN-slug -m "feat(NNN): título"`. El cuerpo del commit de fusión lleva: resumen, criterios ★ y sus pruebas, última línea de `pnpm verify` y veredicto del revisor.
2. `git push origin main` (pide confirmación). La rama de la feature se borra en local; no se publica salvo que el usuario quiera respaldo a mitad de camino (`git push -u origin feat/NNN-slug`).

## Cierre

Di en tres líneas qué se fusionó, qué cerró del plan y cuál es la siguiente feature candidata según el plan. Recuerda el `/clear`.
