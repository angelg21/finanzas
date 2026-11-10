# 013 · Administrar cuentas

Fecha: 2026-11-10. Estado: construida.

## Para qué

Hoy las cuentas solo se crean con la semilla o el importador: el desarrollador no puede abrir una nueva (Zinli llegó por
el importador), quitar una que ya no usa ni cambiar cómo se ve. Pidió poder crear, eliminar una que esté en 0 y cambiar
colores e iconos desde la interfaz, ya.

## Trazabilidad al plan

Plan, sección 4, fase 1: "falta administrar cuentas (observación 3)". Es la observación 3 de `docs/observaciones.md`,
con dos ajustes que se dicen abajo: el saldo inicial queda fuera y el riesgo del guardián (feature 006) se resuelve
mostrando la archivada si su saldo deja de ser 0.

## Criterios de aceptación

1. Dado Cuentas, cuando toco "Nueva cuenta", entonces llego a un formulario con nombre, moneda, tipo, icono (con el
   buscador de las categorías) y color, con una vista previa del círculo.
2. ★ Dado el formulario de cuenta nueva, cuando la creo, entonces aparece en Cuentas con saldo 0, al final de la lista,
   y el cuadre de sobres y cuentas no cambia.
3. ★ Dado un nombre igual a otra cuenta, activa o archivada (sin importar mayúsculas ni acentos), cuando guardo,
   entonces no se guarda y el mensaje lo dice; si es una archivada, dice que se restaura desde Cuentas.
4. Dado Cuentas, cuando toco una cuenta, entonces llego a editarla: nombre, tipo, icono y color siempre; la moneda solo si
   no tiene movimientos.
5. ★ Dada una cuenta con movimientos, cuando intento cambiar su moneda (también enviando el formulario a mano), entonces
   no cambia: sus montos están en esa moneda.
6. Dada una cuenta con icono y color elegidos, entonces Cuentas y el inicio la pintan con ellos; una que nunca se editó
   se sigue viendo como hoy (por tipo y moneda).
7. ★ Dada una cuenta con saldo distinto de 0, cuando abro eliminar, entonces no hay botón: dice que primero se pasa el
   dinero a otra cuenta; y si la acción llega a mano, tampoco se elimina.
8. ★ Dada una cuenta con saldo 0 y sin movimientos ni deudas que la usen, cuando la elimino, entonces se borra del todo.
9. ★ Dada una cuenta con saldo 0 y con historial, cuando la elimino, entonces se archiva: deja de verse en Cuentas y
   al registrar, y sus movimientos la conservan.
10. ★ Dada una cuenta archivada cuyo saldo deja de ser 0 (por editar o deshacer un movimiento viejo), entonces vuelve a
    verse en Cuentas marcada "archivada" y el cuadre sigue diciendo la verdad; pero no se ofrece al registrar (ni se
    elige sola como la cuenta de bolívares): para usarla, se restaura.
11. Dada una cuenta archivada, cuando toco "Restaurar" en la sección de archivadas de Cuentas, entonces vuelve a la lista
    y a los formularios de registro.
12. ★ Dada una cuenta en 0 que es la cuenta prevista de una deuda con algo pendiente, cuando abro eliminar, entonces no
    hay botón y dice que se cambie primero en la deuda: archivarla borraría su aviso de liquidez (del guardián).

## Pantallas

- **Cuentas**: la tarjeta "Mis cuentas" lleva cada fila como enlace a editar y, al pie, "Nueva cuenta". Si hay
  archivadas, debajo una tarjeta "Archivadas" con cada una y su botón "Restaurar".
- **Nueva cuenta / Editar cuenta** (`/cuentas/nueva`, `/cuentas/[id]`): el formulario de categoría adaptado (Tarjeta a 7
  columnas, vista previa en TarjetaPalida a 5 en escritorio y arriba en móvil). Moneda y tipo con SelectorPildoras.
  Debajo, al editar, la confirmación "Eliminar cuenta" o "Archivar cuenta" en un `<details>`, como en categorías.
- Sin piezas nuevas: CirculoCuenta acepta icono y color y, si los tiene, pinta como CirculoCategoria.

## Datos

- `cuentas.icono` y `cuentas.color`, texto, **nulos**: nulo es "el aspecto automático de hoy". Migración generada con
  `pnpm db:generate`, sin tocar datos. Semilla y demostración no cambian.
- Catálogo de iconos: se añade `bitcoin` al grupo Dinero (también lo podrán usar las categorías).
- Los saldos siguen saliendo de los movimientos; crear una cuenta no inserta nada más que la fila.

## Fuera de alcance

- Saldo inicial al crear (observación 3): para poner dinero en una cuenta nueva se usa Transferir o un ingreso.
- Cambiar "a nombre de un tercero", la nota y el orden de las cuentas.

## Pruebas antes del código

`src/lib/cuentas.test.ts`: `validarCuenta` (nombre vacío, largo, repetido con activa o archivada, moneda y tipo fuera del
catálogo, icono y color fuera del catálogo, moneda fija con movimientos) y `destinoAlEliminarCuenta` (con saldo no se
puede; sin usos se borra; con usos se archiva).

## Riesgos y decisiones

- El guardián (feature 006) pidió impedir editar movimientos de una archivada o no archivar con historial. Se elige
  una tercera vía más simple: solo se archiva con saldo 0, y `cuentasDelCuadre` (la lista de `/cuentas`) muestra también
  las archivadas cuyo saldo no es 0. El cuadre nunca esconde dinero y no hay que bloquear ediciones. `saldosPorCuenta`,
  la lista de los formularios, sigue siendo solo de activas: el guardián de la 013 midió que, si no, un gasto en Bs caía
  en una cuenta de bolívares archivada.
- Una cuenta en bolívares rara vez queda en 0 en USD (las tasas de entrada y salida difieren), así que casi nunca se
  podrá quitar; la pantalla lo explica en vez de pedir una transferencia imposible.
- `pnpm db:seed` crea por nombre las cuentas de la semilla: si se renombra o se borra una de ellas y se vuelve a sembrar,
  aparece de nuevo. La semilla solo se corre al montar una base, así que no se cambia aquí.
- Eliminar bloquea la fila de la cuenta (FOR UPDATE) y cuenta usos y saldo dentro de la transacción: un movimiento que
  se esté guardando con esa cuenta termina antes de contar, como en categorías.
