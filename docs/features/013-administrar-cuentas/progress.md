# 013 · Progreso

## Etapas

- [x] Especificada (2026-11-10, por pedido directo: "arregla eso ya")
- [x] Construida y mirada (2026-11-10, falta que el desarrollador la valide en el teléfono)
- [ ] Verificada
- [ ] Revisada
- [ ] Fusionada

## Tareas

- [x] T1. Reglas puras en `src/lib/cuentas.ts` con sus pruebas, viéndolas fallar primero.
- [x] T2. Columnas `icono` y `color` en `cuentas`, migración generada y aplicada en local.
- [x] T3. Lecturas y escrituras en `src/db/cuentas.ts`; `saldosPorCuenta` con icono, color y archivadas con saldo.
- [x] T4. Acciones, formulario y pantallas de nueva y editar cuenta; eliminar, archivar y restaurar.
- [x] T5. Cuentas e inicio pintan el aspecto elegido; capturas en ambos temas.
- [x] T6. Plan, diseño y observaciones al día.

## Notas

- 2026-11-10. T1: 9 pruebas nuevas en `cuentas.test.ts`, vistas fallar (9 de 12 en rojo) y luego en verde.
- 2026-11-10. T2: `drizzle/0009_ambiguous_carlie_cooper.sql`, dos `ADD COLUMN` nulos, aplicada en local.
- 2026-11-10. T3 a T5: `pnpm exec tsx scripts/comprobar-013.ts --url http://localhost:3000` en verde (★ 2, 5, 7, 8, 9 y 10 en la base; 1, 2, 3 y 8 en pantalla sin JavaScript). Capturas de `/cuentas`, `/cuentas/nueva` y `/cuentas/1` en ambos temas, y de la tarjeta de archivadas con una cuenta de prueba que luego se borró.
- 2026-11-10. `pnpm verify` en verde (53,8 s), con `/cuentas/nueva` y `/cuentas/999999` en el humo.
- Producción: hace falta `pnpm db:migrate:produccion` (lo corre el desarrollador) antes de que el despliegue use las columnas nuevas.
