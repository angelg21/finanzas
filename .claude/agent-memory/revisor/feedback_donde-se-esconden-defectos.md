---
name: donde-se-esconden-defectos
description: Patrón del autor en finanzas - ★ muy bien probados en lib y en scripts/comprobar-NNN; los defectos quedan en valores por defecto y en estado del cliente que se pierde tras una vuelta al servidor
metadata:
  type: feedback
---

El autor prueba los criterios ★ a fondo (funciones puras, un script contra la base con `--url`, humo) y corrige cada hallazgo con su commit y la reproducción repetida. Lo que se le escapa vive fuera de los ★, en el estado de la pantalla:

- 001, vuelta 1 (2026-10-12): la venta heredaba la cuenta del último gasto manual en vez de Binance. Valor por defecto.
- 001, vuelta 2 (2026-10-12): el formulario se vuelve a montar con `key={ronda}` tras cada respuesta del servidor (error o confirmación de Inversión). Todo `useState` que no viaja en `valores` se pierde; ahí se perdía `sobreTocado`. Al elegir la categoría después del error, el sobre elegido a mano se reemplazaba por el sugerido y el gasto se guardaba en otro sobre. Sin editar ni reasignar en la app, el error no tenía arreglo.

**Why:** la demo es toda `origen = importado`, así que la lógica que depende de historial `manual` no se ve. La validación en navegador sigue el camino feliz y no pasa por un error de validación antes de cambiar algo.

**How to apply:**

- Registra un movimiento manual por la acción sin JS y recarga antes de mirar los valores por defecto.
- Recorre la sección "Pantallas" frase por frase contra el código, sobre todo los "por defecto".
- En cada formulario con `key={ronda}`, busca el `useState` que no viene de `valores` y ejercítalo con JS: elegir a mano, provocar un error (olvidar la categoría es el más probable), y luego cambiar lo que dispara la sugerencia.
- Una fila que queda en una cuenta o un sobre que el usuario no eligió afecta datos: NO APTO, más aún si la app todavía no permite editar ni reasignar.

Ver [[entorno-revision-finanzas]].
