# 0011 · La cadena de producción no se guarda en disco, y lo que la segunda vuelta de la auditoría deja aceptado

Fecha: 2026-10-14. Estado: aceptada. Reemplaza en el ADR 0010 la decisión de guardarla fuera del repo.

## Contexto

El ADR 0010 sacó la cadena de conexión de producción del repo a un archivo en la carpeta personal, protegido con reglas `deny` y un hook que niega los comandos que lo nombren. La segunda vuelta de la auditoría T14 mostró que un hook que mira el texto del comando no alcanza. Se le escapan comodines, comillas partidas, nombres cortos de Windows, `node -e` con el nombre armado por partes, búsquedas que no nombran el archivo y opciones de Vercel antes del subcomando. Con un archivo en disco, el agente puede leer la llave maestra de producción, por descuido o por una instrucción escondida en algo que lea.

## Decisión

- La cadena de producción **no existe en ningún archivo**. Se guarda en el gestor de contraseñas.
- `pnpm db:migrate:produccion`, `db:seed:produccion` y `db:respaldo:produccion` la piden en la terminal, que ya era obligatoria. Al pegarla no se ve en pantalla.
- Después muestran el destino como `host:puerto/base`, exigen `sslmode=require` y piden escribir `produccion`.
- El hook `comandos.mjs` y las reglas `deny` se quedan como segunda capa para los archivos de entorno de desarrollo y para `.vercel/`.
- **Riesgo aceptado: el proxy no es barrera para una petición RSC sin sesión.** Next le quita al proxy la cabecera `rsc` y el `?_rsc`, así que un POST con `next-action` y `rsc` se ve igual que una server action, y Next renderiza la página.
  - Lo frena la segunda capa: toda página, `generateMetadata`, layout o template async y archivo `"use server"` empieza exigiendo la sesión, y ningún layout consulta la base. Lo vigila la regla de estructura.
  - La respuesta trae la redirección a `/entrar` y ningún dato. `pnpm humo` lo comprueba también contra producción.

## Consecuencias

- Nadie que solo tenga acceso al disco o a la transcripción del agente puede leer la cadena de producción.
- Cada migración, siembra o respaldo de producción pide pegar la cadena. Son pocas veces al mes y ya pedían confirmación.
- Un script no puede correr contra producción sin una persona en la terminal.

## Alternativas descartadas

- **El archivo en la carpeta personal con el hook (ADR 0010):** lo dificulta, pero no lo impide.
- **Un hook más estricto que mire también el contenido de los scripts:** sigue siendo una lista de patrones que siempre tiene salidas.
- **Frenar en el proxy los POST con la cabecera `rsc`:** el proxy no la ve.
