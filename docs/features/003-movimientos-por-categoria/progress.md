# 003 · Progreso

Rama: `feat/003-movimientos-por-categoria`. Spec: `spec.md`.

## Tareas

Cada tarea cabe en 30 a 60 minutos y termina en verde con un commit. Se marca con la fecha al cerrarla.

- [x] T1 · (2026-10-14) `src/lib/periodos.ts` con sus pruebas, viéndolas fallar primero:
  - `rangoDePeriodo`, `moverPeriodo`, `esPeriodoActual`, `etiquetaPeriodo` y `leerFiltros`;
  - semanas que cruzan mes y año, febrero bisiesto, 31 de enero más un mes, y parámetros inválidos que caen en Gastos del mes actual (criterios 5, 6 y 9).
- [x] T2 · (2026-10-14) `src/lib/distribucion.ts` con sus pruebas, viéndolas fallar primero: `distribuirPorCategoria`, con orden de mayor a menor, total exacto en centavos, mayor residuo que suma 100, "<1 %" y total cero (criterios 1 y 2).
- [x] T3 · (2026-10-14) `src/db/movimientos-del-periodo.ts`:
  - `totalesPorCategoria`, `movimientosDelPeriodo` y `resumenPorDia` (en lugar del conteo: da también el total exacto de cada día);
  - el icono y el color de la categoría en `baseMovimientos`;
  - revisión de `guardian-datos`;
  - comprobado contra la base local con `pnpm db:demo`: la suma por categoría de octubre coincide con un `select` a mano.
- [x] T4 · (2026-10-14) Piezas:
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

- [x] Spec leída y aprobada por el desarrollador, sin cambios (2026-10-14)
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
- T2: con los montos de la referencia (125, 91,12 y 85,30), la otra app muestra 41 %, 30 % y 28 %, que suman 99. Aquí da 42, 30 y 28: el punto que falta va al residuo mayor (criterio 2).
- T3: comprobado contra la base local con los datos demo. En octubre, septiembre y agosto de 2026, el total del anillo, la suma por día y la cantidad coinciden con SQL a mano en gastos e ingresos; Mover trae solo transferencias y reasignaciones; el filtro por categoría suma igual que el total de esa categoría.
- T3: `guardian-datos` dio **APTO**.
  - Midió sobre una copia con filas de borde y 450 de lista larga: totales centavo por centavo, sin transferencias ni reasignaciones, Bs en su USD, bordes inclusivos, 200 de N con la suma de los días igual al anillo, todo con parámetros y sobre `movimientos_fecha_idx`. Inicio y `/sobres/[id]` reciben las mismas filas.
  - Notas informativas:
    - los empates entre categorías no tenían orden fijo, y se agregó el `orderBy` por monto e id;
    - una suma de más de 2^53 centavos daría error en vez de perderse;
    - el total por día de Mover mezcla tipos, y la pantalla no lo muestra;
    - las tres consultas no comparten una lectura común, algo aceptado con un solo usuario.
- T4:
  - `Pestanas` quedó en `src/components/pestanas.tsx` y no en `ui.tsx`, que ya tenía 300 líneas.
  - `sector` redondea a milésimas: `Math.cos` y `Math.sin` daban distinto en los últimos decimales entre Node y Edge, y el anillo no hidrataba igual (aviso de React en el registro del servidor). Vale también para `GraficaDona`. Después del cambio, sin avisos nuevos.
