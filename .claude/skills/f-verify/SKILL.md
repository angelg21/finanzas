---
name: f-verify
description: Etapa 3 del pipeline. Deriva de la spec una prueba por criterio ★, corre el gate completo y deja la evidencia. También es el único paso que recorre un cambio directo de una frase. Úsalo tras validar pantallas en navegador.
argument-hint: [NNN]
---

Verificar la feature **$ARGUMENTS** (o el cambio directo, si no se indica número).

## Con feature

1. Lee `docs/features/$ARGUMENTS-*/spec.md`. Comprueba en `progress.md` que "Validada en navegador" tenga fecha; si no, páralo y pídela.
2. Para cada criterio marcado ★, escribe una prueba **leyendo solo el texto del criterio**, no el código. Lee el código después, para saber qué función llamar. Ubica cada prueba junto a la función pura que la cumple en `src/lib/`; si el criterio solo se puede comprobar contra la base, escribe un script de comprobación en `scripts/` que lo ejecute con los datos de demostración y deja su salida en `progress.md`.
3. Corre `pnpm verify` completo (necesita la base arriba: `pnpm db:up`). Si algo falla, arregla la causa. Nunca cambies, debilites ni omitas una prueba para pasar.
4. Anota en `progress.md`, bajo "Etapas", la fecha de verificación y pega en "Notas" la última línea de cada gate en verde. Marca "Verificada". Commit: `test(NNN): pruebas de los criterios ★`.

## Cambio directo, sin feature

Un cambio cuyo diff cabe en una frase: corre `pnpm verify:fast`, y `pnpm verify` si tocó rutas o datos. Commit con el tipo que corresponda (`fix:`, `chore:`, `docs:`). Nada más.

## Cierre

Resume en tres líneas: cuántos ★ hay y cuántas pruebas los cubren, resultado de los gates, y el siguiente paso. Recuerda el `/clear` antes de `/f-review $ARGUMENTS`.
