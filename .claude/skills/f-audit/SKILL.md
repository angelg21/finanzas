---
name: f-audit
description: Auditoría de seguridad al cerrar una fase del plan (o completa antes de desplegar). Lanza al subagente auditor-seguridad, que busca vías de ataque concretas, y al guardian-datos sobre el esquema completo. Úsalo al terminar la fase 1, 2 o 3, y siempre antes del primer despliegue.
argument-hint: [fase|completo]
---

Auditar: **$ARGUMENTS**.

1. Lee la fase correspondiente de la sección 6 del plan y lista qué entró en esta fase que amplíe la superficie de ataque: autenticación, bot de Telegram, API de Binance, despliegue, nuevas tablas o acciones.
2. Lanza al subagente `auditor-seguridad` con:
   > Audita la fase $ARGUMENTS del plan. Busca vías de ataque concretas contra el código tal como está en `main`, siguiendo tu procedimiento. Reporta pasos para explotar cada una y cómo cerrarla.
3. Lanza al subagente `guardian-datos` con:
   > Audita el esquema completo (`src/db/schema.ts`, `drizzle/`), las semillas y todas las server actions al cierre de la fase $ARGUMENTS. Comprueba centavos, invariante y validación de entradas.
4. Traslada los informes íntegros. Por cada hallazgo, decide con el usuario: se cierra ahora (cambio directo o feature nueva con `/f-spec`) o se acepta el riesgo y se escribe en `docs/adr/` con `/f-adr`.
5. Registra el cierre de la fase en el plan: fecha, hallazgos y decisiones, en la sección 6.

Si el auditor no encuentra nada, dilo tal cual y deja escrito qué revisó. "No encontró nada" también es evidencia.
