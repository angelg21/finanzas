---
name: f-ship
description: Etapa 5 del pipeline. Fusiona la feature NNN en main con el historial limpio, los gates en verde en este instante y los documentos del plan al día. Si existe un remoto, publica y abre el pull request. Úsalo solo con veredicto APTO.
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

- Sin remoto (`git remote -v` vacío): `git switch main && git merge --no-ff feat/NNN-slug -m "feat(NNN): título (#NNN)"` y borra la rama local.
- Con remoto: `git push -u origin feat/NNN-slug` y `gh pr create` con título `feat(NNN): título` y cuerpo con: resumen, criterios ★ y sus pruebas, salida de `pnpm verify`, veredicto del revisor. Estas dos acciones piden confirmación. Fusiona el PR tú mismo cuando el usuario lo autorice.

## Cierre

Di en tres líneas qué se fusionó, qué cerró del plan y cuál es la siguiente feature candidata según el plan. Recuerda el `/clear`.
