# 010 · Editar un gasto por completar, y llegar siempre a la lista

Fecha: 2026-10-22. Estado: aprobada (el desarrollador lo pidió "ya mismo", mientras se revisaban la 006 a la 009).

## Para qué

Al anotar los gastos del fin de semana sin monto (spec 009), el desarrollador se equivocó en dos fechas y no las pudo corregir: un pendiente solo se completa o se descarta. Y después de anotarlos y salir a otra pantalla no encontró por dónde volver a la lista: el aviso "N gastos por completar" sale en el inicio y en `/nuevo`, pero Registrar abre directo la captura de gasto y `/nuevo` no está en el menú.

## Trazabilidad al plan

Fase 1, "Gastos por completar" (feature 009). Decisiones tomadas por el agente sin preguntar, por la urgencia; se pueden corregir después:

- se edita con el mismo formulario de anotar, y cambia lo mismo que se anota: categoría, descripción, fecha, monto y moneda;
- la lista entra al menú como "Por completar", junto a Categorías, y la captura de gasto suma "Ver por completar" al lado de "Anotar sin monto";
- de paso, el botón "Mover" del inicio va directo a `/nuevo/mover` y no a la pantalla de Registrar.

## Criterios de aceptación

1. ★ En `/por-completar`, cada pendiente tiene "Editar", que abre `/por-completar/[id]` con el formulario de anotar lleno con lo anotado. "Guardar cambios" lo actualiza con las mismas reglas que al anotar (categoría de gasto, fecha de hoy o anterior, monto opcional con su moneda) y vuelve a la lista con "Cambios guardados". No mueve dinero.
2. ★ Si el pendiente ya no existe (se completó o se descartó en otra pestaña), no se guarda nada y vuelve a la lista con "Ese gasto ya se completó o se descartó". Una dirección con un id que no existe responde 404.
3. Si su categoría se archivó después de anotarlo, sale entre las opciones y se puede dejar.
4. La lista se alcanza siempre: "Por completar" en el menú, en el celular y en escritorio, y "Ver por completar" en la captura de gasto, sin ninguna consulta nueva en la captura.
5. ★ La acción empieza con la sesión y pasa por `conFallas`: sin red, con la sesión vencida o con una versión vieja, el mensaje junto al botón y lo escrito sigue ahí.
6. El "+" flotante no sale en la edición, como en las demás pantallas que son un formulario.

## Pantallas

- `/por-completar`: "Editar" junto a "Completar" y "Descartar".
- `/por-completar/[id]`: título "Editar por completar", vuelta a "Por completar", el formulario de anotar con "Guardar cambios".
- Menú: "Por completar", con el icono de la lista.

## Datos

Sin migración. `gastos_por_completar` se actualiza por su id, campo por campo (fecha, categoría, nota, monto y moneda), nunca la referencia ni la fecha de creación. El check de monto y moneda de la 0008 vale igual.

## Fuera de alcance

- Editar varios a la vez.
- Mover un pendiente a otra fecha arrastrándolo.
