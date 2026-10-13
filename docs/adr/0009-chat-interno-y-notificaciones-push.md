# 0009 · Chat dentro de la app en vez de bot de Telegram, y alertas por notificaciones push

Fecha: 2026-10-13. Estado: aceptada.

## Contexto

El plan preveía un bot de Telegram con grammY. En la fase 2 serviría para capturar gastos escritos en lenguaje natural e interpretados con IA y para recibir las alertas por reglas; en la fase 3, para el resumen semanal y las preguntas sobre los datos. El desarrollador propuso un chat dentro de la propia app. El riesgo del proyecto está en el dinero y los datos personales. Un bot es una puerta pública más, con su propio token, un webhook y la verificación del chat por id, y sus mensajes pasan por los servidores de Telegram. La feature 002 trae el inicio de sesión y la PWA instalable, que son la base de las dos alternativas.

## Decisión

- La captura en lenguaje natural, el resumen semanal y las preguntas sobre los datos viven en un **chat dentro de la app**, detrás del mismo inicio de sesión de Supabase Auth.
- La IA, Claude por la API con tool use, interpreta y redacta. No escribe en la base: propone un movimiento, y la escritura pasa por la misma acción validada con zod y las mismas funciones de `src/lib` que el formulario.
- Las alertas por reglas llegan como **notificaciones push web**, con el service worker de la PWA, enviadas desde el servidor por las reglas nocturnas de Vercel Cron.
- Sin Telegram ni grammY.

## Consecuencias

- Hay una integración externa menos: sin token de bot, sin webhook público y sin verificar el chat por id. A lo que ya protege el inicio de sesión se suman el endpoint del chat, la suscripción a push y las claves de envío.
- Los mensajes y montos no pasan por Telegram. Sí pasan por la API de Claude, como ya preveía el plan.
- El chat puede mostrar lo interpretado con las piezas de la interfaz, por ejemplo una propuesta editable con el antes y después de saldos. Si se confirma antes de guardar lo decide su spec.
- Las alertas exigen permiso de notificaciones. En iPhone solo llegan con la app instalada en la pantalla de inicio; en Android, también desde el navegador.
- Sin conexión no se puede escribir al chat, a diferencia de Telegram, que guarda el mensaje. Una cola sin conexión sería otra feature, si hace falta.
- La base tiene `telegram` en el enum `origen_movimiento` (migración 0000). La feature del chat añadirá `chat` con `pnpm db:generate`. `telegram` quedará sin uso, porque quitar un valor de un enum en Postgres exige recrear el tipo. Hasta entonces no se toca.

## Alternativas descartadas

- Bot de Telegram, como decía el plan: suma una puerta pública con su propio token y hace pasar los datos financieros por los servidores de un tercero.
- Telegram solo para las alertas: mantiene el bot, su token y su webhook para algo que el push de la PWA de la 002 ya cubre.
- Alertas solo dentro de la app, sin push: no avisan con la app cerrada, que es justo para lo que existen.
