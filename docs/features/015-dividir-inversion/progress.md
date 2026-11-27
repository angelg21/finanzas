# 015 · Progreso

## Etapas

- [x] Especificada (2026-11-26, decisiones del desarrollador en el chat: Negocios libre, saldo en largo plazo, 2/3 y 1/3)
- [x] Construida y mirada (2026-11-26, falta que el desarrollador la valide en el teléfono)
- [ ] Verificada
- [ ] Revisada
- [ ] Fusionada

## Tareas

- [x] T1. `src/lib/dividir-inversion.ts` con `dividirRegla` y `planDeDivision`, y sus pruebas, viéndolas fallar primero.
- [x] T2. `tipo_sobre` con `negocios`; migración generada y aplicada en local; cada lista por tipo con su valor.
- [x] T3. Semilla por tipo y demostración por tipo; comprobaciones viejas que buscaban "Inversión" por nombre, por tipo.
- [x] T4. Script `dividir-inversion` con vista previa, aplicar, comparación de saldos e idempotencia.
- [x] T5. `scripts/comprobar-015.ts` en verde y capturas de Sobres y Reglas.
- [x] T6. Plan y diseño al día.

## Notas

- 2026-11-26. T1: 10 pruebas en `dividir-inversion.test.ts`, vistas fallar (sin módulo) y luego en verde.
- 2026-11-26. T2: `drizzle/0011_narrow_cammi.sql`, `ADD VALUE 'negocios'`; aplicada en local. TypeScript señaló las cuatro listas por tipo.
- 2026-11-26. T3 y T4: semilla por tipo; demostración y `comprobar-004` buscan Inversión por tipo; la foto de saldos del importador pasó a `src/db/foto-de-saldos.ts` y la usan los dos scripts.
- 2026-11-26. T5: `pnpm exec tsx scripts/comprobar-015.ts --url http://localhost:3000` en verde (★ 1, 2, 3, 5 y 8, y 6 y 7), dejando la base como estaba. Luego `pnpm db:dividir-inversion --aplicar` en local y capturas de `/sobres` y `/sobres/reglas`: 20 % y 10 %.
- 2026-11-26. Guardián de datos: SEGURO DE APLICAR. Corregido lo bajo: la semilla da regla a Negocios también si Inversión no tiene fila de regla (una primera semilla cortada entre sobres y reglas dejaba los porcentajes en 90 %), y el script toma los sobres por id. Avisos para el desarrollador: si un movimiento entra mientras corre, aborta sin escribir y se vuelve a correr; no guardar Reglas de reparto mientras corre y recargar la página después. `comprobar-015 --url` en verde por el camino completo; `pnpm verify` en verde.
- Producción, en este orden: `pnpm db:migrate:produccion` (el tipo nuevo), publicar, y `pnpm db:dividir-inversion:produccion` (vista previa y escribir "dividir"). Lo corre el desarrollador.
