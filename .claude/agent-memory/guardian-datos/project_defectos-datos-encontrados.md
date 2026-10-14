---
name: defectos-datos-encontrados
description: Defectos y huecos de datos que encontré en auditorías (con fecha), abiertos y cerrados; revisado completo en la auditoría T14 de 002 (2026-10-14)
metadata:
  type: project
---

Antes de dar algo por cerrado, comprobar si estos puntos siguen abiertos. Última revisión completa: auditoría T14 de 002, el 2026-10-14 (ver [[auditoria-t14-002]]).

**Abiertos, nuevos en T14 (2026-10-14)**

- **Media, bloquea T15.** `src/db/index.ts` (la conexión de la app) valida que la URL se lea bien, pero no exige TLS. Medido sin conectar: con la URL del pooler sin `sslmode`, postgres-js da `ssl=false` y `max=10`. Los scripts sí exigen TLS (`exigeTls`). El URI que muestra el panel de Supabase no trae `sslmode`, y pegarlo tal cual manda los datos sin cifrar. Corrección: si `!esBaseLocal(url) && !exigeTls(url)`, lanzar un error, con su prueba; o aceptarlo con un ADR y "Enforce SSL" comprobado.
- **Media.** `agregarPartida` y `eliminarPartida` (en `sobres/[id]/acciones.ts`) y `fijarReglaFija` (en `db/fondos.ts`) hacen dos escrituras sin transacción. Medido con una partida de 300.000.000 USD: la partida se insertó, la regla quedó en 900 y la acción lanzó 22003 (`2500000900` no cabe en int4). El formulario diría "No se pudo guardar" con la partida ya guardada, y un reintento la duplicaría. No toca el cuadre.
- **Baja.** `reglas_reparto.valor` es `integer` y guarda centavos en las reglas fijas, con tope de 21,4 M USD. Medido: un aporte manual de 21474837 lanza 22003 sin escribir.
- **Baja.** Flotante fuera de `dinero.ts`: `formularios.tsx:96` pone `(actualCentavos / 100).toString()` y ese texto vuelve como monto. Medido: 0 diferencias en todo el rango de int4, pero falla por encima de 2^46 (104524 de 1e6), lo que importa si la columna se ensancha. Además, `movimiento.tsx:85` muestra `Number(m.tasa)`, solo en pantalla.
- **Baja.** En UTC (Vercel), `inicioDelMes()` de `consultas.ts` usa la hora del servidor. Medido el 31 de octubre a las 21:00 de Caracas: "gastado este mes" da 0 y la gráfica ya abre noviembre. Solo afecta a lo que se muestra.
- **Baja.** La nota de la cuenta prima en la semilla dice "Solo tránsito, saldo bajo", que contradice el ADR 0006. Se escribe una sola vez en producción.
- **Baja.** `z.coerce.number` en `veces` y `mes` acepta "0x10" = 16 y "1e1" = 10, y `veces` multiplica dinero.
- **Info.** `guardarCategoria` guarda como gasto, sin avisar, cualquier `tipo` distinto de "ingreso".

**Abiertos de antes (código sin cambios en T14, no medidos otra vez)**

- **2026-10-11.** El check `movimientos_forma_por_tipo` solo valida la forma. La base acepta un sobre "Por asignar", una categoría de ingreso, VES desde una cuenta USDT o una cuenta inactiva. Lo frena la acción, que compara los ids con la base: en T14 hubo 22 de 22 manipulaciones rechazadas con 0 filas. Tampoco hay checks para `tasa > 0`, `monto_destino > 0` ni `tope > 0`. Vigilar en cada escritor nuevo, sobre todo en el importador.
- **2026-10-11, T15 de 001.** Si una categoría cambia de tipo mientras se valida un gasto, el gasto puede quedar con una categoría de ingreso. Se cierra cuando la inserción compruebe el tipo.
- **2026-10-11, T15 de 001.** La unicidad de categorías no distingue mayúsculas en `lib`, pero sí en la base. El importador debe buscar una activa equivalente.
- **2026-10-12, baja.** Dos `db:seed` a la vez en una base vacía: una sale con 23505. Los datos quedan bien.
- **2026-10-11.** Los gastos del formulario (`captura-*`) no los borra `db:demo:limpiar`. En local quedan mezclados con la demo.
- **2026-10-11.** El pooler en modo transacción de Supabase no está medido; no hay uno local. Pendiente para T15.
- **Residuales de T3, T4 y T12 de 002:**
  - `pnpm exec tsx src/db/x.ts --produccion` solo lo frena `isTTY`;
  - la restauración corre como superusuario;
  - `auth.users` queda fuera del respaldo;
  - falta comprobar que producción no sea PG 18;
  - faltan las pruebas de base de `registrarCaptura` para `/f-verify`.

  Ver [[guardas-produccion]], [[respaldo-produccion]] y [[captura-idempotente]].

**Cerrados (verificados en T14, 2026-10-14)**

- **afc2286 (2026-10-12).** `aporteMensualCentavos` usa `repartirHaciaArriba` en BigInt. Ya no hay `Math.ceil` en `lib/fondos.ts`.
- **Respaldo `enDolares[0]`.** Ya no existe en `nuevo/gasto/page.tsx`: sin una cuenta propia en dólares, no se marca ninguna.
- **Tasa menor que 1.** `tasaMinima = aTasa("1")` en `gastos.ts`. Medido: vender a 0,4 se rechaza sin escribir.
- **Residuales de T3.** Un `sslmode` repetido ya da false, y la causa de un AggregateError se imprime (medido: `Causa: ECONNREFUSED · ::1 · 127.0.0.1`).
- **RLS en vivo.** `revisarEstadoBase` detecta tablas que faltan o sobran y vistas sin `security_invoker`. Medido sobre la imagen de Supabase: 10 de 10 ✓.
- **Antes de T14:**
  - 64af718: la venta ya no hereda la cuenta del último gasto;
  - 17bbedf: se rechazan las ventas que entregan 0 Bs;
  - b1c3fa1: la demo funciona sin flotantes (huella del autor 6819eb1d…, igual también en T14);
  - b8c1a07: `aCentavos` y `aTasa` leen el texto, no `Number()`;
  - bfd4636: la semilla no revive categorías;
  - T15 de 001: `for update` en categorías.

**Escrituras ajenas en la base real (resueltas):** las del revisor el 2026-10-12, ids 660 a 674, y `demo-comprobar-001-*` a las 21:58 UTC. Método para atribuirlas en [[entorno-de-prueba]].

**Why:** el dinero que no cuadra no se ve en pantalla. Sin esta lista, cada revisión empieza de cero y repite mediciones.

**How to apply:** en cada revisión, cruzar lo abierto con el código actual (grep y git log) antes de citarlo. Cuando algo se cierre, moverlo a "Cerrados" con la evidencia.

Ver también [[prima-en-cuadre]], [[categorias-icono-color]], [[rls-supabase]] y [[entorno-de-prueba]].
