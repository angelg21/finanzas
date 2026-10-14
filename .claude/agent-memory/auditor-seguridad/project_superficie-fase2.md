---
name: superficie-fase2
description: Puntos ciegos de la defensa de sesión que muerden en la fase 2 (chat con IA, push, route handlers) y fase 3 (Binance); mirar al auditar esas fases
metadata:
  type: project
---

Lo que la defensa de la 002 no cubre y que se vuelve crítico al llegar el chat, el push (ADR 0009) y Binance:

- El proxy deja pasar sin sesión toda petición que trae la cabecera `next-action` (en 2026-10-14, con cualquier método). Un `route.ts` futuro (por ejemplo `/api/chat` o `/api/push`) queda abierto si no comprueba la sesión por su cuenta, aunque parezca cubierto por el proxy.
- `scripts/estructura.mjs` solo exige la sesión en archivos llamados `acciones.ts` y en el `default` de `page.tsx`. No mira `generateMetadata`/`generateViewport`, `layout.tsx`, `route.ts` ni un `"use server"` en otro archivo.
- Antes de `exigirSesion`, Next decodifica los argumentos de cualquier acción (React Flight `decodeReply`), también los de `entrar`, que es pública. Next y React se mantienen al día: es la superficie previa a la autenticación.
- `public/sw.js` todavía no tiene manejador `push`. Cuando lo tenga, revisar qué texto muestra en la pantalla bloqueada (montos, notas).
- `guardia.mjs` reconoce `sk-` (clave de Claude), pero no claves VAPID, de Binance, `sb_secret_` ni JWT.

**Why:** hallado en la auditoría T14 (2026-10-14). El patrón "la página la protege `exigirSesion`" no se extiende solo a otros tipos de archivo.

**How to apply:** en `/f-audit` de la fase 2, probar cada endpoint nuevo con `PUT`/`POST` y `next-action: x` sin cookies, y comprobar que la IA solo propone y que lo propuesto pasa por la misma acción con zod. Ver [[auditoria-fase1-002]].
