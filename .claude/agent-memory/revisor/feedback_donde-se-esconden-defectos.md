---
name: donde-se-esconden-defectos
description: Patrón del autor en finanzas - ★ muy bien probados en lib y en scripts/comprobar-NNN; los defectos quedan en valores por defecto (también "hoy"), en estado del cliente que se pierde tras una vuelta al servidor y en lo que "tocar" significa para un radio
metadata:
  type: feedback
---

El autor prueba los criterios ★ a fondo (funciones puras, un script contra la base con `--url`, humo) y corrige cada hallazgo con su commit y la reproducción repetida. Lo que se le escapa vive fuera de los ★, en el estado de la pantalla:

- 001, vuelta 1 (2026-10-12): la venta heredaba la cuenta del último gasto manual en vez de Binance. Valor por defecto.
- 001, vuelta 2 (2026-10-12): el formulario se vuelve a montar con `key={ronda}` tras cada respuesta del servidor (error o confirmación de Inversión). Todo `useState` que no viaja en `valores` se pierde; ahí se perdía `sobreTocado`. Al elegir la categoría después del error, el sobre elegido a mano se reemplazaba por el sugerido y el gasto se guardaba en otro sobre. Sin editar ni reasignar en la app, el error no tenía arreglo.
- 001, vuelta 3 (2026-10-12): "hoy" solo se calcula al renderizar en el servidor; el cliente nunca lo recalcula. Una pantalla abierta que cruza la medianoche de Caracas (o "Registrar otro" a la mañana siguiente, que reusa los datos de la última acción) guarda el gasto con la fecha de ayer mientras la píldora dice "Hoy". También: el sobre solo cuenta como tocado con `onChange`, así que tocar el sobre ya marcado no lo fija.

**Why:** la demo es toda `origen = importado`, así que la lógica que depende de historial `manual` no se ve. La validación en navegador sigue el camino feliz, en un solo momento, y no pasa por un error de validación ni por el paso del tiempo antes de guardar.

**How to apply:**

- Registra un movimiento manual por la acción sin JS y recarga antes de mirar los valores por defecto.
- Recorre la sección "Pantallas" frase por frase contra el código, sobre todo los "por defecto". "Hoy" también es un valor por defecto: busca dónde se calcula y si el cliente lo refresca.
- En cada formulario con `key={ronda}`, busca el `useState` que no viene de `valores` y ejercítalo con JS: elegir a mano, provocar un error (olvidar la categoría es el más probable), y luego cambiar lo que dispara la sugerencia.
- Para "tocado": prueba tocar la opción que ya está marcada; un radio no emite `change`.
- Una fila que queda en una cuenta, un sobre o una fecha que el usuario no eligió afecta datos: NO APTO, más aún si la app todavía no permite editar ni reasignar.

Ver [[entorno-revision-finanzas]].
