# 0004 · Pipeline de desarrollo con agente, adaptado a un desarrollador

Fecha: 2026-10-07. Estado: aceptada.

## Contexto

El usuario trae de otro proyecto un método en cinco etapas con hooks, gates, subagentes revisores y specs por feature. Aquí hay una sola persona, sin apuro y sin miles de usuarios; el riesgo está en el dinero y los datos personales, no en la escala.

## Decisión

Adoptar el pipeline completo (`/f-spec`, `/f-build`, `/f-verify`, `/f-review`, `/f-ship`, más `/f-audit` al cerrar fases) con estas adaptaciones: sin aprobación cruzada ni CI; pruebas antes del código solo para lo invisible en pantalla (dinero, reparto, invariante, importador); sin pruebas de navegador automatizadas, sustituidas por la mirada del autor y `pnpm capturas`; gate rápido en el hook `Stop` y gate completo al fusionar; subagentes `revisor`, `guardian-datos` y `auditor-seguridad` con memoria versionada. El fundamento está en `docs/WORKFLOW.md`.

## Consecuencias

- Pedir "implementa X" sin spec no produce código: produce una spec.
- Cada regla del repo nace de un defecto real o de una decisión escrita; las reglas "por si acaso" se eliminan.
- El árbol se sella al pasar los gates para no repetir trabajo.

## Alternativas descartadas

- Seguir sin método: el riesgo de desorden crece con cada feature y el trabajo de verificar se vuelve el cuello de botella sin herramientas.
- Adoptar el método íntegro: la ceremonia pensada para dos personas y un contrato habría frenado a una sola.
