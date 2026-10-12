---
name: entorno-revision-finanzas
description: Cómo ejercitar finanzas al revisar - base finanzas-db, build en 3124, envío sin JS por campos $ACTION, Git Bash y capturas, guardian en paralelo
metadata:
  type: reference
---

- Base local: contenedor `finanzas-db`; `docker exec finanzas-db psql -U finanzas -d finanzas` (el rol `postgres` no existe).
- Para probar páginas reales: `pnpm exec next start -p 3124` sobre el build que deja `pnpm verify`. Cerrar después con `netstat -ano | grep :3124` y `taskkill //PID <pid> //T //F`.
- Una acción de servidor se puede enviar como un navegador sin JS: GET de la página, copiar los `<input type="hidden" name="$ACTION...">` y hacer POST multipart con los campos. Las filas que crea llevan `origen = manual` y `referencia_externa` nula. Si antes de empezar la base tenía 0 filas fuera de `demo-*`, se limpian con `delete from movimientos where origen='manual' and referencia_externa is null`.
- Git Bash convierte `/ruta` en `C:/Program Files/Git/ruta`. Para capturas: `MSYS_NO_PATHCONV=1 node scripts/capturas.mjs http://localhost:3124 /nuevo/gasto` (sin `--`). Las capturas de `capturas/` pueden ser de antes del último cambio: regenerarlas.
- `guardian-datos` puede correr a la vez que yo: toca la base con sondas `demo-sonda-*` y deja cambios sin commit en `.claude/agent-memory/guardian-datos/`. Esos cambios no son míos. Volver a contar las filas antes de cerrar.
- `scripts/comprobar-NNN.ts --url http://localhost:3124` es el script de ★ contra la base que trae el autor. Se niega a correr si hay filas que no sean demo.

Ver [[donde-se-esconden-defectos]].
