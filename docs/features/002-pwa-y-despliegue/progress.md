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

- [x] T1 · (2026-10-13) `src/lib/acceso.ts` (`destinoSeguro`, `esUsuarioPermitido`) y `src/lib/destino-base.ts` (`esBaseLocal`, `describirBase`). Pruebas primero, con los casos de la spec (criterios 3, 4, 10 y 11); verlas fallar y luego implementar.
- [x] T2 · (2026-10-13) Esquema:
  - escribir primero la prueba que recorre las tablas exportadas por `schema.ts` y exige RLS en cada una, y verla fallar (criterio 9);
  - activar RLS con la API de Drizzle y correr `pnpm db:generate`;
  - lanzar `guardian-datos`, luego `pnpm db:migrate` en local;
  - la app local se ve igual que antes.
- [x] T3 · (2026-10-13) Guardas de base:
  - `db:demo` se niega fuera de local;
  - `drizzle.config.ts`, `db:migrate` y `db:seed` se niegan fuera de local;
  - `db:migrate:produccion` y `db:seed:produccion` leen `.env.produccion.local`, muestran el destino con `describirBase` y piden escribir `produccion` (criterios 10 y 11);
  - comprobarlo con un `DATABASE_URL` remoto falso, sin conectar.
- [x] T4 · (2026-10-13) `pnpm db:respaldo:produccion` con el `pg_dump` del contenedor, hacia `data/respaldos/AAAA-MM-DD.sql`, y la restauración de prueba en `finanzas_restauracion`, que compara el conteo y las sumas por tipo (criterio 12). Se ensaya contra la base local.
- [x] T5 · (2026-10-13) Supabase en el servidor:
  - instalar `@supabase/ssr` y `@supabase/supabase-js`;
  - crear el cliente de servidor con cookies `HttpOnly`;
  - escribir `exigirSesion()`, con `cache` y la comprobación de `USUARIO_PERMITIDO`;
  - escribir `src/proxy.ts`: renueva la sesión y redirige a `/entrar?siguiente=`; su matcher deja fuera el manifiesto, `/sw.js`, los iconos, `/sin-conexion` y `_next` (criterios 1, 3, 6 y 8);
  - leer antes la guía de autenticación y la de proxy en `node_modules/next/dist/docs/` y la de `@supabase/ssr`.
- [x] T6 · (2026-10-13) Grupos de rutas:
  - mover las rutas a `(con-sesion)` con el cascarón, y crear `(sin-sesion)` con el lienzo y el panel;
  - `exigirSesion()` en cada página y en cada acción;
  - una regla de estructura que lo exija en todo `acciones.ts` y en toda página fuera de `(sin-sesion)`;
  - otra regla contra `NEXT_PUBLIC_` (criterios 1, 2 y 8);
  - las rutas siguen respondiendo en las mismas direcciones.
- [x] T7 · (2026-10-13) Pantalla `/entrar` y su acción: errores, límite de intentos, correo conservado, sin JavaScript, y redirección con `destinoSeguro`. "Salir" en `BarraLateral` y en `MenuMovil`, y `Cache-Control: private, no-store` en las páginas con datos (criterios 3, 4, 5 y 7).
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

- [x] Spec leída y corregida por el desarrollador (2026-10-13)
- [ ] Construida (todas las tareas con commit)
- [ ] Validada en navegador
- [ ] Verificada: `pnpm verify` en verde, cada ★ con su prueba
- [ ] Revisada: veredicto APTO PARA FUSIONAR
- [ ] Fusionada en `main` el AAAA-MM-DD

## Notas

- Después de `/f-ship`, el repositorio se conecta a Vercel con `main` como rama de producción. Desde entonces, publicar `main` despliega.
- T2, hallazgos del `guardian-datos` (APTO PARA MIGRAR, 2026-10-13):
  - La app depende de entrar como **dueña** de las tablas. Con un rol que no sea dueño, RLS le devuelve cero filas sin error: `/cuentas` diría que cuadra con 0 = 0. Va al ADR 0010 y a `docs/despliegue.md` (T15 y T17): nada de un rol de mínimo privilegio sin políticas propias.
  - `schema.test.ts` solo mira el código. `db:migrate:produccion` mostrará, después de migrar, el dueño y las marcas de RLS de cada tabla de `public`, y si `anon` tiene acceso al esquema `drizzle` (T3).
  - La prueba no cubre vistas. Una vista en `public` salta RLS. Cuando llegue la primera, `securityInvoker: true` y ampliar la prueba.
  - Migrar con la app sin uso: los bloqueos exclusivos pueden chocar con un gasto que se guarde en ese instante.
- T3, `guardian-datos`: NO APTO en la primera vuelta y APTO en la segunda (2026-10-13). Lo que cambió por sus hallazgos:
  - Una URL ilegible (contraseña con `/`, `?`, `#`, `@` o `,` sin escapar) ya no llega al driver, cuyo error repetía la URL entera. Los scripts imprimen solo el mensaje y la causa (`terminarConError`), y `src/db/index.ts` también la valida.
  - `postgres.js` y `new URL` leían distinto algunas URL ambiguas. `conexion-script.test.ts` lo mide con el driver real, sin conectar.
  - Producción exige `?sslmode=require` (uno solo) y una terminal real: una respuesta por tubería no pasa la confirmación.
  - `db:migrate:produccion` revisa la base real después de migrar (`src/db/estado-base.ts`): tablas iguales al esquema, RLS, sin FORCE, de quien conecta, ninguna vista que salte RLS, `anon` fuera de `drizzle` y todas las migraciones del journal.
  - `comprobar-001.ts` también exige la base local, porque escribe filas de demostración. La spec no lo pedía.
  - Spec corregida con el desarrollador: `.env.produccion.local` usa el pooler en modo sesión, no la conexión directa (solo IPv6), y el `DATABASE_URL` de producción lleva `?sslmode=require`.
- Pendientes para T15:
  - Antes de crear `.env.produccion.local`, el desarrollador corre `pnpm db:seed:produccion` en su terminal. Debe decir "Falta .env.produccion.local". Si dice "…en una terminal", está en Git Bash (mintty): usar PowerShell o `winpty`.
  - La primera vez con el archivo, escribir algo distinto de `produccion` debe responder "Cancelado". El agente no lo puede ensayar porque no escribe archivos `.env`.
  - `docs/despliegue.md`: pooler de sesión con `?sslmode=require` para `.env.produccion.local`; pooler de transacción con `?sslmode=require` en Vercel; "Enforce SSL" en Supabase.
- T4, `guardian-datos`: NO APTO en la primera vuelta y APTO en la segunda (2026-10-13). Lo que cambió:
  - La contraseña entra a `pg_dump` en `PGPASSWORD`, nunca en sus argumentos, que lista cualquiera con acceso a Docker.
  - Un `%` mal escapado o `%00` invalida la URL, porque libpq repetía la clave en su error.
  - Se compara cada tabla del esquema (filas y huella md5 en UTC), los movimientos por tipo y las migraciones. Antes, el primer respaldo, con `movimientos` vacía, se daba por bueno sin comparar nada.
  - `finanzas_restauracion` se borra siempre, también si falla. El volcado se llama `.sql.sin-comprobar` hasta que cuadra.
  - El guardián lo midió también en modo `--produccion` contra la imagen de Supabase con TLS: 11 ✓.
- Para T14 y T15, del guardián en T4:
  - Restaurar con un rol NOSUPERUSER, por si un esquema de producción manipulado ejecuta código al restaurar.
  - `pnpm exec tsx src/db/respaldo.ts --produccion` no cae bajo el `deny`: lo frena solo la comprobación de terminal.
  - El respaldo no incluye `auth.users`. Va dicho en `docs/despliegue.md`.
  - Mirar `select version()` en producción: si el proyecto nace en Postgres 18, el `pg_dump` 17 se niega.
  - `pg_dump` por el pooler real en modo sesión sigue sin medirse.
- T5, comprobado sin credenciales reales (2026-10-13):
  - Sin `SUPABASE_URL` ni la clave en el entorno, toda ruta protegida responde 500 sin datos: falla cerrada.
  - Con valores falsos, en un build de producción, sin sesión:
    - GET y HEAD redirigen a `/entrar?siguiente=<ruta>`, con la consulta incluida y `Cache-Control: private, no-store`;
    - un POST que no es server action recibe 401 sin cuerpo. Antes de ese cambio, un POST renderizaba la página con datos, porque el proxy no redirige POST;
    - un POST con un id de acción inventado da 404.
  - Una server action real sin sesión llega a la acción. La cierra `exigirSesion()` en T6.
  - Queda para cuando el desarrollador cargue "finanzas-dev" en `.env.local`, y se comprueba en T7 con `/entrar`:
    - entrar, renovar la sesión, la cookie `HttpOnly` y `SameSite=Lax`, y el cierre de una sesión de otro correo;
    - que `getClaims` verifique en local, con `alg` ES256 o RS256.
  - Para la auditoría: el límite de `/auth/v1/token` (150 cada 5 minutos por IP) es compartido entre entrar y renovar, y todo sale de la IP del servidor. Quien martille `/entrar` también frena las renovaciones. Evaluar un límite propio.
- T6 (2026-10-13):
  - Las rutas pasaron a `(con-sesion)`, con el cascarón en su layout. El build lista las mismas direcciones que antes.
  - Las reglas de estructura se probaron con contenidos sintéticos. Cada caso da lo esperado:
    - página sin la sesión, con la sesión en segundo lugar, o síncrona: error;
    - página dentro de `(sin-sesion)`: sin error;
    - una acción sin la sesión: error con su nombre;
    - una acción exportada como `const`: error;
    - `NEXT_PUBLIC_` en `src/` o en `next.config.ts`: error.
  - Mover las carpetas exigió detener `pnpm dev`: Windows no deja renombrar lo que el servidor vigila.
  - `pnpm humo` espera 200 en las rutas y fallará hasta T8, cuando entre con el usuario de prueba. `pnpm verify` completo no pasa hasta entonces.
- T7 (2026-10-13):
  - Comprobado con Supabase falso, en un build de producción:
    - `/entrar` responde 200 con `Cache-Control: private, no-store`;
    - trae los campos y atributos de la spec, con `siguiente` en el formulario;
    - enviado sin JavaScript (multipart, como un navegador), vuelve con el mensaje de error, el correo conservado y sin la contraseña en la respuesta.
  - Pendiente de "finanzas-dev", en T13, en el navegador: contraseña equivocada, límite de intentos, correo ajeno, entrar con `siguiente`, salir y "atrás" después de salir.
  - Decisiones:
    - `entrar` siempre pregunta a Supabase, también por un correo que no es el permitido, para no delatar cuál es por el tiempo de respuesta;
    - "Salir" cierra solo la sesión de este dispositivo (`scope: "local"`): salir en la computadora no saca al celular. La spec no lo fijaba;
    - las acciones de `(sin-sesion)` quedan fuera de la regla de sesión, porque `entrar` es la que la crea.
  - El `Emblema` de `/entrar` llega con T9.
