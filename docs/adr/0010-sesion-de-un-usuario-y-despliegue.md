# 0010 · Sesión de un solo usuario solo en el servidor, despliegue a mano y riesgos aceptados de la auditoría

Fecha: 2026-10-14. Estado: aceptada.

## Contexto

La feature 002 publica la app, con todo el historial financiero, para usarla a diario desde el celular. Hay un solo usuario. El riesgo del proyecto está en el dinero y los datos personales, no en la escala. La auditoría completa de la rama (T14) corrigió la redirección abierta, la lectura sin sesión por métodos raros, el TLS opcional, la cadena de producción al alcance del agente y los datos en los registros. Dejó tres riesgos que el desarrollador decidió aceptar. Este registro fija las decisiones que cuesta deshacer y esos riesgos.

## Decisión

- **Supabase Auth solo en el servidor.**
  - Entrar y salir son server actions. El navegador no tiene cliente de Supabase ni variables `NEXT_PUBLIC_`.
  - Las cookies van `HttpOnly`, `SameSite=Lax` y, en producción, `Secure`.
  - `getClaims` verifica el token en local con claves asimétricas (ES256).
- **Un solo usuario.**
  - Lo decide `USUARIO_PERMITIDO`: si falta, nadie entra.
  - El registro está apagado en los dos proyectos.
- **Tres capas de sesión.**
  - El proxy redirige las navegaciones y responde 405 a todo lo que no sea GET, HEAD o POST.
  - Cada página, `generateMetadata`, layout async, `route.ts` y archivo `"use server"` fuera de `(sin-sesion)` verifica la sesión antes que nada. Lo exige `scripts/estructura.mjs`.
  - Las acciones con estado responden "Tu sesión terminó" sin redirigir.
- **Dos proyectos de Supabase.**
  - "finanzas" es producción: base y Auth.
  - "finanzas-dev" solo tiene Auth, con un usuario de prueba para desarrollar y para el humo.
- **Base.**
  - RLS sin políticas en todas las tablas, y la Data API apagada.
  - La app entra como **dueña** de las tablas, nunca con un rol sin propiedad: con RLS, ese rol vería cero filas sin dar error.
  - TLS obligatorio (`sslmode=require`) en la app y en los scripts, con "Enforce SSL" en Supabase.
- **Producción a mano.**
  - Migrar, sembrar y respaldar solo con los comandos `:produccion`, que corre el desarrollador en una terminal.
  - La cadena de conexión vive fuera del repo, en la carpeta personal.
  - El agente no la lee ni corre esos comandos: reglas `deny` en `.claude/settings.json` y el hook `comandos.mjs`.
  - El build de Vercel no migra.
- **Orden del primer despliegue.**
  1. La auditoría sobre la rama.
  2. El despliegue con la CLI desde la rama.
  3. La validación en el celular.
  4. `/f-ship`.
  5. Conectar el repositorio a Vercel.
- **Guardar nunca miente.**
  - `conFallas` convierte las fallas de red y de versión en estado del formulario. Para que siga funcionando sin JavaScript, copia las marcas internas de React (`$$FORM_ACTION`, `$$IS_SIGNATURE_EQUAL`, `bind`).
  - Cada captura de gasto lleva un UUID en `referencia_externa`, y un reintento solo se toma como "ya estaba" si es lo mismo y reciente.

**Riesgos aceptados (auditoría T14):**

- **Límite de intentos compartido (hallazgo 3).** Todo sale de la IP de Vercel, y Supabase limita entrar y renovar juntos. Alguien puede dejar fuera al dueño un rato, pero no adivinar la contraseña ni leer datos.
  - Ante un ataque: "Attack Challenge Mode" de Vercel y esperar a que se libere el límite.
  - Si llega a pasar, se agrega un límite propio o una regla del firewall.
- **TLS sin verificar el certificado (hallazgo 5).** Vercel y Supabase corren en la misma región. Se revisa si se respalda o migra desde redes que no son de confianza.
- **Una sesión robada no tiene corte inmediato (hallazgo 6).** "Salir" cierra solo este dispositivo, y un token revocado sirve hasta su vencimiento (una hora). Procedimiento:
  1. borrar las filas del usuario en `auth.sessions` desde el editor SQL de producción;
  2. para un corte inmediato, rotar la clave de firma JWT;
  3. cambiar la contraseña.
- **Menores:**
  - `reglas_reparto.valor` es integer, con el tope validado en la acción;
  - un tipo de categoría desconocido se guarda como gasto;
  - la restauración del respaldo corre como superusuario local;
  - `auth.users` no entra en el respaldo;
  - la ventana de 15 minutos del reintento: dos gastos idénticos con el mismo id en ese lapso cuentan como uno.

## Consecuencias

- Sin sesión, solo responden `/entrar`, `/sin-conexion`, el manifiesto, el service worker y los iconos. Una ruta nueva queda cubierta sin tocar el proxy, y la regla de estructura rechaza la que olvide la sesión.
- La clave publicable no protege nada por sí sola: lo protegen la Data API apagada y RLS.
- `conFallas` depende de internas de React: al actualizar React hay que repetir la prueba de los formularios sin JavaScript.
- Cada migración de producción es un paso humano, más lento pero sin sorpresas en un despliegue.
- El agente no puede leer ni usar la cadena de producción. Los scripts que la necesitan la leen por dentro.
- Los riesgos aceptados y su procedimiento van en `docs/despliegue.md`.

## Alternativas descartadas

- **Cliente de Supabase en el navegador:** expone la clave y deja todo en manos de RLS.
- **Supabase local con su CLI:** unos diez contenedores para un solo inicio de sesión.
- **Un desvío de la autenticación en desarrollo:** puede colarse a producción.
- **Migrar en el build de Vercel:** aplicaría cambios en cada despliegue.
- **Conectar el repositorio a Vercel antes de `/f-ship`:** publicaría `main` sin autenticación.
- **`verify-full` con el certificado raíz de Supabase:** más pasos en el despliegue y en `pg_dump` para un riesgo bajo en la misma región. Se revisa si cambia la red.
- **Un límite de intentos propio en la función:** en Vercel sin servidor cada instancia cuenta por su lado. Si hace falta, mejor el firewall.
- **TOTP, llaves de acceso o PIN:** no hacen falta con una sola cuenta, el registro apagado y una contraseña larga del gestor. Se reconsideran cuando el push muestre datos con la pantalla bloqueada (fase 2).
- **Formularios solo con JavaScript para poder atrapar las fallas:** rompería la regla de que funcionen sin él.
