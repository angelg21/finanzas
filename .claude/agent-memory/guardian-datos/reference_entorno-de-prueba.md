---
name: entorno-de-prueba
description: Límites del entorno al probar con datos: .env.local no se puede leer, contenedor finanzas-db, sondas marcadas demo-sonda-*, sin pooler de Supabase local
metadata:
  type: reference
---

- Leer `.env.local` con cat está denegado por permisos, y no hay que intentarlo. Las sondas lo cargan dentro del proceso con `process.loadEnvFile(".env.local")`, igual que los scripts del repo, sin imprimirlo.
- La base local es el contenedor Docker `finanzas-db` (usuario y base `finanzas`). En la misma máquina corren contenedores de otro proyecto (`supabase_*_rielco-platform`); no hay que tocarlos y no sirven como pooler de este proyecto.
- Las sondas de escritura se marcan con `referencia_externa = 'demo-sonda-NNN'`. Así las borra `db:demo:limpiar` y también un `delete ... like 'demo-sonda-%'` en un finally. Para mostrar lo que la base acepta, usar `begin; ...; rollback;` en psql.
- Un script tsx en el scratchpad que importa módulos del repo debe importarlos por URL de archivo (`pathToFileURL`), también `drizzle-orm` desde `node_modules` del repo, porque la resolución parte de la carpeta del script.

Ver también [[defectos-datos-encontrados]].
