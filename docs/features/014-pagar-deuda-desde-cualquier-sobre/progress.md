# 014 · Progreso

## Etapas

- [x] Especificada (2026-11-25, por pedido directo: "necesito que arreglemos algo ya mismo")
- [x] Construida y mirada (2026-11-25, falta que el desarrollador la valide en el teléfono)
- [ ] Verificada
- [ ] Revisada
- [ ] Fusionada

## Tareas

- [x] T1. `sobreAceptaPago` y `prepararPago` con categoría, con sus pruebas, viéndolas fallar primero.
- [x] T2. Check de forma: el pago admite categoría; migración generada y aplicada en local.
- [x] T3. Escritura: sobre y categoría comprobados en la transacción; `cuentaComoGasto` en las consultas de gastos y Mover.
- [x] T4. Formulario de pago con sobre y categoría; acción; fila con el círculo de su categoría.
- [x] T5. `scripts/comprobar-014.ts` en verde y capturas.
- [x] T6. Plan y diseño al día (la spec 005 queda como registro; el cambio lo cuenta esta spec).

## Notas

- 2026-11-25. T1: 3 pruebas nuevas en `deudas.test.ts`; 2 vistas fallar (la del sobre ya pasaba: `prepararPago` recibía el sobre) y luego las 825 de `src/lib` en verde.
- 2026-11-25. T2: `drizzle/0010_boring_selene.sql`, el check de forma sin `categoria_id is null` en `pago_deuda`; aplicada en local.
- 2026-11-25. T3 a T5: `pnpm exec tsx scripts/comprobar-014.ts --url http://localhost:3000` en verde (★ 2, 3, 5, 6, 7 y 8 en la base; 1, 3 y 5 en pantalla sin JavaScript). Capturas de `/deudas/206` en ambos temas.
- Producción: hace falta `pnpm db:migrate:produccion` (lo corre el desarrollador) antes de publicar: sin él, un pago con categoría choca con el check viejo.
