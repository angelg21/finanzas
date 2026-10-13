# Cómo se construye esta app

Método de trabajo con agente, adaptado de un proyecto profesional a uno personal: un solo desarrollador, sin apuro, sin miles de usuarios. Lo que importa aquí no es la velocidad ni la cobertura, sino que la app cumpla su propósito: ayudar a organizar el dinero, empezar a invertir y aprovechar estos años. Este documento es el fundamento largo; el resumen operativo está en `CLAUDE.md`.

## La premisa

Con un agente, escribir código dejó de ser el cuello de botella. **El cuello de botella es verificar.** Por eso el esfuerzo se gasta en tres cosas:

1. Definir bien qué se va a construir, en un archivo, antes de la primera línea de código.
2. Darle al agente una forma determinista de comprobar su propio trabajo: gates y hooks.
3. Que alguien distinto al autor revise lo que se va a fusionar: un subagente revisor en contexto limpio, y el propio autor repasando el diff.

## El pipeline: cinco etapas, cada una un skill del repo

```
/f-spec  →  /f-build  →  /f-verify  →  /f-review  →  /f-ship
                                                     + /f-audit al cerrar cada fase del plan
```

| #   | Etapa                                 | Produce                                                                                                                                                                                                              | No se pasa hasta que…                                                                           |
| --- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1   | **Especificar** `/f-spec <idea>`      | `docs/features/NNN-slug/spec.md` (criterios de aceptación, los críticos marcados ★, pantallas con referencia a `docs/diseno.md`, datos y migraciones) + `progress.md` (tareas de 30 a 60 min) + rama `feat/NNN-slug` | el desarrollador leyó y corrigió la spec                                                        |
| 2   | **Construir y mirar** `/f-build NNN`  | código y un commit por tarea; antes del código solo las pruebas de lo invisible (ver abajo)                                                                                                                          | el desarrollador validó las pantallas **en el navegador** y lo anotó con fecha en `progress.md` |
| 3   | **Probar lo crítico** `/f-verify NNN` | una prueba por criterio ★, derivada de la spec y no del código; `pnpm verify` en verde                                                                                                                               | todos los gates en verde, cada ★ con su prueba                                                  |
| 4   | **Revisar** `/f-review NNN`           | informe del subagente `revisor`, adversarial y en contexto limpio                                                                                                                                                    | veredicto APTO PARA FUSIONAR                                                                    |
| 5   | **Fusionar** `/f-ship NNN`            | historial limpio, rama fusionada en `main` y `main` publicada en el remoto privado; sin pull request                                                                                                                 | `pnpm verify` en verde aquí y ahora, y el autor repasó su diff línea por línea                  |

**Etapa condicional:** `/f-audit <fase>` al cerrar cada fase del plan (la 1 trae el despliegue y la autenticación, la 2 el chat con IA y las notificaciones push, y la 3 la clave de Binance). El revisor busca defectos; el auditor busca vías de ataque. No es el mismo trabajo.

**Reglas de uso**

- Si se pide "implementa X" sin spec, el agente **no codifica**: responde con el estado del pipeline (`/f-status`) y ofrece arrancar en la etapa que toca.
- **Entre etapa y etapa, `/clear`.** Lo importante quedó en un archivo, no en la conversación. Una sesión, una feature.
- **Excepción única:** un cambio cuyo diff cabe en una frase (un texto, un color del token, un rename) se hace directo y pasa solo por `/f-verify`. La ceremonia inútil es la forma más rápida de que un proceso se abandone.
- Comandos de apoyo: `/f-status` (estado del pipeline), `/f-adr` (decisión de arquitectura versionada en `docs/adr/`).

## Dónde se prueba antes y dónde después

La app no tiene una complejidad técnica grande y la va a usar una persona. Probar en exceso sería gastar el tiempo donde no está el riesgo. Por eso:

- **Prueba antes del código, y viéndola fallar primero, solo lo que el navegador no puede ver y en producción sería imperdonable**: aritmética de dinero en centavos, reglas de reparto de un ingreso, el invariante "suma de sobres igual a suma de cuentas", y el importador del historial de Gestor de Gastos cuando exista. Son funciones puras en `src/lib/` con su `.test.ts` al lado.
- **Lo demás se prueba después de mirar**, en `/f-verify`, con una prueba por criterio ★ de la spec. El revisor comprueba que cada prueba se derivó del criterio y no del código.
- **No hay pruebas de navegador automatizadas por ahora.** Las sustituyen dos cosas: el desarrollador mira cada pantalla antes de dar la tarea por hecha, y `pnpm capturas` genera capturas de escritorio y celular en ambos temas para revisarlas sin abrir el navegador. El gate completo incluye una prueba de humo que levanta el build y comprueba que cada ruta responde.
- **Nunca** se modifica, debilita, marca como omitida ni borra una prueba para que el código pase. Si una prueba estorba, el error está en el código o en la spec. Un hook avisa al editar archivos de prueba.

## Los tres niveles de control

**1. El arnés, determinista.** Vive en `.claude/settings.json` y `.claude/hooks/`, versionado:

| Hook                                         | Qué hace                                                                                                                                                                          |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SessionStart`                               | briefing idéntico en cada sesión: rama, feature activa, tareas hechas y siguiente, estado del sello                                                                               |
| `PreToolUse` en Edit y Write → `guardia`     | niega escribir secretos o archivos `.env`; escala a humano la edición de una migración ya generada en `drizzle/`                                                                  |
| `PostToolUse` en Edit y Write → `formato`    | pasa Prettier al archivo; el estilo no gasta contexto ni ensucia diffs                                                                                                            |
| `PostToolUse` en Edit y Write → `estructura` | devuelve al agente los hallazgos de `scripts/estructura.mjs` sobre el archivo: `dark:`, colores sueltos, dinero en flotante, `any`, `catch` vacío, tamaño                         |
| `Stop` → `gate`                              | **el turno no cierra** con código tocado y `verify:fast` en rojo; cede tras tres intentos avisando que el árbol quedó roto; no repite lo que ya pasó sobre el mismo árbol (sello) |

Permisos: lo rutinario corre solo (pnpm, git local, docker compose, curl a localhost); publicar en un remoto, desplegar o tocar una base que no sea la local pregunta; leer secretos, borrar recursivamente y forzar un push nunca.

**2. El agente, revisión en contexto limpio.** Tres subagentes en `.claude/agents/`, cada uno con una memoria versionada en `.claude/agents/memoria/` donde anota lo que aprendió para la próxima vez:

- `revisor`: refuta el diff contra la spec y las reglas duras. No implementa.
- `guardian-datos`: audita esquema, migraciones y consultas antes de aplicarlas; vigila el invariante y los centavos.
- `auditor-seguridad`: busca vías de ataque concretas, paso a paso, al cerrar cada fase. Entra en escena con la autenticación, el despliegue, el chat con IA, las notificaciones push y la clave de Binance.

**3. El autor, dueño y responsable.** No hay aprobación cruzada: con una persona sería un "aprobado" vacío. Lo que bloquea la fusión son los gates y el veredicto del revisor. Hueco conocido: nadie revisa el diff final si se cambia algo después de `/f-review`; si el cambio es sustancial, se vuelve a pasar.

## Los gates

Dos niveles, ambos scripts de `package.json`, ambos sellan el árbol al pasar para no repetirse (`scripts/sello.mjs`):

- `pnpm verify:fast` (lo corre el hook `Stop`): tipos, lint, formato, estructura y pruebas unitarias.
- `pnpm verify` (bloquea la fusión): lo anterior más el build de producción y la prueba de humo de rutas contra ese build.

No hay integración continua: el verde en la máquina, en el momento de fusionar, es el que cuenta. El remoto es `github.com/angelg21/finanzas`, privado y gratuito, con la cuenta personal del autor; sirve de respaldo. No se usan pull requests ni protección de rama: la revisión la hace el subagente revisor en local y el candado es el gate. Si algún día hay CI, no repite los gates; solo guarda evidencia.

## Arquitectura y orden

La interfaz se construye solo dentro de Next, como componentes de React con Tailwind y los tokens del proyecto. No hay archivos HTML o CSS sueltos ni para pantallas ni para maquetas: cuando haya que comparar alternativas, se hace en una ruta de la app. El código se organiza en cuatro capas con dependencias en una sola dirección, descritas en `CLAUDE.md` y fijadas en el ADR 0005; `scripts/estructura.mjs` las vigila y el hook se lo recuerda al agente al editar.

## Reglas transversales

- **Evidencia ejecutada, no afirmaciones.** "Debería funcionar" no es un estado. Toda conclusión va con la salida del comando, la captura o el resultado de la prueba.
- **Incrementos pequeños.** Una tarea son 30 a 60 minutos y termina en verde con un commit.
- **Trazabilidad al plan.** Toda funcionalidad apunta a una sección o fase de `docs/plan-financiero-y-app.md`. `/f-spec` se detiene si no la encuentra y propone primero cambiar el plan.
- **El contexto se administra.** La exploración se delega a subagentes que devuelven conclusiones, no volcados de archivos. Si se corrige lo mismo dos veces sin éxito, `/clear` y replantear.
- **El arnés mejora con cada fallo.** Cuando un defecto llega a `main`, el arreglo incluye cerrar el hueco (regla, prueba de regresión o hook), no solo el síntoma. Cada regla del repo corresponde a un error real; las reglas "por si acaso" inflan el contexto y hacen que el agente ignore las que importan.
- **Cada tema normativo tiene un documento dueño.** El producto: `docs/plan-financiero-y-app.md`. Lo visual: `docs/diseno.md`. El método: este archivo. Las decisiones: `docs/adr/`. Los demás referencian, no repiten.
- **Un archivo trata de una sola cosa.** La regla es la cohesión; el tamaño solo es el detector: aviso a 320 líneas, techo firme a 700. Nunca partir por la mitad ni crear un `helpers.ts`.

## Lo que no se adoptó, a propósito

- **Aprobación cruzada y revisión en CI**: no hay segunda persona ni remoto.
- **Modo plan por defecto**: con un solo desarrollador frena más de lo que protege. Los skills obligan a explorar antes de editar donde hace falta.
- **Pruebas de navegador automatizadas y presupuesto de bundle**: el costo no se justifica para una persona; las capturas y la mirada del autor cubren el riesgo real.
- **Verificación de fronteras entre módulos**: hay un solo módulo. Se añade el día que haya dos.
- **Auditoría de seguridad en cada feature**: solo al cerrar fases, cuando entran autenticación, despliegue, el chat con IA, las notificaciones push y claves externas.

Se revisa esta lista al cerrar cada fase del plan.
