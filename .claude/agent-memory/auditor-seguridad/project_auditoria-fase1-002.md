---
name: auditoria-fase1-002
description: Hallazgos de /f-audit completo sobre feat/002-pwa-y-despliegue (T14, 2026-10-14) y cuáles bloquean publicar; revisar su cierre en la próxima auditoría
metadata:
  type: project
---

Auditoría T14 de la feature 002 (rama `feat/002-pwa-y-despliegue`, commit adb227d), 2026-10-14. Veredicto: NO publicar hasta cerrar 1 y 2.

1. **Redirección abierta (criterio 4 ★), bloquea.** `destinoSeguro` devuelve la cadena cruda; `/.//evil.com`, `/%2e//evil.com` y `/a/..//evil.com` pasan y se normalizan a la ruta `//evil.com`. Con JavaScript, el router de Next navega a `http://evil.com/...` tras entrar (medido en Edge con CDP). Sin JavaScript es inocuo (Location relativa y Next responde 308 a `/evil.com`).
2. **Lectura sin sesión (criterios 1 y 2 ★), bloquea.** `PUT`/`PATCH`/`DELETE` con cabecera `next-action` (cualquier valor) saltan el proxy y Next renderiza la página. `generateMetadata` de `/sobres/[id]` consulta la base antes de `exigirSesion` y deja el nombre del sobre en `<title>`, enumerable por id.
3. Límite de intentos de Supabase compartido: un 429 al renovar, con el token vencido, hace que auth-js 2.117.2 borre la sesión. Riesgo de disponibilidad: decidir una regla del firewall de Vercel o aceptarlo con ADR.
4. `.claude/settings.json` deja `grep`, `sed -n`, `node` y `pnpm` sin preguntar, y eso lee `.env.produccion.local` sin pasar por el `deny`. Cerrar antes de crear ese archivo (T15).
5. Bajos: `sslmode=require` sin verificar certificado (postgres.js pone `rejectUnauthorized=false` y SCRAM sin enlace de canal); una sesión robada dura 400 días y revocarla tarda hasta que vence el JWT; `console.error` de un DrizzleQueryError escribe monto y nota en los registros de Vercel.

**Why:** criterio 13 de la spec: Vercel no recibe la cadena de producción hasta que cada hallazgo esté cerrado o aceptado con ADR.

**How to apply:** en la próxima auditoría, repetir primero el PUT con `next-action` y la redirección con `/.//`, y ver que existan en `acceso.test.ts` y en el humo. Ver [[superficie-fase2]] y [[tecnicas-ataque-local]].
