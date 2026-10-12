---
name: defectos-datos-encontrados
description: Defectos y huecos de datos que encontré en auditorías (con fecha), para comprobar en la siguiente revisión si siguen abiertos
metadata:
  type: project
---

Antes de dar algo por cerrado, comprobar si estos puntos siguen abiertos.

**Abiertos**

- **2026-10-11.** El check `movimientos_forma_por_tipo` solo valida la forma. Medido con BEGIN/ROLLBACK, la base aceptó un gasto con sobre "Por asignar", categoría de ingreso, moneda VES desde una cuenta USDT y desde una cuenta inactiva. La acción de servidor tiene que validar los ids contra las consultas de cuentas, sobres y categorías activas, y tomar la moneda de la cuenta leída de la base. (Así se hizo en T4; vigilarlo en cada acción nueva que escriba movimientos.)
- **2026-10-11, sigue igual en T12.** `src/db/semilla-demo.ts` usa `tasa.toFixed(4)` y `Math.round(usd * tasa)` fuera de `dinero.ts`, y tiene una variable `bs` muerta. Es anterior a 001 y viola la regla de centavos.
- **2026-10-11.** Mezcla de demo y datos de prueba. Los gastos que se guardan desde el formulario llevan `origen=manual` y `referencia_externa=null`, así que `db:demo:limpiar` no los borra. Al limpiar la demo quedan saldos negativos (el cuadre se mantiene) y quedan datos inventados sin marcar.
- **2026-10-11.** La transacción de `registrarMovimientos` (drizzle → `client.begin` de postgres-js, con `prepare: false`) es correcta por diseño. No se pudo ejecutar contra el pooler de Supabase porque no hay pooler local. Queda pendiente para `/f-audit` antes de desplegar.
- **2026-10-11, T15.** Ventana residual del criterio 20. Un gasto se valida contra `categoriasDeGastoPorUso`. Si en ese momento confirma el cambio de tipo de una categoría sin movimientos, el gasto se inserta después con una categoría de ingreso (medido: 1 fila). Es el mismo hueco del check que solo valida la forma. Se cierra cuando `registrarMovimientos` compruebe el tipo de la categoría al insertar.
- **2026-10-11, T15.** El índice único `(tipo, nombre)` es exacto: la base aceptó "Mascotas" y "mascotas" a la vez. Solo `repetidaDe` (con `clave()`) lo detiene. `repetidaDe` devuelve la primera equivalente. Si ya existen una archivada y una activa equivalentes, restaurar una tercera las deja dos activas (medido con Gimnasio, GIMNASIO y gimnasio). La app no llega a ese estado por sí misma; el importador sí podría. El importador debe buscar una activa equivalente, no la primera.

**Cerrados**

- T3 de 001: `aCentavos`/`aTasa` aceptaban "0x10", "1e3" y redondeaban "1.005" en flotante. Se corrigió en b8c1a07; en T12 ya no hay `Number()` sobre el texto completo.
- T13 de 001 (bfd4636): la semilla ya no revive las categorías renombradas ni las borradas, porque solo inserta en una tabla vacía. Además, completa icono y color solo si las dos columnas siguen por defecto. Medido: Ocio→Diversión y Educación borrada no volvieron, una con (etiqueta, azul) quedó intacta, y (etiqueta, pizarra) recibió su icono, que es el residual aceptado.
- T15 de 001, corregido el 2026-10-11 (sin commit al revisar). `bloquearYContar` hace `for update` y luego cuenta. Con eso, `eliminarCategoria` en carrera archiva en vez de lanzar 23503, y `actualizarCategoria` devuelve "tipo-fijo" (también en carrera, y también a través de `guardarCategoria`). Restaurar con una activa equivalente redirige con `aviso=nombre`. La demo busca por (nombre, tipo): con un "Familia" de ingreso quedan 0 movimientos con el tipo cruzado. Todo medido.

Ver también [[prima-en-cuadre]], [[categorias-icono-color]] y [[entorno-de-prueba]].
