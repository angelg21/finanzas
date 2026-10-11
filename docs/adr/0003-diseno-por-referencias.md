# 0003 · El diseño se deriva de referencias visuales elegidas por el usuario

Fecha: 2026-10-03, ampliada 2026-10-07. Estado: aceptada.

## Contexto

Dos sistemas visuales propuestos a partir de descripciones verbales fueron rechazados por completo. El usuario trajo luego dos capturas: una fijó la estructura y otra los colores.

## Decisión

Ninguna pantalla se diseña desde palabras. La estructura sigue `docs/referencias/ui-referencia.png` y la paleta `docs/referencias/ui-referencia-2-colores.webp`, traducidas a tokens en `src/app/globals.css` y a piezas en `src/components/ui.tsx`, documentadas en `docs/diseno.md`. Toda pantalla nueva se compara contra las referencias antes de darse por hecha. Para dudas de dirección, se muestran alternativas en HTML local dentro del repo, nunca publicadas.

## Consecuencias

- Prohibido `dark:` y colores sueltos en componentes; los temas se resuelven en tokens. Un hook lo vigila.
- Las gráficas usan la paleta del proyecto validada con el método de visualización donde no choca con la referencia; la desviación consciente queda escrita en `docs/diseno.md`.
- Cambiar de dirección visual exige una captura nueva y una revisión de este ADR.

## Alternativas descartadas

- Librerías de componentes con su estética por defecto: el usuario quiere algo propio; se usan primitivos sin estilo solo si la accesibilidad lo exige.
