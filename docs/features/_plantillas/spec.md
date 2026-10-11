# NNN · Título corto

Fecha: AAAA-MM-DD. Estado: borrador | aprobada | construida | verificada | revisada | fusionada.

## Para qué

Dos o tres frases: qué problema del usuario resuelve y por qué ahora.

## Trazabilidad al plan

Sección y fase de `docs/plan-financiero-y-app.md` que cubre. Si cambia algo del plan, decirlo aquí y actualizar el plan en la misma feature.

## Criterios de aceptación

Marcar con ★ los críticos: lo que toca dinero, el invariante, datos del usuario o lo que en producción sería imperdonable. Cada ★ tendrá una prueba derivada de este texto.

1. ★ Dado … cuando … entonces …
2. Dado … cuando … entonces …

## Pantallas

Qué se ve, en móvil y en escritorio. Referir piezas de `docs/diseno.md` por nombre. Cualquier pieza nueva se describe aquí antes de crearla.

## Datos

Tablas o columnas nuevas, migración, cambios en semillas y en datos de demostración. Qué pasa con los datos existentes.

## Fuera de alcance

Lo que se parece pero no entra, para no discutirlo a mitad de camino.

## Pruebas antes del código

Solo lo invisible en pantalla: aritmética de dinero, reglas de reparto, invariante, importador. Lista de funciones puras que tendrán `.test.ts`.

## Riesgos y decisiones

Lo que podría salir mal y qué se decidió. Si una decisión es de arquitectura, va a `docs/adr/` con `/f-adr`.
