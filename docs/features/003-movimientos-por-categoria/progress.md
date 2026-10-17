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
- [x] T5 · (2026-10-14) `/movimientos` en móvil:
  - pestañas, periodo con flechas, anillo con leyenda filtrable, lista por día con su total, "200 de N" y los vacíos;
  - funciona sin JavaScript;
  - mirado con `pnpm capturas` en claro y oscuro (criterios 7 a 14).
- [x] T6 · (2026-10-14) Escritorio y pestaña Mover:
  - rejilla 5 + 7 con el anillo fijo;
  - Mover sin anillo, con origen → destino y el monto recibido si cambia de moneda;
  - capturas en los dos anchos y temas, comparadas con `docs/referencias/movimientos-referencia.jpg` (criterios 11 y 16).
- [x] T7 · (2026-10-14) Actualizar plan, diseño y observaciones:
  - `docs/diseno.md` con `Pestanas`, `FilaMovimiento`, `GraficaCategorias` y la nueva disposición de Movimientos en móvil y escritorio, y la referencia nueva en su tabla;
  - la observación 8: los iconos en movimientos y gráficas, hechos;
  - el plan: la gráfica por categoría, hecha.
- [x] T8 · (2026-10-14) Calendario para elegir un día, pedido por el desarrollador al validar (criterio 17):
  - `BotonCalendario` reutiliza el calendario de la captura de gasto, y sin JavaScript queda un campo de fecha con "Ver";
  - probado en Edge con CDP. Desde Gastos de septiembre, elegir el 12 lleva a `?periodo=dia&fecha=2026-09-12`, con "Día" marcado y el título "Sábado 12 de septiembre". Desde Ingresos, en la semana del 28 de septiembre, abre en octubre con 17 días futuros apagados, y elegir el 3 lleva a `?tipo=ingresos&periodo=dia&fecha=2026-10-03`.

## Validación en navegador

El desarrollador anota aquí, con fecha, qué pantallas miró y en qué ancho. Sin esta nota no se pasa a `/f-verify`.

- 2026-10-14: el desarrollador revisó `/movimientos` en el navegador ("ok perfecto") y pidió el calendario (T8); después lo dio por bueno.

## Etapas

- [x] Spec leída y aprobada por el desarrollador, sin cambios (2026-10-14)
- [x] Construida (todas las tareas con commit, 2026-10-14)
- [x] Validada en navegador (2026-10-14)
- [x] Verificada: `pnpm verify` en verde, cada ★ con su prueba (2026-10-17, después de fusionar)
- [x] Revisada: veredicto APTO PARA FUSIONAR (2026-10-17, segunda vuelta, después de fusionar)
- [x] Fusionada en `main` el 2026-10-14, por decisión del desarrollador sin verificar ni revisar (ver notas)

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
- T5 y T6 salieron juntas: son la misma página. Mirado con `pnpm capturas` en escritorio y celular, claro y oscuro:
  - Gastos de septiembre de 2026: anillo de 522,50 USD con 8 categorías, porcentajes de 35 a 2;
  - Comida filtrada, con las demás porciones atenuadas;
  - Ingresos del año, con la flecha siguiente apagada;
  - Mover, con "Binance → Bolívares … recibe 1.182,50 Bs" y "Por asignar → Emergencia".

  La fila del gasto en bolívares muestra "1.182,50 Bs · 236,50 Bs/USD".

- **Fusión directa (2026-10-14).** El desarrollador pidió fusionar sin `/f-verify` ni `/f-review` para seguir con la siguiente feature: "no es algo tan complicado". Quedan pendientes las pruebas de los ★ que no son funciones puras (cada pestaña con su tipo y bolívares contra la base, y la lista larga) y la revisión del `revisor`.
- Verificación (2026-10-17), sobre `main` y contra el código de hoy (con la 004 y la 005 ya fusionadas). Los 7 ★ (1 a 7) tienen su prueba, escrita desde el texto del criterio. Son 38 pruebas puras nuevas y dos guiones nuevos, todo en verde a la primera salvo un fallo de la propia comprobación (ver abajo).
  - ★ 1 y 2: `src/lib/distribucion.criterios.test.ts`, con 5 pruebas en "★ 1 · totales exactos" y 8 en "★ 2 · porcentajes que suman 100". Incluyen el ejemplo de la referencia (42 · 30 · 28), 33,5 · 33,5 · 33 que por redondeo daría 101, "<1 %" según el entero que queda, el total cero y 1.000 repartos al azar.
  - ★ 5 y 6: `src/lib/periodos.criterios.test.ts`, con 10 pruebas en "★ 5 · bordes del periodo" y 15 en "★ 6 · parámetros manipulados".
    - ★ 5: el 31 de octubre de 2026 en octubre y en la semana del 26 al 1, y nunca en noviembre; cada día de 2023 a 2027 en un solo periodo de cada tipo, sin huecos.
    - ★ 6: fechas irreales y futuras, "no futura" con el día de Caracas, ids que no caben en un integer, y 3.000 combinaciones de basura que nunca lanzan y siempre dan filtros válidos.
  - Contra la base, `scripts/comprobar-003.ts` (nuevo), con fechas de 2023 a enero de 2026 que la demo no usa:
    - ★ 1 y 3 con la demo: en 8 periodos (un día, la semana que cruza septiembre y octubre, junio a octubre y el año 2026), cada anillo igual que un `select` a mano categoría por categoría, y cada pestaña con solo su tipo.
    - ★ 1, 3 y 4 con marzo de 2025 armado: la transferencia y la reasignación llevan categoría, porque el check de forma lo permite, y aun así no suman (Comida queda en 128,33, Sueldo remoto en 1.200,00). El gasto de 1.182,50 Bs suma 5,00 USD al anillo y a su día, y `FilaMovimiento` muestra "−5,00 USD" y "1.182,50 Bs · 236,50 Bs/USD".
    - ★ 5: 17 gastos en los bordes, con montos que son potencias de 2 para saber cuáles se contaron, en 14 periodos. El del 31 de octubre de 2025, guardado a las 02:30 UTC del 1 de noviembre, sale en octubre y nunca en noviembre.
    - ★ 7: con 250 en junio de 2025, la lista trae los 200 más recientes en orden. El resumen cuenta 250, el anillo los 561,25 USD de todos, y cada día da su total exacto, también los que la lista deja fuera. Con 200 justos en julio, no hay corte.
  - Con `--url`, `scripts/comprobar-003-paginas.ts` (nuevo) mira las páginas del servidor de desarrollo con la sesión del usuario de prueba y esos mismos datos:
    - el centro de marzo dice 309,76, cada categoría su suma, y la leyenda "41, 29, 28, 2, <1" suma 100 (★ 1 y 2);
    - cada pestaña muestra solo las filas de su tipo, y Mover va sin anillo (★ 3);
    - la fila en Bs (★ 4);
    - "200 de 250" con 200 filas, y ningún "de 200" en julio (★ 7);
    - 21 direcciones manipuladas responden 200 y muestran lo mismo que `/movimientos`: "Gastos · Mes | Octubre de 2026 | Todas · 142,00 USD". Entre ellas, una categoría de ingreso en Gastos y la de Comida en Ingresos, que no filtran (★ 6).
  - Que ningún parámetro llega a una consulta sin pasar por una función pura (★ 6) se comprobó leyendo `page.tsx`: `searchParams` solo entra por `leerFiltros`, y la categoría llega a la lista y al resumen como el id que devolvió `totalesPorCategoria`.
  - Una lectura del ★ 6, la del código y la de `periodos.test.ts`: cada parámetro inválido cae en su propio valor por defecto ("Gastos" el tipo, "mes" el periodo, hoy la fecha, sin filtro la categoría) y no arrastra a los válidos. `?tipo=ingresos&fecha=2026-02-30` da Ingresos del mes actual, no Gastos. Con todos inválidos, Gastos del mes actual sin filtro.
  - Que las pruebas no pasan en vacío: con tres defectos puestos a mano (la semana empieza el domingo, cada porcentaje redondeado por su cuenta, fechas futuras aceptadas), fallan 11 de las 38. El código se restauró, sin diferencias.
  - El único fallo de la corrida fue de la propia comprobación: buscaba `role="img"` para decir que Mover va sin anillo, y el emblema de la app también lo lleva. Ahora se reconoce el anillo por su etiqueta "… por categoría", y se comprueba que sí está en Gastos e Ingresos.
  - **Sin decidir, sin arreglar:** una categoría del tipo de la pestaña pero sin movimientos en el periodo no filtra, y la lista cae en "Todas" sin aviso. Pasa al mover las flechas con un filtro puesto, porque `categoria` se conserva: Tecnología en julio de 2026 da "Tecnología · 180,00 USD", y en octubre "Todas · 142,00 USD". Por eso la rama "No hay gastos de <categoría> …" de `page.tsx` nunca se alcanza. No es un ★, el ★ 6 trata lo inválido y el 8 no dice qué pasa en un periodo sin esa categoría. Queda para el desarrollador o para `/f-review`.
  - `pnpm exec tsx scripts/comprobar-003.ts --url http://localhost:3000`: 57 ✓, ninguna ✗, y `✓ comprobar-003: todo en verde`. La base queda en 121 movimientos, con los mismos saldos. Sin `--url`, las 49 de la base, también en verde.
  - Gates de `pnpm verify`:
    - `✓ tipos (2.6 s)`
    - `✓ lint (8.8 s)`
    - `✓ formato (4.0 s)`
    - `✓ estructura (0.1 s)`
    - `✓ unitarias (3.5 s)`: 44 archivos y 763 pruebas.
    - `✓ build (9.0 s)`
    - `✓ humo (4.2 s)`
    - `✓ verify:full en verde en 32.3 s. Árbol sellado.`
- Revisión (2026-10-17), primera vuelta: `revisor`, **NO APTO**, con `pnpm verify --forzar` en verde y sin defectos de dinero ni de datos. Hallazgos:
  1. **Bloqueante, ★ 6 y criterio 8.** La categoría se validaba contra las que tenían movimientos en el periodo, no contra "un id de categoría entero positivo del tipo de la pestaña". Al navegar a un periodo sin esa categoría se caía a "Todas" sin aviso, y las flechas, las píldoras y el calendario perdían el filtro. "No hay gastos de {categoría}…" nunca se veía. La prueba de página solo usaba Comida en octubre.
  2. **Media.** El escritorio desbordaba entre 1024 y 1093 px (`scrollWidth` 1093 a 1024): la flecha siguiente quedaba fuera y la leyenda partía "70 %".
  3. **Baja, criterio 14.** El `aria-label` del botón del calendario tapaba el periodo visible: el lector de pantalla nunca lo anunciaba (WCAG 2.5.3).
  4. **Baja.** Un nombre de más de unos 23 caracteres se salía del centro del anillo.
  5. **Muy baja.** Con la URL manipulada, los años 0100 a 0999 daban "100-06-01" en `rangoDePeriodo` y `moverPeriodo`, que `esFecha` rechaza.
  6. **Proceso.** La validación en navegador no dijo en qué anchos se miró.
- Arreglos (2026-10-17), con las pruebas primero y vistas fallar:
  - **1:** `categoriaDeLaPestana` en `src/db/movimientos-del-periodo.ts` valida por el tipo, tenga o no movimientos; la página muestra "Comida · 0,00 USD" y "No hay gastos de Comida en enero de 2020.", y el filtro viaja en flechas, píldoras y calendario. Prueba nueva en `comprobar-003-paginas.ts`, que falló antes del arreglo con los enlaces sin `categoria=` y pasa después.
  - **2:** los tres controles van en fila desde 1280 px (`xl:`); entre 1024 y 1279 se apilan. El porcentaje de la leyenda va en un `span` que no se parte.
  - **3:** sin `aria-label`; el nombre es "Septiembre de 2026, elegir un día en el calendario", con lo que se ve primero.
  - **4:** el nombre del centro se corta con "…" pasados 20 caracteres. El nombre completo sigue en la leyenda y en la porción.
  - **5:** el año con cuatro cifras (`cuatroCifras`), con pruebas en `periodos.test.ts` que fallaron antes (2 de 2).
  - **6:** medido por el agente en Edge sin ventana: `scrollWidth ≤ clientWidth` a 1024, 1050, 1093, 1180, 1280, 1440 y 390 px en Gastos por semana, Mover y Gastos por mes; el nombre accesible empieza por "Septiembre de 2026"; ningún porcentaje se parte a 1024.
  - `pnpm exec tsx scripts/comprobar-003.ts --url http://localhost:3000`: `✓ comprobar-003: todo en verde` (59 ✓).
- Revisión (2026-10-17), segunda vuelta: `revisor`, **APTO PARA FUSIONAR** sobre `e980fbb`. Comprobó los cinco arreglos en Edge y por fetch, a 320, 360, 390, 1024, 1100, 1279, 1280, 1300, 1366 y 1440 px. Corrió `verify:full` en verde en un `git worktree` limpio (765 pruebas, build y humo), porque el árbol tenía archivos a medias de la verificación de la 002. Hallazgos que no bloqueaban, cerrados el mismo día:
  1. La firma de `comprobar-003-paginas.ts` buscaba el periodo por el `aria-label` que quitó `94e3f24`: comparaba "?" con "?". Ahora lo lee del botón del calendario, y la comprobación falla si no lo encuentra. Corrida: `✓ 6 · 21 direcciones manipuladas … (Gastos · Mes | Octubre de 2026 | Todas · 142,00USD)` y `✓ comprobar-003: todo en verde` (59 ✓).
  2. Con filtro, la página hace cuatro consultas: el criterio 16 de la spec y los comentarios lo dicen ahora.
  3. Los controles en fila solo desde 1280 px: la spec ("Escritorio") y `docs/diseno.md` lo dicen ahora.
  4. Una categoría filtrada sin movimientos en el periodo ya no atenúa todo el anillo. Medido en Edge: con Tecnología en octubre, 0 de 2 porciones atenuadas; con Comida, 1 de 2.
