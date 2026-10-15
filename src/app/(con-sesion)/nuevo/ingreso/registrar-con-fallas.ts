import { conFallas, mensajeDeFalla } from "@/lib/fallas";
import { registrarIngreso } from "./acciones";
import { type EstadoIngreso, tecleadoDe } from "./valores";

/**
 * Registrar el ingreso sin que una falla borre la pantalla: sin red o con una versión vieja, la confirmación no
 * aparece, el mensaje va junto al botón y lo escrito sigue ahí, con el mismo id de captura. Nada se reintenta solo.
 */
export const registrarConFallas = conFallas<EstadoIngreso>(registrarIngreso, (previo, datos, causa) => ({
  ronda: (previo?.ronda ?? 0) + 1,
  estado: "error",
  errores: { general: mensajeDeFalla(causa, "el ingreso no se guardó") },
  valores: tecleadoDe(datos),
}));
