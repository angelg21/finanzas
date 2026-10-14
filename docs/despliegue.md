# Despliegue

Cómo se publica la app y cómo se opera en producción. Decisiones en los ADR 0010 y 0011; la feature es la 002. Los pasos con cuentas externas o con la cadena de producción los hace el desarrollador; el agente nunca los corre ni ve esos secretos.

## Qué se guarda en el gestor de contraseñas

| Entrada                              | Para qué                                                                      |
| ------------------------------------ | ----------------------------------------------------------------------------- |
| Contraseña de la base de "finanzas"  | Va dentro de las dos cadenas de conexión                                      |
| Cadena del pooler en modo **sesión** | Migrar, sembrar y respaldar. Se pega en la terminal cuando un comando la pide |
| Contraseña del usuario de la app     | Entrar en la app. Larga y generada por el gestor                              |

Ninguna de las tres se escribe en un archivo, ni en el repo ni fuera de él, y nunca se pega en el chat con el agente.

## Primer despliegue

El orden importa (ADR 0010): auditoría hecha, base lista, despliegue desde la rama con la CLI, validación en el celular, `/f-ship` y, al final, conectar el repositorio a Vercel. Si se conecta antes, Vercel publica `main`, que todavía no tiene la autenticación.

### 1. Supabase: el proyecto "finanzas" de producción

1. **New project**, con el nombre `finanzas` y la región **East US (North Virginia)**, la misma que usará Vercel. Si eliges otra región, usa en el paso 4 la de Vercel más cercana.
2. **Database password**: toca **Generate a password**. Así sale solo con letras y cifras, sin caracteres que haya que escapar en la cadena. Guárdala en el gestor.
3. **Authentication → Sign In / Providers**:
   - apaga **Allow new users to sign up** y **Allow anonymous sign-ins**;
   - deja solo **Email**, sin ningún proveedor OAuth.
4. **Authentication → Users → Add user → Create new user**: tu correo real y una contraseña larga generada por el gestor. Marca **Auto Confirm User**.
5. **Project Settings → JWT Keys**: la clave en uso debe ser **ECC (P-256)**. Si dice _Legacy HS256_, migra y rota como en "finanzas-dev".
6. **Project Settings → Data API**: apaga **Enable Data API**.
7. **Project Settings → Database → SSL Configuration**: activa **Enforce SSL on incoming connections**.
8. **SQL Editor**: corre `select version();`. Debe decir PostgreSQL 15 o 17. Si dice 18, avisa antes de seguir: el `pg_dump` del respaldo es el 17 y se negaría.

### 2. Las dos cadenas de conexión

En el botón **Connect** del proyecto, pestaña de cadenas de conexión:

- **Session pooler** (puerto **5432**): copia el URI, cambia `[YOUR-PASSWORD]` por la contraseña de la base y agrega `?sslmode=require` al final. Guárdala en el gestor como "cadena del pooler en modo sesión". Es la de migrar, sembrar y respaldar.
- **Transaction pooler** (puerto **6543**): lo mismo, con `?sslmode=require` al final. Es el `DATABASE_URL` de Vercel. Se pega una sola vez, en el paso 4, y no hace falta guardarla aparte: se arma igual cuando se necesite.

La conexión directa (`db.<ref>.supabase.co`) no sirve desde esta computadora: en el plan gratuito es solo IPv6.

### 3. Migrar y sembrar producción

En una terminal de **PowerShell** dentro del proyecto: no en Git Bash, que no se presenta como terminal.

```powershell
pnpm db:migrate:produccion
```

Pide pegar la cadena del pooler en modo sesión; al pegarla no se ve nada, es normal. Después muestra el destino como `aws-0-…pooler.supabase.com:5432/postgres` y pide escribir `produccion`. Al terminar, todas las comprobaciones deben salir con ✓:

- cada tabla con RLS, sin FORCE y de quien conecta;
- ninguna vista que salte RLS;
- `anon` sin acceso al esquema `drizzle`;
- todas las migraciones aplicadas.

```powershell
pnpm db:seed:produccion
```

Lo mismo: pegar, revisar el destino y escribir `produccion`. Se corre **una sola vez**. Debe terminar con 5 cuentas, 7 sobres, 15 categorías y 6 reglas de reparto.

### 4. Vercel: el proyecto, sin conectar el repositorio

1. Instala la CLI con `npm i -g vercel` y entra con `vercel login`.
2. En la carpeta del proyecto, `vercel link`: crea un proyecto nuevo llamado `finanzas`. **No conectes el repositorio de Git.**
3. En el panel de Vercel, **Settings** del proyecto:
   - **Build and Deployment → Node.js Version**: 22.x.
   - **Functions → Function Region**: **Washington, D.C. (iad1)**, junto a Supabase en `us-east-1`.
   - **Environment Variables**: agrega las cuatro marcando **solo Production** (desmarca Preview y Development):

     | Variable                   | Valor                                                                |
     | -------------------------- | -------------------------------------------------------------------- |
     | `DATABASE_URL`             | la cadena del pooler en modo **transacción**, con `?sslmode=require` |
     | `SUPABASE_URL`             | la Project URL de "finanzas", **no** la de "finanzas-dev"            |
     | `SUPABASE_PUBLISHABLE_KEY` | la Publishable key de "finanzas"                                     |
     | `USUARIO_PERMITIDO`        | tu correo real, el del paso 1.4; **no** el del usuario de prueba     |

   - **Deployment Protection**: deja **Standard Protection**, para que las URL de cada despliegue no queden abiertas.

Nunca corras `vercel env pull`, `vercel pull` ni `vercel build`: escriben las variables de producción en disco. El hook del agente también los niega.

### 5. Desplegar desde la rama

```powershell
git switch feat/002-pwa-y-despliegue
vercel --prod
```

Al terminar, en el despliegue, pestaña **Source**: deben estar solo `src/`, `public/` y los archivos de configuración del `.vercelignore`. Nada de `docs/`, `data/`, `capturas/`, CSV ni archivos de entorno.

### 6. Comprobar

1. Pásale al agente la URL pública (`https://finanzas-xxxx.vercel.app`). Corre `pnpm humo -- --url <url> --sin-sesion`: redirecciones, cabeceras, métodos y la petición RSC sin datos.
2. Abre la URL en el celular y entra con tu usuario real. El usuario de prueba debe recibir "Correo o contraseña incorrectos.".
3. **Primer respaldo**, el mismo día. Docker tiene que estar corriendo (`pnpm db:up`):

   ```powershell
   pnpm db:respaldo:produccion
   ```

   Pide la cadena del pooler en modo sesión y `produccion`. Deja `data/respaldos/AAAA-MM-DD.sql`, que git ignora, y comprueba que restaurado da lo mismo que producción.

### 7. Después de `/f-ship`

En Vercel, **Settings → Git**: conecta el repositorio con `main` como rama de producción. Desde entonces, publicar `main` despliega.

## Operación

- **Migrar producción** cuando una feature traiga una migración: `pnpm db:migrate:produccion` antes de publicar el código que la usa, con la app sin uso. Los bloqueos de la migración pueden chocar con un gasto que se guarde en ese momento.
- **Respaldar**: `pnpm db:respaldo:produccion`. No incluye `auth.users`: si hubiera que rehacer el proyecto, el usuario se crea otra vez a mano.
- **Ataque al límite de intentos** (ADR 0010): si dejas de poder entrar con "Demasiados intentos", activa **Attack Challenge Mode** en Vercel (**Firewall**) y espera unos minutos.
- **Celular perdido o sesión robada** (ADR 0010):
  1. en el SQL Editor de producción, `delete from auth.sessions where user_id = (select id from auth.users where email = '<tu correo>');`;
  2. para cortar al instante, **JWT Keys → rota la clave**;
  3. cambia la contraseña.
- **Proyecto en pausa**: Supabase gratuito pausa tras siete días sin uso. Producción se usa a diario; "finanzas-dev" se reactiva desde el panel.
