import { conFallas, mensajeDeFalla } from "@/lib/fallas";
import { completarVariosAccion } from "./acciones";
import { type EstadoVarios, tecleadoDe } from "./valores";

/** Completar varios sin que una falla borre la pantalla: el mensaje junto al botón y lo escrito sigue ahí. */
export const completarVariosConFallas = conFallas<EstadoVarios>(completarVariosAccion, (previo, datos, causa) => ({
  ronda: (previo?.ronda ?? 0) + 1,
  estado: "error",
  errores: { general: mensajeDeFalla(causa, "no se registró nada") },
  valores: tecleadoDe(datos),
}));
