# 012 · Progreso

Rama: `main` (por pedido del desarrollador, como la 011). Spec: `spec.md`.

## Tareas

- [x] T1 · `src/lib/leer-exportacion.ts`, `importacion.ts` y `mapeo-gestor-de-gastos.ts` con sus pruebas, vistas fallar antes (2026-11-09).
- [x] T2 · El historial no mueve saldos: `sumas-de-saldo.ts`, y no se abre ni se edita: `editar-movimientos.ts`, `enlaceDeEdicion`, la historia del sobre (2026-11-09).
- [x] T3 · `src/db/leer-xlsx.ts` y `src/db/importar.ts` con `pnpm db:importar` y `db:importar:produccion` (2026-11-09).
- [x] T4 · `scripts/comprobar-012.ts` contra la base y las páginas (2026-11-09).
- [x] T5 · ADR 0013, plan y esta spec (2026-11-09).

## Validación en navegador

- Sin pantallas nuevas. 2026-11-09, el agente con `comprobar-012 --url` contra `pnpm dev`: `/movimientos?fecha=2026-10-13` muestra lo importado sin enlace; `/sobres` igual que antes; `/cuentas` con los mismos totales y "Cuadra", y solo la fila nueva "Zinli · 0,00 USD" ("4 cuentas" → "5 cuentas"). Falta la del desarrollador tras importar en producción.

## Etapas

- [ ] Spec leída y corregida por el desarrollador
- [x] Construida (todas las tareas con commit)
- [ ] Validada en navegador
- [ ] Verificada: `pnpm verify` en verde, cada ★ con su prueba
- [ ] Revisada: veredicto APTO PARA FUSIONAR
- [ ] Fusionada en `main` el AAAA-MM-DD

## Notas

- **Construida fuera del pipeline, por pedido del desarrollador (2026-11-09):** "no quiero tardar demasiado haciendo esto, quiero que sea rápido". Quedan la lectura de la spec, `/f-verify 012` y `/f-review 012`.
- **El archivo:** `data/respaldos/2026_11_09_20_05_31_313152.xlsx`, 199 gastos, 23 ingresos y 1 transferencia del 2025-08-21 al 2026-10-13. `leer-xlsx.ts` lo lee igual que una lectura aparte con Python: 0 filas distintas, 223 filas sin errores.
- **Un tropiezo corregido antes del commit:** la primera versión marcaba el historial solo con `origen = 'importado'`, pero la demo usa ese mismo origen: sus saldos locales habrían quedado en 0. El historial se distingue por la referencia `historial-` (ADR 0013).
- **Evidencia:** `importacion.test.ts` 9 de 9 y `valores.criterios.test.ts` con el caso del historial; `comprobar-012 --url` en verde: 222 de 223 filas (el boleto de Dani omitido), 17 saldos iguales y el cuadre, 6.950,67 USD de gastos importados en la base, otra corrida no duplica, la gráfica de marzo de 2026 suma 401,77, KumIA acumula 4.820,00, no se abre para editar, y la base queda como estaba.
- **En producción:** además del boleto de Dani, debería saltarse el sueldo de SAX del 30 de septiembre (ya está como "Sueldo SAX"), y encontrar "Comida fuera" y "Hogar" en vez de crearlas. La vista previa lo muestra antes de confirmar.
