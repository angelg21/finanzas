import { conFallas, mensajeDeFalla } from "@/lib/fallas";
import { prestarAccion } from "./acciones";
import { type EstadoPrestamo, tecleadoDe } from "./valores";

/**
 * Prestar sin que una falla borre la pantalla: sin red o con una versión vieja, el mensaje va junto al botón y lo
 * escrito sigue ahí, con el mismo id de captura. Nada se reintenta solo.
 */
export const prestarConFallas = conFallas<EstadoPrestamo>(prestarAccion, (previo, datos, causa) => ({
  ronda: (previo?.ronda ?? 0) + 1,
  estado: "error",
  errores: { general: mensajeDeFalla(causa, "el préstamo no se guardó") },
  valores: tecleadoDe(datos),
}));
