"use client";

import { useActionState } from "react";
import { Boton, EnlaceBoton, ErrorCampo } from "@/components/formulario";
import { conFallas, mensajeDeFalla } from "@/lib/fallas";
import { type EstadoDescartar, descartarAccion } from "./acciones";

const descartarConFallas = conFallas<EstadoDescartar>(descartarAccion, (_previo, _datos, causa) => ({
  error: mensajeDeFalla(causa, "no se descartó"),
}));

/** "¿Descartar «Arepas»?" con su botón; sin JavaScript también, porque se llega con `?descartar=`. */
export function ConfirmarDescarte({ id, que }: { id: number; que: string }) {
  const [estado, enviar, pendiente] = useActionState<EstadoDescartar, FormData>(descartarConFallas, {});
  return (
    <form action={enviar} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <p className="text-[15px] font-bold">¿Descartar «{que}»? No se registra ningún gasto.</p>
      <ErrorCampo>{estado.error}</ErrorCampo>
      <div className="flex gap-2">
        <Boton type="submit" variante="peligro" disabled={pendiente} className="flex-1">
          {pendiente ? "Descartando…" : "Sí, descartar"}
        </Boton>
        <EnlaceBoton href="/por-completar" variante="secundario" className="flex-1">
          Cancelar
        </EnlaceBoton>
      </div>
    </form>
  );
}
