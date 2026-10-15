import { conFallas, mensajeDeFalla } from "@/lib/fallas";
import { guardarReglasDeReparto } from "./acciones";
import { type EstadoReglas, tecleadoDe } from "./valores";

/** Guardar las reglas sin que una falla borre la pantalla: el mensaje va junto al botón y lo escrito sigue ahí. */
export const guardarConFallas = conFallas<EstadoReglas>(guardarReglasDeReparto, (previo, datos, causa) => ({
  ronda: (previo?.ronda ?? 0) + 1,
  estado: "error",
  errores: { general: mensajeDeFalla(causa, "las reglas no se guardaron") },
  valores: tecleadoDe(datos),
}));
