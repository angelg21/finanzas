import { conFallas, mensajeDeFalla } from "@/lib/fallas";
import { cobrarPrestamoAccion, pagarDeudaAccion } from "./acciones";
import { type EstadoPago, tecleadoDe } from "./valores";

/**
 * Pagar o cobrar sin que una falla borre la pantalla: sin red o con una versión vieja, el mensaje va junto al botón y lo
 * escrito sigue ahí, con el mismo id de captura. Nada se reintenta solo.
 */
export const pagarConFallas = conFallas<EstadoPago>(pagarDeudaAccion, (previo, datos, causa) => ({
  ronda: (previo?.ronda ?? 0) + 1,
  estado: "error",
  errores: { general: mensajeDeFalla(causa, "el pago no se guardó") },
  valores: tecleadoDe(datos),
}));

export const cobrarConFallas = conFallas<EstadoPago>(cobrarPrestamoAccion, (previo, datos, causa) => ({
  ronda: (previo?.ronda ?? 0) + 1,
  estado: "error",
  errores: { general: mensajeDeFalla(causa, "el cobro no se guardó") },
  valores: tecleadoDe(datos),
}));
