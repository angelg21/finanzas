# 0005 · La interfaz vive en Next y el código en cuatro capas

Fecha: 2026-10-08. Estado: aceptada.

## Contexto

Durante la revisión de diseño se produjeron maquetas en HTML y CSS sueltos para comparar direcciones. Funcionaron para decidir, pero son código que no se reutiliza, no pasa por los gates y envejece aparte de la app. El usuario pide que todo el desarrollo de interfaz ocurra dentro del framework, con arquitectura limpia y orden.

## Decisión

Toda pantalla, pieza o alternativa visual se construye como componentes de React dentro de Next, con Tailwind y los tokens de `src/app/globals.css`. Para comparar opciones se crea una ruta de la app y se borra al decidir. Única excepción: el envoltorio HTML que genera `pnpm capturas` para simular el ancho de un celular, que es una herramienta, vive en `capturas/` y no se versiona.

El código se organiza en cuatro capas con dependencias en una sola dirección:

- `src/app/`: rutas, páginas de servidor que consultan y componen, server actions por ruta.
- `src/components/`: piezas visuales reutilizables que reciben datos por props.
- `src/db/`: esquema, conexión, consultas y operaciones.
- `src/lib/`: reglas del dominio y aritmética pura, con pruebas.

`app` puede importar de las otras tres; `components` y `db` solo de `lib`; `lib` de nada del proyecto. Los `import type` no cuentan como dependencia.

## Consecuencias

- `scripts/estructura.mjs` falla cuando un import cruza una frontera, y el hook de estructura se lo dice al agente en el momento de editar.
- Las consultas salen de las páginas y van a `src/db/consultas.ts`; la lógica sale de los componentes y va a `src/lib/`.
- Cuando la app crezca, cada capa puede subdividirse por concepto (sobres, cuentas, movimientos) sin cambiar las reglas.

## Alternativas descartadas

- Organizar por feature (una carpeta por funcionalidad con todo dentro): más cómodo al principio, pero mezcla acceso a datos con interfaz y dificulta probar la lógica sola.
- Permitir maquetas HTML "rápidas": ya se hizo y el costo fue rehacerlas en React.
