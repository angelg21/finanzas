import { conFallas, mensajeDeFalla } from "@/lib/fallas";
import { guardarDeuda } from "./acciones";
import { type EstadoDeuda, tecleadoDe } from "./valores";

/**
 * Guardar la deuda sin que una falla borre la pantalla: sin red o con una versión vieja, el mensaje va junto al botón
 * y lo escrito sigue ahí, con el mismo id de captura. Nada se reintenta solo.
 */
export const guardarConFallas = conFallas<EstadoDeuda>(guardarDeuda, (previo, datos, causa) => ({
  ronda: (previo?.ronda ?? 0) + 1,
  estado: "error",
  errores: { general: mensajeDeFalla(causa, "la deuda no se guardó") },
  valores: tecleadoDe(datos),
}));
