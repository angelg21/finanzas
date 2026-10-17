import { conFallas, mensajeDeFalla } from "@/lib/fallas";
import { type EstadoBoton, restaurarCategoriaAccion } from "./acciones";

/**
 * Restaurar una archivada sin que una falla borre la pantalla: sin red o con una versión vieja, el mensaje va junto al
 * botón, en la lista de archivadas o bajo el nombre al crear. Nada se reintenta solo (spec 002, criterio 19).
 */
export const restaurarConFallas = conFallas<EstadoBoton>(restaurarCategoriaAccion, (_previo, _datos, causa) => ({
  error: mensajeDeFalla(causa, "no se guardó"),
}));
