import { conFallas, mensajeDeFalla } from "@/lib/fallas";
import { type EstadoPorCompletar, tecleadoDe } from "../../nuevo/por-completar/valores";
import { editarPorCompletarAccion } from "./acciones";

/** Corregir sin que una falla borre la pantalla: el mensaje junto al botón y lo escrito sigue ahí (spec 010, ★ 5). */
export const editarPorCompletarConFallas = conFallas<EstadoPorCompletar>(
  editarPorCompletarAccion,
  (previo, datos, causa) => ({
    ronda: (previo?.ronda ?? 0) + 1,
    estado: "error",
    errores: { general: mensajeDeFalla(causa, "no se guardó") },
    valores: tecleadoDe(datos),
  }),
);
