"use client";

import { useActionState } from "react";
import { Boton, ErrorCampo } from "@/components/formulario";
import { conFallas, mensajeDeFalla } from "@/lib/fallas";
import { type EstadoBoton, eliminarCategoriaAccion } from "../acciones";

/** Sin red o con una versión vieja, el mensaje sobre el botón y la pantalla en su sitio (spec 002, criterio 19). */
const eliminarConFallas = conFallas<EstadoBoton>(eliminarCategoriaAccion, (_previo, _datos, causa) => ({
  error: mensajeDeFalla(causa, "no se guardó"),
}));

/** "Sí, eliminar" o "Sí, archivar", dentro de la confirmación de editar categoría (spec 001, criterio 21). */
export function BotonEliminarCategoria({ id, archivar }: { id: number; archivar: boolean }) {
  const [estado, enviar, pendiente] = useActionState<EstadoBoton, FormData>(eliminarConFallas, {});
  return (
    <form action={enviar} className="flex flex-col items-start gap-2">
      <input type="hidden" name="id" value={id} />
      <ErrorCampo>{estado.error}</ErrorCampo>
      <Boton type="submit" variante="peligro" disabled={pendiente}>
        {archivar ? "Sí, archivar" : "Sí, eliminar"}
      </Boton>
    </form>
  );
}
