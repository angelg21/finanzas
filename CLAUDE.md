@AGENTS.md

# finanzas · guía del repo

App web progresiva personal de presupuesto por sobres: cada dólar tiene un trabajo. Un solo desarrollador, sin apuro; el riesgo está en el dinero y los datos personales, no en la escala. El propósito manda: ayudar a organizarse, empezar a invertir y aprovechar estos años.

Documentos dueños: producto en `docs/plan-financiero-y-app.md`; visual en `docs/diseno.md` con `docs/referencias/`; método en `docs/WORKFLOW.md`; decisiones en `docs/adr/`; revisión de interfaz en curso en `docs/observaciones.md`. Se corrige en el dueño; los demás referencian.

## Pipeline

Una sesión, una feature. Entre etapa y etapa, `/clear`: lo importante quedó en un archivo.

| Etapa             | Comando           | Sale cuando                                                                                  |
| ----------------- | ----------------- | -------------------------------------------------------------------------------------------- |
| Especificar       | `/f-spec <idea>`  | el desarrollador leyó y corrigió `docs/features/NNN-slug/spec.md`                            |
| Construir y mirar | `/f-build NNN`    | cada tarea con commit y pantallas validadas en navegador, anotado con fecha en `progress.md` |
| Probar lo crítico | `/f-verify NNN`   | `pnpm verify` en verde y cada criterio ★ con su prueba derivada de la spec                   |
| Revisar           | `/f-review NNN`   | el subagente `revisor` da APTO PARA FUSIONAR                                                 |
| Fusionar          | `/f-ship NNN`     | verify en verde ahora mismo, diff repasado por el autor, rama fusionada en `main`            |
| Auditar           | `/f-audit <fase>` | al cerrar cada fase del plan                                                                 |

Apoyo: `/f-status` (dónde está el pipeline), `/f-adr <decisión>`.

- Si piden "implementa X" sin spec: **no codificar**. Responder con `/f-status` y ofrecer `/f-spec`.
- Excepción única: un cambio cuyo diff cabe en una frase se hace directo y pasa solo por `/f-verify`.
- Explorar antes de editar: leer la spec, el plan y `docs/diseno.md` que apliquen. La exploración amplia se delega a un subagente que devuelve conclusiones.

## Reglas duras

Cada una existe por una razón real. No se añaden reglas "por si acaso".

- **Montos en centavos enteros.** Nunca float, `parseFloat` ni `toFixed` fuera de `src/lib/dinero.ts`. Razón: precisión del dinero.
- **Invariante: suma de sobres igual a suma de cuentas propias.** Cada ingreso cae en "Por asignar" y se reparte con reasignaciones (ADR 0002). Los saldos se calculan, nunca se guardan.
- **Nombres del dominio en español**, como en el plan: cuentas, sobres, categorías, movimientos, reglas de reparto, partidas.
- **Solo tokens de `globals.css` y piezas de `src/components/ui.tsx` y `formulario.tsx`.** Nunca `dark:` ni colores sueltos. Razón: dos diseños rechazados (ADR 0003).
- **Nada de este proyecto se publica fuera del repo**: ni artifacts ni documentos en la nube. Razón: otras personas entran a esa cuenta.
- **Migraciones solo con `pnpm db:generate` y `pnpm db:migrate`.** Nunca editar una migración ya generada; un hook escala a humano si se intenta.
- **Nunca debilitar, omitir ni borrar una prueba** para que el código pase. Si estorba, el error está en el código o en la spec.
- **Datos de demostración siempre con referencia `demo-*`** (`pnpm db:demo`, `pnpm db:demo:limpiar`). Nunca mezclarlos con datos reales ni inventar datos sin marcar.
- **Un archivo, una cosa.** Aviso a 320 líneas, techo a 700. Nunca partir por la mitad ni crear un `helpers`.
- **Evidencia ejecutada, no afirmaciones.** Toda conclusión va con la salida del comando, la prueba o la captura.
- **La captura rápida de un gasto es la función más importante.** Nada puede hacerla más lenta.
- **Toda la interfaz es React dentro de Next.** Componentes `.tsx` con Tailwind y tokens; nunca archivos HTML o CSS sueltos para pantallas, maquetas o alternativas. Para comparar opciones, una ruta de la app. Única excepción: el envoltorio que `pnpm capturas` genera en `capturas/`, que es una herramienta y no se versiona.
- **Fronteras entre capas** (ADR 0005), vigiladas por el hook de estructura: `lib` no importa nada del proyecto ni React; `components` no toca la base; `db` no conoce la interfaz; las páginas no hablan con Drizzle.

## Arquitectura

Cuatro capas, dependencias en una sola dirección: `app → components, db, lib` · `components → lib` · `db → lib` · `lib → nada`.

| Capa              | Qué va                                                                                                                                                                                                     | Qué no va                               |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `src/app/`        | rutas: páginas como componentes de servidor que consultan y componen; `acciones.ts` por ruta con server actions validadas con zod; componentes cliente solo en hojas (`"use client"` con `useActionState`) | lógica de negocio, SQL, estilos sueltos |
| `src/components/` | piezas visuales reutilizables (`ui`, `formulario`, `navegacion`, gráficas); reciben datos por props                                                                                                        | acceso a la base, conocimiento de rutas |
| `src/db/`         | esquema, conexión, consultas de lectura y operaciones de escritura                                                                                                                                         | React, Next, formato visual             |
| `src/lib/`        | reglas del dominio y aritmética pura (dinero, fondos, reparto), cada una con su `.test.ts`                                                                                                                 | React, Next, base de datos              |

Prácticas: componentes de servidor por defecto; tipos de Drizzle y `PageProps` en vez de tipos a mano; `import type` cuando solo se necesita el tipo; un archivo por concepto, nombrado en español por lo que hace; nada de `any`; accesibilidad básica en cada pieza (`aria-label`, roles, foco visible); los formularios funcionan sin JavaScript y mejoran con él.

## Pruebas

Antes del código, viéndolas fallar: aritmética de dinero, reglas de reparto, invariante, importador. Funciones puras en `src/lib/` con `.test.ts` al lado. Lo demás, después de mirar, una prueba por criterio ★. Sin pruebas de navegador automatizadas; en su lugar, mirar y `pnpm capturas`.

## Comandos

| Comando                            | Qué hace                                                              |
| ---------------------------------- | --------------------------------------------------------------------- |
| `pnpm dev`                         | servidor de desarrollo en http://localhost:3000                       |
| `pnpm db:up` / `db:down`           | Postgres local en Docker, puerto 5433                                 |
| `pnpm db:generate` / `db:migrate`  | migración desde `src/db/schema.ts` y aplicarla                        |
| `pnpm db:seed`                     | cuentas, sobres, categorías y reglas iniciales (idempotente)          |
| `pnpm db:demo` / `db:demo:limpiar` | datos de demostración marcados `demo-*`                               |
| `pnpm verify:fast`                 | tipos, lint, formato, estructura, unitarias; lo corre el hook Stop    |
| `pnpm verify`                      | lo anterior más build y humo de rutas; bloquea la fusión              |
| `pnpm test` / `test:watch`         | pruebas unitarias                                                     |
| `pnpm format`                      | Prettier sobre todo el repo                                           |
| `pnpm estructura`                  | reglas de estructura sobre `src/`                                     |
| `pnpm capturas [url] [-- /rutas]`  | capturas de escritorio y celular en ambos temas, en `capturas/`       |
| `pnpm humo`                        | rutas del build respondiendo (necesita `pnpm build` y la base arriba) |

Los gates sellan el árbol al pasar; `--forzar` repite.
