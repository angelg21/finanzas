---
name: f-status
description: Estado del pipeline en una pantalla: rama, feature activa, tareas, etapa siguiente, gates y observaciones pendientes. Úsalo al empezar, cuando pidan "implementa X" sin spec, o cuando no esté claro qué toca.
disable-model-invocation: false
---

Muestra el estado del pipeline y nada más. No cambies archivos.

1. Ejecuta `node .claude/hooks/session-start.mjs < /dev/null` (o con entrada vacía) y muestra su salida tal cual: rama, feature activa, tareas, siguiente paso, gate.
2. Añade:
   - `git status --short` resumido y `git log --oneline -5`.
   - Features en `docs/features/` con su estado (última casilla marcada de "Etapas" en cada `progress.md`).
   - Puntos de `docs/observaciones.md` sin "Hecho" ni "Cambio".
   - Siguiente feature candidata según la fase actual del plan (sección 6), en una línea.
3. Termina con el comando exacto que toca ejecutar ahora, por ejemplo `/f-build 001` o `/f-spec captura rápida de gasto`.

Si el usuario había pedido implementar algo sin spec, cierra con: "Sin spec no se codifica. ¿Arranco `/f-spec <idea>`?".
