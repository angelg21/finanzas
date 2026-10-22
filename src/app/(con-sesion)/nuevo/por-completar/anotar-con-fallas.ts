import { conFallas, mensajeDeFalla } from "@/lib/fallas";
import { anotarAccion } from "./acciones";
import { type EstadoPorCompletar, tecleadoDe } from "./valores";

/** Anotar sin que una falla borre la pantalla: el mensaje junto al botón y lo escrito sigue ahí, con el mismo id. */
export const anotarConFallas = conFallas<EstadoPorCompletar>(anotarAccion, (previo, datos, causa) => ({
  ronda: (previo?.ronda ?? 0) + 1,
  estado: "error",
  errores: { general: mensajeDeFalla(causa, "no se anotó") },
  valores: tecleadoDe(datos),
}));
