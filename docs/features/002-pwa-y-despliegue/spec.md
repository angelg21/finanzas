# 002 · PWA instalable y despliegue

Fecha: 2026-10-13. Estado: aprobada.

## Para qué

Hoy la app solo corre en la computadora, con `pnpm dev`, y en el celular solo dentro de la red de la casa. Para que la captura rápida sirva hace falta tenerla en la pantalla de inicio del celular y anotar el gasto en el momento, desde cualquier lugar. Eso exige publicarla. Y publicar una app con el historial financiero exige que nadie más pueda entrar.

## Trazabilidad al plan

- Sección 6, fase 1: "PWA instalable y despliegue para usar la app a diario (feature 002): base en Supabase, Supabase Auth para un solo usuario, Vercel, y `/f-audit` antes de publicar".
- Sección 4, "Stack": Supabase Auth, despliegue en Vercel, PWA instalable en el celular.
- Sección 4, "El riesgo número uno del proyecto": la captura desde el celular no puede volverse más lenta.
- ADR 0009: el service worker de esta feature es la base del push de la fase 2. Aquí se registra, pero todavía no envía notificaciones.
- ADR 0001: producción en Postgres de Supabase con `prepare: false` para el pooler.

No cambia el plan. Al cerrar se marca la línea de la fase 1 como hecha.

## Criterios de aceptación

**Acceso**

1. ★ **Sin sesión no se ve nada.** Dado que no inicié sesión, cuando pido cualquier ruta de la app (`/`, `/movimientos`, `/sobres`, `/sobres/[id]`, `/cuentas`, `/nuevo`, `/nuevo/gasto`, `/categorias`, `/categorias/nueva`, `/categorias/[id]`), entonces el servidor responde con una redirección a `/entrar?siguiente=<ruta>` y ningún dato en el cuerpo. Sin sesión solo responden `/entrar`, `/sin-conexion`, el manifiesto, el service worker y los iconos. Esto rige también para las rutas que se agreguen después.
2. ★ **Cada acción exige la sesión por su cuenta.** Dado que no hay sesión válida, cuando alguien envía un POST directo a cualquier server action (registrar gasto; crear, editar, archivar, restaurar o eliminar una categoría; las partidas y el aporte de un sobre), entonces no se escribe nada y la respuesta pide entrar. La acción no se fía del proxy: verificar la sesión es su primera instrucción. Lo mismo rige para cada `page.tsx` con datos. Una regla de estructura lo exige en todo `acciones.ts` y en toda página fuera de `(sin-sesion)`, también en las futuras.
3. ★ **Un solo usuario.** Dado alguien con una cuenta válida en el proyecto de Supabase cuyo correo no es `USUARIO_PERMITIDO`, cuando entra, entonces la app cierra esa sesión y le muestra el mismo error que a una contraseña equivocada. El correo se compara sin mayúsculas ni espacios en los extremos. Si `USUARIO_PERMITIDO` falta, nadie entra: la app falla cerrada. Además, en Supabase el registro de usuarios nuevos está apagado.
4. ★ **Redirección segura.** Dado un `siguiente` en la dirección, cuando entro, entonces la app me lleva ahí solo si es una ruta interna: empieza con una única `/` y no con `//` ni `/\`, no trae esquema (`https:`, `javascript:`) y no es `/entrar`. Cualquier otro valor, o ninguno, lleva a `/`.
5. **Entrar.** Dado mi correo y mi contraseña, cuando toco "Entrar", entonces llego a `siguiente` o a `/`. Con datos equivocados veo "Correo o contraseña incorrectos.", sin decir cuál de los dos falló. Si Supabase corta por exceso de intentos, veo "Demasiados intentos. Espera unos minutos.". El correo se conserva en el campo y la contraseña no. Funciona sin JavaScript. Si ya tengo sesión, `/entrar` me lleva a `/`.
6. **Sesión larga.** Dado que entré desde el celular, cuando vuelvo días después, entonces sigo dentro sin escribir nada: el proxy renueva la sesión. Solo "Salir" o revocar la sesión desde el panel de Supabase la terminan.
7. **Salir.** Dado que tengo sesión, cuando toco "Salir" en `BarraLateral` o en `MenuMovil`, entonces la sesión se cierra también en Supabase, las cookies se borran y llego a `/entrar`. Si después toco atrás, no veo los datos de antes: las páginas con datos llevan `Cache-Control: private, no-store`. Funciona sin JavaScript.
8. ★ **Ningún secreto llega al navegador.** No hay variables `NEXT_PUBLIC_`; una regla de estructura lo vigila con una lista de permitidas, hoy vacía. La cadena de conexión y la clave publicable de Supabase viven solo en el servidor, porque el cliente de Supabase solo se crea ahí. La clave de servicio no existe ni en la app ni en el repositorio. Las cookies de sesión son `HttpOnly`, `SameSite=Lax` y, en producción, `Secure`.

**Base de datos**

9. ★ **RLS en todas las tablas.** Dado el esquema, cuando se recorren todas las tablas que exporta `src/db/schema.ts`, entonces cada una tiene RLS activado y ninguna política. Así, con la clave publicable de Supabase, la API de datos no devuelve ni acepta ninguna fila. La prueba recorre lo que exporta el esquema, de modo que una tabla nueva sin RLS la hace fallar. La app entra con su cadena de conexión, como dueña de las tablas, y no se ve afectada. Además, la API de datos queda apagada en el proyecto de producción: son dos capas.
10. ★ **Demostración solo en local.** Dado un `DATABASE_URL` cuyo host no es `localhost`, `127.0.0.1` ni `::1`, cuando corro `pnpm db:demo`, entonces termina con un error antes de conectar y no escribe nada. `pnpm db:demo:limpiar` corre en cualquier base, porque solo borra lo marcado `demo-*`.
11. ★ **Producción solo con un comando que la nombra.** Dado que `.env.local` apunta por error a una base remota, cuando corro `pnpm db:migrate` o `pnpm db:seed`, entonces se niegan. Contra producción solo corren `pnpm db:migrate:produccion` y `pnpm db:seed:produccion`. Ambos piden pegar la cadena de producción, oculta, en la terminal: no existe en ningún archivo (antes `.env.produccion.local`; auditoría T14, hallazgo 4). Muestran el destino como `host:puerto/base`, sin usuario ni contraseña, y piden escribir `produccion` antes de aplicar. El agente nunca los corre: los corre el desarrollador.
12. ★ **Respaldo.** Dado la base de producción, cuando corro `pnpm db:respaldo:produccion`, entonces queda un volcado con fecha en `data/respaldos/`, que git ignora, hecho con el `pg_dump` del contenedor local. Restaurarlo en una base local aparte (`finanzas_restauracion`) da el mismo número de movimientos y la misma suma de `monto_usd_centavos` por tipo que producción. El primer respaldo se hace el día del primer despliegue.

**Producción**

13. ★ **Nada público antes de la auditoría.** Dado el proyecto de Vercel, entonces solo recibe la cadena de conexión de producción cuando `/f-audit completo` sobre esta rama terminó y cada hallazgo quedó cerrado o aceptado con ADR. Las variables viven solo en el entorno Production, no en Preview. El repositorio se conecta a Vercel después de `/f-ship`, cuando `main` ya tiene la autenticación. Antes de eso, el primer despliegue se hace con la CLI desde la rama, con un `.vercelignore` que deja fuera `.env*`, `data/` y `capturas/`. La prueba es `pnpm humo -- --url <producción> --sin-sesion`, que comprueba el criterio 1 y las cabeceras del 14 contra la URL pública.
14. **Cabeceras.** Toda respuesta lleva `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Robots-Tag: noindex, nofollow` y una `Permissions-Policy` que niega cámara, micrófono y ubicación. `/sw.js` se sirve con `Cache-Control: no-cache, no-store, must-revalidate` y `Content-Security-Policy: default-src 'self'; script-src 'self'`. El humo las comprueba.

**PWA**

15. **Instalable.** El manifiesto dice nombre y nombre corto "Arca" (antes "Finanzas"; cambio del desarrollador, 2026-10-14), `start_url` y `scope` en `/`, `display: standalone`, idioma `es`, los colores de fondo y de tema del `panel-a` claro, iconos de 192 y 512 y uno de 512 adaptable (_maskable_), y un acceso directo "Registrar gasto" a `/nuevo/gasto` al mantener presionado el icono en Android. Chrome en Android y Edge en escritorio ofrecen instalarla. En iPhone se instala con Compartir → "Añadir a inicio", gracias al `apple-icon` de 180 y a los metadatos `appleWebApp`. El panel Application de DevTools no muestra errores de manifiesto.
16. **Icono.** Solo el emblema, nunca las letras (`docs/diseno.md`, "Logo"). Sale de una fuente vectorial, así que no se pixela a 512. En el adaptable, el emblema completo, punta de la flecha incluida, cabe en la zona segura con margen.
17. **Pantalla completa sin choques.** En la app instalada, la barra superior no queda debajo de la barra de estado ni de la muesca, y el "+" flotante (`BotonFlotanteRegistrar`, que reemplazó a `NavInferior` el 2026-10-14) queda por encima del indicador de inicio (`env(safe-area-inset-*)`). La barra de estado sigue el tema elegido con `CambioTema`, no solo el del sistema.
18. ★ **El service worker no guarda datos ni repite acciones.** Se registra `/sw.js` con alcance `/`. Al instalarse guarda solo `/sin-conexion` y lo que esa página necesita. En cada navegación va primero a la red y, sin red, responde `/sin-conexion`. Nunca guarda el HTML de otra ruta ni respuestas RSC, y no intercepta nada que no sea GET: las server actions pasan directo. No se activa `experimental.useOffline` de Next, porque reintenta las acciones al volver la conexión y eso puede duplicar un gasto. Una versión nueva toma el control en la siguiente apertura.
19. ★ **Guardar nunca miente.** Dado que tengo la captura abierta, cuando toco "Guardar gasto" y falla, entonces no aparece la confirmación, veo un mensaje junto al botón y lo escrito sigue en pantalla. No se encola ni se reintenta solo, y al volver a tocar "Guardar gasto" se registra una sola vez. Hay un mensaje por cada causa:
    - sin red: "Sin conexión: el gasto no se guardó.";
    - con la sesión vencida: "Tu sesión terminó: el gasto no se guardó. Entra de nuevo.";
    - con una versión vieja tras un despliegue: "La app se actualizó: recarga y vuelve a guardar.".

    Los formularios de categorías y sobres muestran el mismo mensaje y no pierden la pantalla.

20. **Sin conexión al abrir.** Dado que no hay red, cuando abro la app instalada o navego, entonces veo `/sin-conexion`, con el emblema, "Sin conexión", "Sin red no se puede registrar ni consultar. Tus datos siguen a salvo." y "Reintentar". Nunca se muestran saldos viejos.
21. **Velocidad.** Con sesión vigente, en el celular y con 4G o wifi, abrir la captura desde el icono o desde el acceso directo hasta tener el foco en el monto toma 2 s o menos con la app ya abierta antes, y "Guardar gasto" responde en 1 s o menos. Las funciones de Vercel corren en la misma región que la base de Supabase. Mientras el token siga vigente, verificar la sesión no agrega una ida al servidor de Auth en cada solicitud. Se mide con cronómetro y se anota en `progress.md`.

## Pantallas

**Cambio del desarrollador, 2026-10-14.** Lo que sigue sobre el marco de `/entrar` y `/sin-conexion` quedó así:

- **Acceso:** pantalla completa partida en dos. De un lado la marca: el verde pino con brillos menta y anillos, el emblema sobre un disco claro, "Arca", el lema y tres píldoras. Del otro, el formulario con el título "Entrar". En el celular (ajustado el mismo día), la marca es el fondo de toda la pantalla, con las tres píldoras, y el formulario va en una hoja clara que flota sobre ella.
- **App:** a pantalla completa también en escritorio, sin el panel flotante sobre el lienzo.
- **Marca:** el emblema con el nombre "Arca" (constante en `src/lib/marca.ts`) en lugar del cuadro con la "f" y "finanzas".

**Rutas nuevas** `/entrar` y `/sin-conexion`. Las rutas actuales no cambian de dirección. Se reparten en dos grupos:

- `src/app/(con-sesion)/`: el cascarón actual, con `BarraLateral`, `MenuMovil`, `TituloRuta` y el "+" flotante (`BotonFlotanteRegistrar`, que reemplazó a `NavInferior` el 2026-10-14).
- `src/app/(sin-sesion)/`: el lienzo y el panel, sin navegación.

El `layout.tsx` raíz conserva `<html>`, la fuente, el script del tema y los metadatos.

**`/entrar`, móvil.** Panel a pantalla completa, sin barra superior ni inferior. Una columna centrada en vertical, con 16 px de relleno lateral:

1. **Emblema** (pieza nueva) de 72 px.
2. "Finanzas" a 24 px y peso 800; debajo, "Cada dólar tiene un trabajo." en `texto-2`. **Quedó distinto el 2026-10-14:** "Arca" va en el lado de la marca, y el formulario lleva "Entrar" a 28 px; el detalle vigente está en `docs/diseno.md`, "Acceso y sin conexión".
3. Una `Tarjeta` con dos campos:
   - `Campo` "Correo", con una `Entrada` de `type="email"`, `autoComplete="username"` y `inputMode="email"`;
   - `Campo` "Contraseña", con una `Entrada` de `type="password"` y `autoComplete="current-password"`.
4. Un `Boton` `primario` a todo el ancho, de 52 px, que dice "Entrar".

El error se muestra encima del botón, en `negativo`, con `role="alert"`.

**`/entrar`, escritorio.** ~~El lienzo visible y el panel flotante, de 440 px de ancho y centrado, con el mismo contenido.~~ Desde el 2026-10-14, la pantalla partida en dos: la marca a la izquierda y el formulario, de hasta 400 px, a la derecha (`docs/diseno.md`, "Acceso y sin conexión"). Sin barra lateral.

**`/sin-conexion`.** El mismo marco que `/entrar`: el emblema, "Sin conexión" a 24 px y el texto del criterio 20 en `texto-2`. Abajo, un `Boton` `secundario` "Reintentar" que recarga la página. La página es estática: no consulta la base ni la sesión, porque se guarda al instalar.

**Salir.** En `BarraLateral`, abajo, junto a `CambioTema`, una fila con el icono `LogOut` de lucide y el texto "Salir", con la forma de `EnlaceLateral`. En `MenuMovil`, al final de la lista. Es un `<form>` con su server action, así que funciona sin JavaScript.

**Fallas al guardar** (criterio 19). Una línea en `negativo` con `role="alert"`, encima del botón "Guardar gasto". Usa el mismo estilo que el error de un `Campo`.

**Pieza nueva `Emblema`**, en `src/components/emblema.tsx`: el emblema del logo en SVG, con el tamaño por prop y `aria-label` con el nombre de la app, hoy "Arca" (`src/lib/marca.ts`). Sus colores son los del logo y no cambian con el tema, porque es una imagen de marca y no interfaz. Es la única excepción a "solo tokens", y se documenta en `docs/diseno.md`. La misma fuente genera los iconos con `ImageResponse`: el favicon, el `apple-icon` de 180 y los de 192, 512 y 512 adaptable del manifiesto. Ningún PNG se edita a mano.

## Datos

- **Tablas nuevas**: ninguna. Hay un solo usuario y vive en el esquema `auth` de Supabase, que Drizzle no administra. Quién entra lo decide `USUARIO_PERMITIDO`, no una tabla.
- **Migración 0003** con `pnpm db:generate`: activa RLS en `cuentas`, `sobres`, `categorias`, `movimientos`, `reglas_reparto` y `partidas_sobre`, con la API de RLS de Drizzle en `schema.ts` y sin SQL a mano. En local no cambia nada, porque el usuario `finanzas` es el dueño de las tablas. Se lanza `guardian-datos` antes de `pnpm db:migrate`.
- **Semillas**: sin cambios. En producción se corren una sola vez, con `pnpm db:seed:produccion`.
- **Demostración**: nunca en producción (criterio 10).
- **Datos existentes**: la base local sigue igual y sigue siendo la de desarrollo y demostración. Producción nace vacía, con las migraciones y las semillas, y no se le copia nada de la local.
- **Saldos en producción**: las cuentas arrancan en cero porque todavía no existen el saldo inicial (observación 3) ni los ingresos. Hasta esa feature, los gastos dejan las cuentas en negativo. Lo útil a diario es la captura y la lista de movimientos.
- **Variables de entorno**:
  - `DATABASE_URL`: en producción, el pooler de Supabase en modo transacción, con `?sslmode=require`;
  - `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY`, solo de servidor;
  - `USUARIO_PERMITIDO`.

  En local, `.env.local` apunta a la base de Docker y al proyecto de Supabase de desarrollo, y añade `HUMO_CORREO` y `HUMO_CLAVE` del usuario de prueba. La cadena de producción, que no se guarda en disco sino en el gestor de contraseñas y se pega en la terminal, es la del pooler de Supabase en modo sesión (puerto 5432, usuario `postgres.<ref>`, el mismo rol dueño de las tablas) con `?sslmode=require`, solo para migrar, sembrar y respaldar. No la conexión directa: en el plan gratuito es solo IPv6 y esta máquina no tiene IPv6 global; el modo transacción no sirve para `pg_dump`. (Corregido el 2026-10-13, en T3.) Los archivos `.env` los escribe el desarrollador, no el agente.

## Fuera de alcance

- Notificaciones push: el service worker queda listo, pero el push es de la fase 2 (ADR 0009).
- Registrar sin conexión con cola y reenvío (ADR 0009): sería otra feature.
- Recuperar la contraseña, cambiar el correo o tener varios usuarios desde la app. La contraseña se restablece desde el panel de Supabase.
- Segundo factor (TOTP), llaves de acceso (_passkeys_), y PIN o huella dentro de la app. La auditoría dirá si hacen falta.
- Una CSP completa con _nonce_ para las páginas; solo `/sw.js` lleva CSP.
- Dominio propio: la app queda en el subdominio de `vercel.app`.
- Un botón propio de "Instalar": en iPhone no funciona.
- El saldo inicial y la administración de cuentas (observación 3), los ingresos y el reparto.
- Vercel Cron y las reglas nocturnas.
- Copiar datos de la base local a producción.
- El emblema en la barra lateral o en la barra superior.

## Pruebas antes del código

Funciones puras con `.test.ts` al lado, vistas fallar antes de implementarlas:

- `src/lib/acceso.ts`:
  - `destinoSeguro(siguiente)`, para el criterio 4, con los casos `//evil.com`, `/\evil.com`, `https://x`, `javascript:alert(1)`, `/entrar`, vacío, `/sobres/3?x=1` y `/nuevo/gasto`;
  - `esUsuarioPermitido(correo, permitido)`, para el criterio 3, con mayúsculas, espacios, un permitido vacío o ausente (falla cerrado) y un correo que solo contiene al permitido.
- `src/lib/destino-base.ts`:
  - `esBaseLocal(url)`, para los criterios 10 y 11, con `localhost`, `127.0.0.1`, `[::1]`, el pooler de Supabase, una URL mal formada (no es local) y `localhost.evil.com` (no es local);
  - `describirBase(url)`, que devuelve `host:puerto/base` sin usuario ni contraseña, nunca con la contraseña aunque traiga caracteres escapados.

Las demás pruebas de los criterios ★ vienen en `/f-verify`:

- las reglas de estructura de los criterios 2 y 8;
- la prueba sobre el esquema del criterio 9, que se escribe con T2;
- el service worker cargado con un `self` simulado, para el criterio 18;
- los modos del humo, para los criterios 1, 13 y 14.

## Riesgos y decisiones

Decisiones de arquitectura que van al ADR 0010 con `/f-adr` en la última tarea:

- **El cliente de Supabase solo vive en el servidor.** Entrar y salir son server actions, y el proxy y las páginas leen la sesión desde las cookies. La clave publicable nunca llega al navegador y la API de datos queda apagada. Descartado: el cliente del navegador, que expone la clave y deja todo en manos de RLS.
- **Dos proyectos de Supabase.** "finanzas" es producción: base y Auth con el usuario real. "finanzas-dev" solo tiene Auth, con un usuario de prueba para el desarrollo local y el humo. La contraseña real nunca se guarda en disco. Descartado: Supabase local con su CLI, unos diez contenedores para un solo login; y un desvío de la autenticación en desarrollo, que puede colarse a producción.
- **Las migraciones de producción las aplica el desarrollador** con un comando aparte, no el build de Vercel. Un build que migra aplicaría cambios en cada despliegue.
- **El orden del primer despliegue** (criterio 13): primero la auditoría sobre la rama, luego el despliegue con la CLI, luego la validación en el celular instalado y, después de `/f-ship`, conectar el repositorio a Vercel. Si se conecta antes, Vercel publica `main` al instante, y `main` todavía no tiene la autenticación.

Riesgos aceptados o por confirmar:

- **Límite de intentos compartido.** Supabase limita los intentos por IP, y todos los intentos llegan desde la IP del servidor de Vercel. Un atacante no puede adivinar una contraseña larga, pero sí bloquear el inicio de sesión unos minutos. Las sesiones abiertas siguen funcionando. La contraseña se genera con el gestor de contraseñas. La auditoría lo revisa.
- **Proyectos en pausa.** Supabase gratuito pausa los proyectos tras siete días sin actividad. Producción se usa a diario; "finanzas-dev" puede pausarse y se reactiva desde el panel.
- **Versión vieja abierta tras un despliegue.** La acción de una página vieja puede fallar después de publicar. El criterio 19 obliga a decirlo y a no perder lo escrito. Skew Protection de Vercel puede no estar en el plan gratuito.
- **El emblema mide 310 px.** Se pide al desarrollador el logo original en SVG o en alta resolución. Si no lo tiene, se traza un SVG fiel a `docs/referencias/logo-emblema.png` y el desarrollador lo aprueba lado a lado antes de generar los iconos.
- **Colores repetidos.** El manifiesto y `themeColor` necesitan colores hexadecimales y no pueden leer los tokens. Repiten los de `panel-a`, como ya lo hace `layout.tsx`.
- **iPhone o Android.** El push de la fase 2 en iPhone exige la app instalada desde iOS 16.4. Por eso la instalación se valida en el celular real del desarrollador.
