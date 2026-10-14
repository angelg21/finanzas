---
name: tecnicas-ataque-local
description: Cómo atacar el build local de finanzas sin leer .env ni imprimir secretos (invocar acciones a mano, usuario de prueba, Edge por CDP, probar hooks)
metadata:
  type: reference
---

- Build: `pnpm build` y luego `pnpm exec next start -p 3131 -H 127.0.0.1` en segundo plano (3123 lo usa el humo). Detenerlo al terminar con `taskkill //PID <pid> //T //F` (pid de `netstat -ano`).
- Ids de las acciones: `.next/server/server-reference-manifest.json`, campo `node`. Ese archivo trae `encryptionKey`: imprimir solo ids y `exportedName`.
- Para invocar una acción a mano: POST con `next-action: <id>` y multipart con `0` = `[estadoPrevio,"$K1"]` y campos `1_<nombre>`. Datos inválidos para que nada se escriba.
- Las peticiones con `rsc: 1` reciben 307 a `?_rsc=<hash>`: seguirlo con el mismo método y cabeceras.
- El hook `comandos.mjs` niega todo comando que nombre un `.env`, `.finanzas` o `.vercel`, también los míos. El usuario de prueba se usa desde un script en el scratchpad (escrito con Write) que hace `process.loadEnvFile(<ruta absoluta>)` sin imprimir nada. Para probar el hook, un script que le pasa JSON por stdin con los comandos (no se ejecutan).
- En Git Bash, los argumentos que empiezan por `/` se convierten en rutas de Windows: anteponer `MSYS_NO_PATHCONV=1`.
- Edge sin ventana por CDP, como `scripts/capturas.mjs`, con `Network.enable` para ver peticiones a otros hosts. Destinos hostiles: `evil.example`. Cada entrada consume el límite de intentos de finanzas-dev.
- Datos para buscar fugas: `docker exec finanzas-db psql -U finanzas -d finanzas -At -c "select id, nombre from sobres"`. Falsos positivos: "Inversión" es una píldora de `/entrar`; el nombre de cookie enviado vuelve en un Set-Cookie de borrado.
