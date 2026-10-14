---
name: superficie-fase2
description: Puntos ciegos de la defensa de sesión que muerden en la fase 2 (chat con IA, push, route handlers) y fase 3 (Binance); mirar al auditar esas fases
metadata:
  type: project
---

Lo que la defensa de la 002 no cubre y que se vuelve crítico al llegar el chat, el push (ADR 0009) y Binance:

- El proxy deja pasar sin sesión todo `POST` con cabecera `next-action` (cualquier valor). Con `rsc: 1` además, Next salta el manejo de acciones y renderiza el flight de la página entera (layouts, `generateMetadata`, página); solo `exigirSesion` lo frena (medido en 790ee93: 200 text/x-component con NEXT_REDIRECT a /entrar). El cliente de Next nunca manda `rsc` en una acción, así que el proxy puede tratar esa combinación como no-acción. Un `route.ts` futuro (`/api/chat`, `/api/push`) recibe el `POST` con `next-action: x` sin sesión si no la comprueba él.
- `scripts/estructura.mjs` (790ee93) no ve, probado con `revisarArchivo` en memoria: `export { h as GET }` en route.ts, `export const generateMetadata = async`, layout síncrono con un hijo async que consulta, `template.tsx`, `not-found.tsx`, `opengraph-image.tsx`/`icon.tsx` dentro de `(con-sesion)`, acciones inline con `"use server"` dentro de una página y `export async function*`. Todo `(sin-sesion)` queda exento entero.
- Antes de `exigirSesion`, Next decodifica los argumentos de cualquier acción (React Flight `decodeReply`), también los de `entrar`. Next y React al día: es la superficie previa a la autenticación.
- `public/sw.js` todavía no tiene manejador `push`. Cuando lo tenga, revisar qué texto muestra en la pantalla bloqueada (montos, notas).
- `guardia.mjs` reconoce `sk-` (clave de Claude), pero no claves VAPID, de Binance, `sb_secret_` ni JWT; y no mira si un archivo escrito lee un `.env`.

**Why:** hallado en la auditoría T14 (2026-10-14) y su segunda vuelta. El patrón "la página la protege `exigirSesion`" no se extiende solo a otros tipos de archivo, y la ADR 0010 da la regla de estructura por completa.

**How to apply:** en `/f-audit` de la fase 2, probar cada endpoint nuevo con `POST` + `next-action: x` (y `rsc: 1`) sin cookies, pasar los archivos nuevos por `revisarArchivo`, y comprobar que la IA solo propone y que lo propuesto pasa por la misma acción con zod. Ver [[auditoria-fase1-002]].
