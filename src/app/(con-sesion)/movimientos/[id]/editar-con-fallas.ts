import { conFallas, mensajeDeFalla } from "@/lib/fallas";
import type { FormaPago } from "@/lib/gastos";
import type { ValoresGasto } from "../../nuevo/gasto/acciones";
import { borrarMovimientoAccion, editarGastoAccion, editarIngresoAccion } from "./acciones";
import type { EstadoBorrar, EstadoEdicionGasto, EstadoEdicionIngreso, ValoresIngresoEditado } from "./valores";

/*
  Editar y borrar sin que una falla borre la pantalla (spec 006, criterio 9; spec 002, criterio 19): sin red, con una
  versión vieja o con un error desconocido, el mensaje va junto al botón y lo escrito sigue ahí. Nada se reintenta.
*/

const formas: readonly string[] = ["dolares", "vendiendo", "saldo"] satisfies FormaPago[];

function leer(datos: FormData, nombre: string) {
  const valor = datos.get(nombre);
  return typeof valor === "string" ? valor : "";
}

function gastoTecleado(datos: FormData): ValoresGasto {
  const forma = leer(datos, "forma");
  return {
    forma: (formas.includes(forma) ? forma : "dolares") as FormaPago,
    monto: leer(datos, "monto"),
    tasa: leer(datos, "tasa"),
    vendido: leer(datos, "vendido"),
    cuentaId: leer(datos, "cuentaId"),
    cuentaVentaId: leer(datos, "cuentaVentaId"),
    categoriaId: leer(datos, "categoriaId"),
    sobreId: leer(datos, "sobreId"),
    fecha: leer(datos, "fecha"),
    nota: leer(datos, "nota"),
    idCaptura: leer(datos, "idCaptura"),
    etiquetaId: leer(datos, "etiquetaId"),
    etiquetaNueva: leer(datos, "etiquetaNueva"),
  };
}

function ingresoTecleado(datos: FormData): ValoresIngresoEditado {
  return {
    monto: leer(datos, "monto"),
    cuentaId: leer(datos, "cuentaId"),
    categoriaId: leer(datos, "categoriaId"),
    fecha: leer(datos, "fecha"),
    nota: leer(datos, "nota"),
    etiquetaId: leer(datos, "etiquetaId"),
    etiquetaNueva: leer(datos, "etiquetaNueva"),
  };
}

export const editarGastoConFallas = conFallas<EstadoEdicionGasto>(editarGastoAccion, (previo, datos, causa) => ({
  ronda: (previo?.ronda ?? 0) + 1,
  estado: "error",
  errores: { general: mensajeDeFalla(causa, "no se guardó") },
  valores: gastoTecleado(datos),
}));

export const editarIngresoConFallas = conFallas<EstadoEdicionIngreso>(editarIngresoAccion, (previo, datos, causa) => ({
  ronda: (previo?.ronda ?? 0) + 1,
  estado: "error",
  errores: { general: mensajeDeFalla(causa, "no se guardó") },
  valores: ingresoTecleado(datos),
}));

export const borrarConFallas = conFallas<EstadoBorrar>(borrarMovimientoAccion, (_previo, _datos, causa) => ({
  error: mensajeDeFalla(causa, "no se borró"),
}));
