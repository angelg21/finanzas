import { conFallas, mensajeDeFalla } from "@/lib/fallas";
import { transferirAccion } from "./acciones";
import { type EstadoTransferir, tecleadoDe } from "./valores";

/**
 * Transferir sin que una falla borre la pantalla (spec 002, criterio 19): sin red o con una versión vieja, el mensaje
 * va junto al botón y lo escrito sigue ahí, con el mismo id de captura. Nada se reintenta solo.
 */
export const transferirConFallas = conFallas<EstadoTransferir>(transferirAccion, (previo, datos, causa) => ({
  ronda: (previo?.ronda ?? 0) + 1,
  estado: "error",
  errores: { general: mensajeDeFalla(causa, "no se transfirió nada") },
  valores: tecleadoDe(datos),
}));
