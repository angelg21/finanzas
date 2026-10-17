"use client";

import { useActionState } from "react";
import { Boton, ErrorCampo } from "@/components/formulario";
import { conFallas, mensajeDeFalla } from "@/lib/fallas";
import { type EstadoBorrar, borrarDeudaAccion } from "../../acciones";

/** Sin red o con una versión vieja, el mensaje sobre el botón y la deuda en pantalla (spec 002, criterio 19). */
const borrarConFallas = conFallas<EstadoBorrar>(borrarDeudaAccion, (_previo, _datos, causa) => ({
  error: mensajeDeFalla(causa, "la deuda no se borró"),
}));

/** "Borrar", al pie de editar una deuda sin movimientos (spec 005, criterio 16). */
export function BotonBorrarDeuda({ id }: { id: number }) {
  const [estado, enviar, pendiente] = useActionState<EstadoBorrar, FormData>(borrarConFallas, {});
  return (
    <form
      action={enviar}
      className="mt-4 flex flex-col items-center gap-1 border-t border-tarjeta-borde pt-3 text-center"
    >
      <input type="hidden" name="id" value={id} />
      <ErrorCampo>{estado.error}</ErrorCampo>
      <Boton type="submit" variante="peligro" disabled={pendiente}>
        Borrar
      </Boton>
    </form>
  );
}
