"use client";

import { useActionState, useRef } from "react";
import { Boton, EnlaceBoton, ErrorCampo } from "@/components/formulario";
import { borrarConFallas } from "./editar-con-fallas";
import type { EstadoBorrar } from "./valores";

type Datos = {
  id: number;
  tipo: "gasto" | "ingreso";
  volver: string;
  /** "Se borran el gasto y la venta de 20,00 USDT." */
  queSeBorra: string;
  /** "Gastos del mes quedará en −12,00", si los hay. */
  avisos: string[];
  /** Por qué no se puede borrar ("Por asignar tiene 30,00; le faltan 770,00"): entonces no se ofrece. */
  impedido?: string;
};

/** La confirmación con su formulario: en el `<dialog>` con JavaScript, o en la página con `?borrar=1` sin él. */
export function ConfirmarBorrado({
  id,
  tipo,
  volver,
  queSeBorra,
  avisos,
  impedido,
  alCancelar,
}: Datos & { alCancelar?: () => void }) {
  const [estado, enviar, pendiente] = useActionState<EstadoBorrar, FormData>(borrarConFallas, {});
  return (
    <form action={enviar} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="volver" value={volver} />
      <p className="text-[15px] font-bold">{queSeBorra}</p>
      {avisos.map((a) => (
        <p key={a} className="text-[13px] font-semibold text-negativo">
          {a}
        </p>
      ))}
      <ErrorCampo>{estado.error ?? impedido}</ErrorCampo>
      <div className="flex gap-2">
        {impedido ? null : (
          <Boton type="submit" variante="peligro" disabled={pendiente} className="flex-1">
            {pendiente ? "Borrando…" : "Sí, borrar"}
          </Boton>
        )}
        {alCancelar ? (
          <Boton type="button" variante="secundario" onClick={alCancelar} className="flex-1">
            Cancelar
          </Boton>
        ) : null}
      </div>
    </form>
  );
}

/**
 * "Borrar gasto" o "Borrar ingreso" (spec 006, criterios 6 y 7). Sin JavaScript es un enlace a `?borrar=1`, que
 * muestra la confirmación en la página; con él abre la misma confirmación en un `<dialog>`, como el calendario.
 */
export function BotonBorrar(datos: Datos) {
  const ventana = useRef<HTMLDialogElement>(null);
  return (
    <>
      <EnlaceBoton
        href="?borrar=1"
        variante="peligro"
        onClick={(e) => {
          e.preventDefault();
          ventana.current?.showModal();
        }}
        className="mx-auto"
      >
        {datos.tipo === "gasto" ? "Borrar gasto" : "Borrar ingreso"}
      </EnlaceBoton>
      <dialog
        ref={ventana}
        aria-label={datos.tipo === "gasto" ? "Borrar gasto" : "Borrar ingreso"}
        onClick={(e) => {
          if (e.target === e.currentTarget) ventana.current?.close();
        }}
        className="m-auto w-[340px] max-w-[calc(100vw-32px)] rounded-[20px] border border-tarjeta-borde bg-tarjeta p-5 text-texto shadow-panel backdrop:bg-velo"
      >
        <ConfirmarBorrado {...datos} alCancelar={() => ventana.current?.close()} />
      </dialog>
    </>
  );
}
