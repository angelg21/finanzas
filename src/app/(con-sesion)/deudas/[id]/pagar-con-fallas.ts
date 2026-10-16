import { conFallas, mensajeDeFalla } from "@/lib/fallas";
import { pagarDeudaAccion } from "./acciones";
import { type EstadoPago, tecleadoDe } from "./valores";

/**
 * Pagar sin que una falla borre la pantalla: sin red o con una versión vieja, el mensaje va junto al botón y lo escrito
 * sigue ahí, con el mismo id de captura. Nada se reintenta solo.
 */
export const pagarConFallas = conFallas<EstadoPago>(pagarDeudaAccion, (previo, datos, causa) => ({
  ronda: (previo?.ronda ?? 0) + 1,
  estado: "error",
  errores: { general: mensajeDeFalla(causa, "el pago no se guardó") },
  valores: tecleadoDe(datos),
}));
