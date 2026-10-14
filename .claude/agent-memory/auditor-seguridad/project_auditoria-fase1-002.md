---
name: auditoria-fase1-002
description: Hallazgos de /f-audit sobre feat/002-pwa-y-despliegue (T14, 2026-10-14), su segunda vuelta en 790ee93 y lo que quedó abierto o aceptado en ADR 0010
metadata:
  type: project
---

Auditoría T14 de la feature 002 (rama `feat/002-pwa-y-despliegue`), 2026-10-14. Primera vuelta en adb227d, segunda en 790ee93.

1. **Redirección abierta: CERRADA en 790ee93.** `destinoSeguro` devuelve `pathname+search+hash` normalizado y rechaza `//`. En Edge con el usuario de prueba, `/.//`, `/%2e//`, `/a/..//` acaban en `/`; `/%2F%2F...` y `/%5C%5C...` se quedan en el origen (404). Ninguna petición a otro host.
2. **Lectura sin sesión: CERRADA para los datos.** PUT/PATCH/DELETE/OPTIONS dan 405; `generateMetadata` de `/sobres/[id]` exige sesión; las respuestas de todos los ids miden igual. Pero el proxy sigue sin ser barrera: ver [[superficie-fase2]] (POST con `next-action` y `rsc: 1`).
3. Límite de intentos: aceptado en ADR 0010.
4. **Cadena de producción al alcance del agente: PARCIAL.** Se movió a `~/.finanzas/produccion.env` y el hook `comandos.mjs` niega comandos que la nombren, pero el hook solo mira el texto del comando: comodines, comillas partidas, nombres cortos 8.3 (el volumen los genera), `node -e` (en `allow`) o un script escrito con Write lo leen sin preguntar. ADR 0010 dice "el agente no puede leerla": es falso. Arreglo de fondo: que `urlProduccion` la pida oculta en la terminal y no exista en disco.
5. TLS sin verificar certificado: aceptado en ADR 0010; `conexionSegura` comprobado.
6. Revocación: aceptado en ADR 0010.
7. **Registros: PARCIAL.** Los dos `console.error` solo llevan el código, pero `agregarPartida` relanza y `fijarAporteManual`/`eliminarPartida` no atrapan: Next hace `console.error` del DrizzleQueryError, cuyo mensaje trae los parámetros.

**Why:** criterio 13 de la spec: Vercel no recibe la cadena de producción hasta que cada hallazgo esté cerrado o aceptado con ADR.

**How to apply:** en la próxima auditoría, repetir primero `POST` con `next-action: x` + `rsc: 1` sin cookies (seguir el 307 a `?_rsc`) y ver si el proxy ya lo corta; mirar si `urlProduccion` sigue leyendo un archivo. Ver [[tecnicas-ataque-local]].
