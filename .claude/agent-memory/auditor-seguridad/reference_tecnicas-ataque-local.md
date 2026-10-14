---
name: tecnicas-ataque-local
description: Cómo atacar el build local de finanzas sin leer .env ni imprimir secretos (invocar acciones a mano, usuario de prueba, Edge por CDP)
metadata:
  type: reference
---

- Build: `pnpm build` y luego `pnpm exec next start -p 3131` en segundo plano (3123 lo usa el humo). `next start` escucha en todas las interfaces de la red: detenerlo al terminar.
- Para invocar una acción a mano, el id sale del HTML: el input `$ACTION_N:0` lleva `{"id":...}`, o `$ACTION_ID_<id>` en un formulario sin estado. Se hace POST con la cabecera `next-action: <id>` y un cuerpo multipart con `0` = `[estadoPrevio,"$K1"]` y los campos como `1_<nombre>`. Para que nada se escriba, se usan datos inválidos (por ejemplo, el nombre vacío en `guardarCategoria`).
- Las credenciales del usuario de prueba de "finanzas-dev" se leen con `process.loadEnvFile(".env.local")` o con dotenv desde node, como `scripts/humo.mjs`, sin imprimirlas. Cada entrada consume el límite de intentos de ese proyecto.
- Edge sin ventana por CDP, igual que `scripts/capturas.mjs`: sirve para medir lo que hace el router cliente (por ejemplo, una redirección tras una acción). Para destinos hostiles se usa `evil.example`, que no resuelve.
- Para ver si un valor de `.env.local` se filtra, se busca cada valor en `.next/static`, `public`, los `.html`/`.rsc` prerenderizados y el registro del servidor, imprimiendo solo el nombre de la variable.
- Falsos positivos ya vistos: el nombre de cookie que uno mismo envía vuelve en un Set-Cookie de borrado; "Inversión" aparece en `/entrar` porque es una píldora de la marca.
