---
name: donde-se-esconden-defectos
description: Patrón del autor en finanzas - ★ muy bien probados en lib y en scripts/comprobar-NNN; los defectos quedan en valores por defecto y estado de pantalla que la demo no ejercita
metadata:
  type: feedback
---

El autor prueba los criterios ★ a fondo (funciones puras, un script contra la base con `--url`, humo). Lo que se le escapa vive fuera de los ★: valores por defecto y estado compartido de la pantalla que la sección "Pantallas" de la spec fija. Hallazgo de 001 (2026-10-12): la forma "Bolívares vendiendo USDT" heredaba la cuenta del último gasto manual en dólares en vez de Binance, y la confirmación no mostraba de qué cuenta salió la venta.

**Why:** los datos de demostración son todos `origen = importado`, así que cualquier lógica que dependa de historial `manual` (cuenta por defecto, "último usado") nunca se ve en la validación en navegador ni en las capturas.

**How to apply:** en cada revisión, antes de mirar los valores por defecto, registra un movimiento manual por la acción (sin JS) y vuelve a cargar la pantalla. Recorre la sección "Pantallas" frase por frase contra el código, sobre todo los "por defecto". Un defecto que deja la fila en la cuenta equivocada sin avisar cuenta como "afecta datos": NO APTO. Ver [[entorno-revision-finanzas]].
