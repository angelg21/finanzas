# 011 · Progreso

Rama: `main` (por pedido del desarrollador, como las features anteriores). Spec: `spec.md`.

## Tareas

- [x] T1 · `src/lib/transferencias.ts` con `prepararTransferencia` y sus pruebas (2026-10-28).
- [x] T2 · `src/db/transferencias.ts`: guardar la transferencia y su comisión juntas, con la categoría "Comisiones"; abrir y deshacer una transferencia (2026-10-28).
- [x] T3 · `/nuevo/transferir` (página, acción, formulario), el selector de Registrar, `/nuevo`, `/cuentas` con su enlace y su aviso, el título de la barra y el humo (2026-10-28).
- [x] T4 · Deshacer desde `/movimientos/[id]`: el enlace de la fila, la confirmación y la acción (2026-10-28).
- [x] T5 · `scripts/comprobar-011.ts` contra la base y las páginas (2026-10-28).
- [x] T6 · Actualizar plan y diseño (2026-10-28).

## Validación en navegador

- 2026-10-28, el agente en Edge a 390 px (claro y oscuro) y a 1280 px: elegir Cuenta prima y Binance, escribir 100 y 99, la línea "Comisión: 1,00 USD…", las unidades USD y USDT, Gastos del mes elegido; "Transferir" en "Mis cuentas"; el selector de Registrar con cinco tipos cabe en 331 de 390 px. Falta la del desarrollador en su teléfono.

## Etapas

- [ ] Spec leída y corregida por el desarrollador
- [x] Construida (todas las tareas con commit)
- [ ] Validada en navegador
- [ ] Verificada: `pnpm verify` en verde, cada ★ con su prueba
- [ ] Revisada: veredicto APTO PARA FUSIONAR
- [ ] Fusionada en `main` el AAAA-MM-DD

## Notas

- **Construida fuera del pipeline, por pedido del desarrollador (2026-10-28):** "necesito esa feature disponible lo antes posible". Se escribió esta spec para trazarla y se construyó sin esperar su lectura. Quedan la lectura, `/f-verify 011` y `/f-review 011`.
- Evidencia: `transferencias.test.ts` 8 de 8 (el primer intento de una prueba usaba "1.230", que la app lee como 1,23: se corrigió el dato de la prueba); `valores.criterios.test.ts` con tres casos nuevos (la transferencia entre cuentas abre; la venta de USDT y una reasignación con la marca, no). `comprobar-011` en verde contra la base: con comisión (Cuenta prima −100, Binance +99, Gastos del mes −1, Cuadra, categoría Comisiones), el reintento sin duplicar, la comisión como gasto sin venta, ninguna de 5 ventas de USDT se abre ni se deshace, deshacer deja todo como estaba y la segunda vez "no existe", sin comisión, borrar solo la comisión deja la transferencia; y con `--url`: la pantalla, guardar sin JavaScript (303 a `/cuentas?transferido=1`, comisión de 0,50), reenviar sin duplicar, la fila "Cuenta prima → Binance" y "Deshacer transferencia". La base queda como estaba, también la categoría.
- `src/app/(con-sesion)/movimientos/[id]/page.tsx` queda en 318 líneas, al borde del aviso de 320: lo próximo que entre ahí debería ir en su propio archivo.
