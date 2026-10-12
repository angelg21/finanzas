---
name: entorno-revision-finanzas
description: Cómo ejercitar finanzas al revisar - base finanzas-db, build en 3124, envío sin JS por campos $ACTION, Edge sin ventana por DevTools para el estado con JS, reloj atrasado para cruzar la medianoche, Git Bash y capturas, guardián en paralelo
metadata:
  type: reference
---

- Base local: contenedor `finanzas-db`; `docker exec finanzas-db psql -U finanzas -d finanzas` (el rol `postgres` no existe).
- Para probar páginas reales: `pnpm exec next start -p 3124` sobre el build que deja `pnpm verify`. Cerrar después con `netstat -ano | grep :3124` y `taskkill //PID <pid> //T //F`.
- Una acción de servidor se puede enviar como un navegador sin JS: GET de la página, copiar los cuatro `<input type="hidden" name="$ACTION...">` (des-escapando `&quot;`) y hacer POST multipart con `curl --form-string`. Las filas que crea llevan `origen = manual` y `referencia_externa` nula. Si al empezar la base tenía 0 filas fuera de `demo-*`, se borran con `delete from movimientos where origen='manual' and referencia_externa is null` y el rango de ids propio.
- Estado con JavaScript, sin Playwright: Edge en `C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe` con `--headless=new --remote-debugging-port=9333 --user-data-dir=<scratchpad>`, `/json/list` para el WebSocket y el `WebSocket` global de Node 22 con `Runtime.evaluate`. Radios: `input.click()`. Texto: el setter nativo de `HTMLInputElement.prototype.value` más un evento `input`, para que React lo note. Esperar unos 1,5 s de hidratación tras cargar y unos 2,5 s tras enviar. En selectores, `[class*="col-span-5"]` en vez de escapar `lg\:`.
- Cruzar la medianoche sin esperar: un segundo `next start -p 3125` con `NODE_OPTIONS="--require <scratchpad>/reloj-atrasado.cjs"` y `DESFASE_MS=-10800000` (ruta sin espacios). El shim reemplaza `Date` por una función que delega en el `Date` real y copia `now`, `UTC` y `parse`; con `class extends Date` Next falla con "Date.UTC is not a function". Se abre la página en Edge, se cambia el servidor de 3125 por uno normal y se guarda desde la misma pestaña.
- Git Bash convierte `/ruta` en `C:/Program Files/Git/ruta`. Para capturas: `MSYS_NO_PATHCONV=1 node scripts/capturas.mjs http://localhost:3124 /nuevo/gasto` (sin `--`). Las capturas de `capturas/` pueden ser anteriores al último cambio: regenerarlas.
- `guardian-datos` puede correr a la vez: toca la base con sondas `demo-sonda-*` y deja cambios sin commit en `.claude/agent-memory/guardian-datos/`. Esos cambios no son míos, pero ensucian el árbol para el ship: decirlo en el informe. Volver a contar las filas antes de cerrar.
- `scripts/comprobar-NNN.ts --url http://localhost:3124` es el script de los ★ contra la base. Se niega a correr si hay filas que no sean demo: limpiar las propias antes.

Ver [[donde-se-esconden-defectos]].
