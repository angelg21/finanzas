# 003 · Progreso

Rama: `feat/003-movimientos-por-categoria`. Spec: `spec.md`.

## Tareas

Cada tarea cabe en 30 a 60 minutos y termina en verde con un commit. Se marca con la fecha al cerrarla.

- [ ] T1 · `src/lib/periodos.ts` con sus pruebas, viéndolas fallar primero:
  - `rangoDePeriodo`, `moverPeriodo`, `esPeriodoActual`, `etiquetaPeriodo` y `leerFiltros`;
  - semanas que cruzan mes y año, febrero bisiesto, 31 de enero más un mes, y parámetros inválidos que caen en Gastos del mes actual (criterios 5, 6 y 9).
- [ ] T2 · `src/lib/distribucion.ts` con sus pruebas, viéndolas fallar primero: `distribuirPorCategoria`, con orden de mayor a menor, total exacto en centavos, mayor residuo que suma 100, "<1 %" y total cero (criterios 1 y 2).
- [ ] T3 · `src/db/movimientos-del-periodo.ts`:
  - `totalesPorCategoria`, `movimientosDelPeriodo` y `contarMovimientosDelPeriodo`;
  - el icono y el color de la categoría en `baseMovimientos`;
  - revisión de `guardian-datos`;
  - comprobado contra la base local con `pnpm db:demo`: la suma por categoría de octubre coincide con un `select` a mano.
- [ ] T4 · Piezas:
  - `Pestanas` en `ui.tsx`, y `/categorias` pasa a usarla sin cambio visible;
  - `FilaMovimiento` en `movimiento.tsx`, para gasto, ingreso, transferencia y reasignación;
  - `GraficaCategorias`, que importa `sector` de `grafica-dona.tsx`.
- [ ] T5 · `/movimientos` en móvil:
  - pestañas, periodo con flechas, anillo con leyenda filtrable, lista por día con su total, "200 de N" y los vacíos;
  - funciona sin JavaScript;
  - mirado con `pnpm capturas` en claro y oscuro (criterios 7 a 14).
- [ ] T6 · Escritorio y pestaña Mover:
  - rejilla 5 + 7 con el anillo fijo;
  - Mover sin anillo, con origen → destino y el monto recibido si cambia de moneda;
  - capturas en los dos anchos y temas, comparadas con `docs/referencias/movimientos-referencia.jpg` (criterios 11 y 16).
- [ ] T7 · Actualizar plan, diseño y observaciones:
  - `docs/diseno.md` con `Pestanas`, `FilaMovimiento`, `GraficaCategorias` y la nueva disposición de Movimientos en móvil y escritorio, y la referencia nueva en su tabla;
  - la observación 8: los iconos en movimientos y gráficas, hechos;
  - el plan: la gráfica por categoría, hecha.

## Validación en navegador

El desarrollador anota aquí, con fecha, qué pantallas miró y en qué ancho. Sin esta nota no se pasa a `/f-verify`.

-

## Etapas

- [ ] Spec leída y corregida por el desarrollador
- [ ] Construida (todas las tareas con commit)
- [ ] Validada en navegador
- [ ] Verificada: `pnpm verify` en verde, cada ★ con su prueba
- [ ] Revisada: veredicto APTO PARA FUSIONAR
- [ ] Fusionada en `main` el AAAA-MM-DD

## Notas

- Decisiones del desarrollador al especificar (2026-10-14):
  - periodos Día, Semana, Mes y Año, sin el rango libre;
  - las transferencias y los repartos van en una tercera pestaña, Mover;
  - debajo del anillo, los movimientos uno por uno, con un filtro por categoría desde la leyenda.
- La 002 queda con pendientes sobre `main`:
  - el fallo sin conexión en el iPhone y el scroll horizontal, en investigación;
  - el primer respaldo;
  - T17;
  - `/f-verify` y `/f-review`.
