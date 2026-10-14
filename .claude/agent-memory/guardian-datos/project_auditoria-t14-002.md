---
name: auditoria-t14-002
description: Auditoría T14 de 002 (2026-10-14): primera vuelta NO APLICAR por TLS en db/index.ts; segunda vuelta sobre 790ee93 SEGURO DE APLICAR con H1-H7 cerrados y medidos; qué mirar en T15
metadata:
  type: project
---

**Primera vuelta**, sobre adb227d, el 2026-10-14: **NO APLICAR**. Bloqueaba solo una cosa: `src/db/index.ts` no exigía TLS. Los hallazgos H1-H8 están en [[defectos-datos-encontrados]].

**Segunda vuelta**, sobre 790ee93, el 2026-10-14: **SEGURO DE APLICAR**. H1-H7 cerrados y medidos (detalle en [[defectos-datos-encontrados]]). Después llegó bc5358b, que solo toca documentos: ADR 0010 y CLAUDE.md. Ese ADR acepta TLS sin verificar el certificado.

**Medido en la segunda vuelta (referencia para T15):**

- H1, con `index.ts` real y una URL del pooler sin clave real:
  - sin sslmode, con prefer, disable, `ssl=true`, require&disable, `REQUIRE` o una local con `?host=` remoto: LANZA;
  - con require o verify-full: arranca con `ssl="require"`;
  - la local arranca con `ssl=false` y responde;
  - con require contra finanzas-db, que no tiene TLS: ECONNRESET, sin caer a texto plano.
- S8 (partida de 300.000.000 USD): ahora la frena `leerMonto` con "…mayor que cero y razonable." El mensaje "Ese desglose da un aporte mensual demasiado grande." sale con 20 M × 13 o al pasar de 2147483600. En ambos casos, 0 filas y la regla intacta.
- Demo en una copia: 539300 = 539300, huella del autor 6819eb1d…, idempotente.
- Base vacía, migrada y sembrada dos veces: 10 ✓, la nota nueva de la prima, cuadre 0 = 0.
- `pnpm verify --forzar` en verde en 44 s: 285 pruebas, build y humo con PUT, PATCH y DELETE → 405.

**Why:** el criterio 13 de la spec 002 pide cerrar cada hallazgo, o aceptarlo con un ADR, antes de que Vercel reciba la cadena de conexión.

**How to apply:** en T15:

- con Supabase real, comprobar `select version()`, que `db.transaction` funcione por el pooler de transacción (desglose y categorías) y que "Enforce SSL" rechace una conexión sin TLS;
- `docs/despliegue.md` todavía no existe, y los mensajes de `urlProduccion` remiten a él;
- si cambian `fondos.ts` o las acciones de sobres, repetir `t14/v2-sobres.cts` y `t14/v2-carrera.cts`.
