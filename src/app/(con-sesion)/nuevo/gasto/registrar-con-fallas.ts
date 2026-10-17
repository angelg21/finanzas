import { conFallas, mensajeDeFalla } from "@/lib/fallas";
import type { FormaPago } from "@/lib/gastos";
import { type EstadoGasto, type ValoresGasto, registrarGasto } from "./acciones";

const formas: readonly string[] = ["dolares", "vendiendo", "saldo"] satisfies FormaPago[];

/** Lo que se envió, para volver a llenar el formulario: los mismos campos que lee la acción. */
function tecleadoDe(datos: FormData): ValoresGasto {
  const leer = (nombre: keyof ValoresGasto) => {
    const valor = datos.get(nombre);
    return typeof valor === "string" ? valor : "";
  };
  const forma = leer("forma");
  return {
    forma: (formas.includes(forma) ? forma : "dolares") as FormaPago,
    monto: leer("monto"),
    tasa: leer("tasa"),
    vendido: leer("vendido"),
    cuentaId: leer("cuentaId"),
    cuentaVentaId: leer("cuentaVentaId"),
    categoriaId: leer("categoriaId"),
    sobreId: leer("sobreId"),
    fecha: leer("fecha"),
    nota: leer("nota"),
    // El mismo id: tocar "Guardar gasto" otra vez no duplica si el primer intento sí llegó.
    idCaptura: leer("idCaptura"),
    etiquetaId: leer("etiquetaId"),
    etiquetaNueva: leer("etiquetaNueva"),
  };
}

/**
 * Registrar el gasto sin que una falla borre la pantalla (spec 002, criterio 19): sin red o con una versión vieja,
 * la confirmación no aparece, el mensaje va junto al botón y lo escrito sigue ahí. Nada se reintenta solo.
 */
export const registrarConFallas = conFallas<EstadoGasto>(registrarGasto, (previo, datos, causa) => ({
  ronda: (previo?.ronda ?? 0) + 1,
  estado: "error",
  errores: { general: mensajeDeFalla(causa) },
  valores: tecleadoDe(datos),
}));
