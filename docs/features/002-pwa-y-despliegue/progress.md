# 002 · Progreso

Rama: `feat/002-pwa-y-despliegue`. Spec: `spec.md`.

## Antes de construir

Pasos del desarrollador: tocan cuentas externas y archivos `.env`, que el agente no escribe.

- Antes de T5, crear en Supabase el proyecto "finanzas-dev", apagar el registro de usuarios nuevos y crear el usuario de prueba. Añadir a `.env.local`:
  - `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` de ese proyecto;
  - `USUARIO_PERMITIDO`, con el correo del usuario de prueba;
  - `HUMO_CORREO` y `HUMO_CLAVE`.
- Antes de T9, buscar el logo original en SVG o en alta resolución, si existe.
- Antes de T15, crear el proyecto "finanzas" de producción y el de Vercel siguiendo `docs/despliegue.md`, que se escribe en T15.

## Tareas

Cada tarea cabe en 30 a 60 minutos y termina en verde con un commit. Se marca con la fecha al cerrarla.

- [ ] T1 · `src/lib/acceso.ts` (`destinoSeguro`, `esUsuarioPermitido`) y `src/lib/destino-base.ts` (`esBaseLocal`, `describirBase`). Pruebas primero, con los casos de la spec (criterios 3, 4, 10 y 11); verlas fallar y luego implementar.
- [ ] T2 · Esquema:
  - escribir primero la prueba que recorre las tablas exportadas por `schema.ts` y exige RLS en cada una, y verla fallar (criterio 9);
  - activar RLS con la API de Drizzle y correr `pnpm db:generate`;
  - lanzar `guardian-datos`, luego `pnpm db:migrate` en local;
  - la app local se ve igual que antes.
- [ ] T3 · Guardas de base:
  - `db:demo` se niega fuera de local;
  - `drizzle.config.ts`, `db:migrate` y `db:seed` se niegan fuera de local;
  - `db:migrate:produccion` y `db:seed:produccion` leen `.env.produccion.local`, muestran el destino con `describirBase` y piden escribir `produccion` (criterios 10 y 11);
  - comprobarlo con un `DATABASE_URL` remoto falso, sin conectar.
- [ ] T4 · `pnpm db:respaldo:produccion` con el `pg_dump` del contenedor, hacia `data/respaldos/AAAA-MM-DD.sql`, y la restauración de prueba en `finanzas_restauracion`, que compara el conteo y las sumas por tipo (criterio 12). Se ensaya contra la base local.
- [ ] T5 · Supabase en el servidor:
  - instalar `@supabase/ssr` y `@supabase/supabase-js`;
  - crear el cliente de servidor con cookies `HttpOnly`;
  - escribir `exigirSesion()`, con `cache` y la comprobación de `USUARIO_PERMITIDO`;
  - escribir `src/proxy.ts`: renueva la sesión y redirige a `/entrar?siguiente=`; su matcher deja fuera el manifiesto, `/sw.js`, los iconos, `/sin-conexion` y `_next` (criterios 1, 3, 6 y 8);
  - leer antes la guía de autenticación y la de proxy en `node_modules/next/dist/docs/` y la de `@supabase/ssr`.
- [ ] T6 · Grupos de rutas:
  - mover las rutas a `(con-sesion)` con el cascarón, y crear `(sin-sesion)` con el lienzo y el panel;
  - `exigirSesion()` en cada página y en cada acción;
  - una regla de estructura que lo exija en todo `acciones.ts` y en toda página fuera de `(sin-sesion)`;
  - otra regla contra `NEXT_PUBLIC_` (criterios 1, 2 y 8);
  - las rutas siguen respondiendo en las mismas direcciones.
- [ ] T7 · Pantalla `/entrar` y su acción: errores, límite de intentos, correo conservado, sin JavaScript, y redirección con `destinoSeguro`. "Salir" en `BarraLateral` y en `MenuMovil`, y `Cache-Control: private, no-store` en las páginas con datos (criterios 3, 4, 5 y 7).
- [ ] T8 · Cabeceras en `next.config.ts` (criterio 14). Humo con dos modos:
  - con sesión, entrando con el usuario de prueba: las rutas de siempre responden 200;
  - sin sesión: cada ruta redirige a `/entrar`, responden las públicas y están las cabeceras;
  - con `--url` para correr contra una URL remota en modo sin sesión (criterios 1, 13 y 14).
- [ ] T9 · Pieza `Emblema` en SVG, aprobada por el desarrollador lado a lado con `logo-emblema.png`. Iconos generados con `ImageResponse`: favicon, `apple-icon` de 180, y 192, 512 y 512 adaptable, con margen extra para la flecha (criterio 16).
- [ ] T10 · Manifiesto con el acceso directo "Registrar gasto", `appleWebApp`, zonas seguras en la barra superior y en `NavInferior`, y la barra de estado que sigue al tema elegido (criterios 15 y 17). Panel Application de DevTools sin errores.
- [ ] T11 · `/sw.js` y su registro desde una hoja `"use client"`, más la página estática `/sin-conexion` (criterios 18 y 20). En DevTools, con la red desconectada: navegar muestra `/sin-conexion`, ningún POST pasa por el service worker y la caché solo contiene lo de `/sin-conexion`.
- [ ] T12 · Fallas al guardar en la captura y en los formularios de categorías y sobres: sin red, con la sesión vencida y con una versión vieja. El mensaje aparece junto al botón, lo escrito se conserva y nada se reintenta solo (criterio 19). Se prueba en Edge con la red desconectada y con las cookies borradas a mano.
- [ ] T13 · `pnpm capturas -- /entrar /sin-conexion /nuevo/gasto` en claro y oscuro, comparadas con las referencias y con "Pantallas". En el celular, por la red local: entrar, salir, atrás después de salir, y la captura detrás del inicio de sesión.
- [ ] T14 · `/f-audit completo` sobre la rama, antes de exponer nada. Cada hallazgo se cierra o se acepta con un ADR (criterio 13).
- [ ] T15 · `docs/despliegue.md` con los pasos exactos y `.vercelignore`. El desarrollador:
  - crea "finanzas" en la misma región que Vercel, con la API de datos apagada, el registro apagado y su usuario;
  - corre `db:migrate:produccion` y `db:seed:produccion`;
  - crea el proyecto de Vercel sin conectar el repositorio, con las variables solo en Production y la región igual a la de la base, y despliega desde la rama con la CLI.

  Después corren `pnpm humo -- --url <producción> --sin-sesion` y el primer respaldo (criterios 12 y 13).

- [ ] T16 · En el celular, con la app instalada:
  - el icono y el acceso directo;
  - las zonas seguras y la barra de estado en los dos temas;
  - abrir sin red;
  - entrar y salir;
  - los tiempos de captura y de guardado, cronometrados y anotados (criterios 15 a 17, 20 y 21).
- [ ] T17 · Documentos:
  - ADR 0010 con `/f-adr` (Supabase solo en el servidor, dos proyectos, RLS con la API de datos apagada, migraciones de producción a mano, orden del primer despliegue);
  - el plan: la línea de la fase 1 marcada como hecha;
  - `docs/diseno.md`: `Emblema`, `/entrar`, `/sin-conexion`, los iconos y la excepción de color del logo;
  - `CLAUDE.md`: los comandos nuevos, la regla de migraciones con su variante de producción y los modos del humo;
  - `docs/WORKFLOW.md`, si cambió el orden de la auditoría;
  - las observaciones, si cambió algo.

## Validación en navegador

El desarrollador anota aquí, con fecha, qué pantallas miró y en qué ancho. Sin esta nota no se pasa a `/f-verify`.

-

## Etapas

- [ ] Spec leída y corregida por el desarrollador
- [ ] Construida (todas las tareas con commit)
- [ ] Validada en navegador
- [ ] Verificada: `pnpm verify` en verde, cada ★ con su prueba
- [ ] Revisada: veredicto APTO PARA FUSIONAR
- [ ] Fusionada en `main` el AAAA-MM-DD

## Notas

- Después de `/f-ship`, el repositorio se conecta a Vercel con `main` como rama de producción. Desde entonces, publicar `main` despliega.
