import { conFallas, mensajeDeFalla } from "@/lib/fallas";
import { repartir } from "./acciones";
import { type EstadoRepartir, tecleadoDe } from "./valores";

/** Repartir sin que una falla borre la pantalla: el mensaje va junto al botón y lo escrito sigue ahí. */
export const repartirConFallas = conFallas<EstadoRepartir>(repartir, (previo, datos, causa) => ({
  ronda: (previo?.ronda ?? 0) + 1,
  estado: "error",
  errores: { general: mensajeDeFalla(causa, "el reparto no se guardó") },
  valores: tecleadoDe(datos),
}));
