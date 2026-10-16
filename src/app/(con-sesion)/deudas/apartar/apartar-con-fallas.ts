import { conFallas, mensajeDeFalla } from "@/lib/fallas";
import { apartarAccion } from "./acciones";
import { type EstadoApartado, tecleadoDe } from "./valores";

/**
 * Apartar sin que una falla borre la pantalla: sin red o con una versión vieja, el mensaje va junto al botón y lo
 * escrito sigue ahí, con el mismo id de captura. Nada se reintenta solo.
 */
export const apartarConFallas = conFallas<EstadoApartado>(apartarAccion, (previo, datos, causa) => ({
  ronda: (previo?.ronda ?? 0) + 1,
  estado: "error",
  errores: { general: mensajeDeFalla(causa, "no se apartó nada") },
  valores: tecleadoDe(datos),
}));
