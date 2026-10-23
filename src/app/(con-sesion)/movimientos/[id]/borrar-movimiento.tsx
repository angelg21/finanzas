"use client";

import { ArrowRight } from "lucide-react";
import { useActionState, useRef } from "react";
import { Boton, EnlaceBoton, ErrorCampo } from "@/components/formulario";
import { Cifra } from "@/components/ui";
import { formatearCifra } from "@/lib/dinero";
import type { VistaPrevia } from "@/lib/retiro";
import { borrarConFallas } from "./editar-con-fallas";
import type { EstadoBorrar } from "./valores";

type Datos = {
  id: number;
  tipo: "gasto" | "ingreso" | "pago" | "cobro";
  volver: string;
  /** "Se borran el gasto y la venta de 20,00 USDT." */
  queSeBorra: string;
  /** "Gastos del mes quedará en −12,00", si los hay. */
  avisos: string[];
  /** Por qué no se puede borrar ("Por asignar tiene 30,00; le faltan 770,00"): entonces no se ofrece. */
  impedido?: string;
  /** Cómo queda todo, y lo que se retira del reparto posterior (spec 007, criterio 11); su firma va con la confirmación. */
  previa?: VistaPrevia;
};

/** La misma página con `?borrar=1`, sin perder a dónde volver: un `?borrar=1` suelto borraría el `?volver=`. */
const conVuelta = (volver: string, borrar: boolean) =>
  `?volver=${encodeURIComponent(volver)}${borrar ? "&borrar=1" : ""}`;

const etiquetaDe = {
  gasto: "Borrar gasto",
  ingreso: "Borrar ingreso",
  pago: "Deshacer pago",
  cobro: "Deshacer cobro",
} as const;

/**
 * La confirmación con su formulario: en el `<dialog>` con JavaScript, o en la página con `?borrar=1` sin él. En la
 * página, "Cancelar" vuelve a la misma pantalla sin la confirmación (revisión de la 006, hallazgo 2).
 */
export function ConfirmarBorrado({
  id,
  tipo,
  volver,
  queSeBorra,
  avisos,
  impedido,
  previa,
  alCancelar,
}: Datos & { alCancelar?: () => void }) {
  const [estado, enviar, pendiente] = useActionState<EstadoBorrar, FormData>(borrarConFallas, {});
  return (
    <form action={enviar} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="volver" value={volver} />
      <input type="hidden" name="firma" value={previa?.firma ?? ""} />
      <p className="text-[15px] font-bold">{queSeBorra}</p>
      {previa && !impedido ? <ComoQueda previa={previa} /> : null}
      {avisos.map((a) => (
        <p key={a} className="text-[13px] font-semibold text-negativo">
          {a}
        </p>
      ))}
      <ErrorCampo>{estado.error ?? impedido}</ErrorCampo>
      <div className="flex gap-2">
        {impedido ? null : (
          <Boton type="submit" variante="peligro" disabled={pendiente} className="flex-1">
            {pendiente ? "Un momento…" : tipo === "pago" || tipo === "cobro" ? "Sí, deshacer" : "Sí, borrar"}
          </Boton>
        )}
        {alCancelar ? (
          <Boton type="button" variante="secundario" onClick={alCancelar} className="flex-1">
            Cancelar
          </Boton>
        ) : (
          <EnlaceBoton href={conVuelta(volver, false)} variante="secundario" className="flex-1">
            Cancelar
          </EnlaceBoton>
        )}
      </div>
    </form>
  );
}

/**
 * Lo que se retira del reparto posterior, si hace falta, y cada saldo que cambia, antes y después: lo que se ve es lo
 * que se aplica, porque la acción solo lo hace con esta misma firma (spec 007, criterio 11).
 */
function ComoQueda({ previa }: { previa: VistaPrevia }) {
  const retirado = previa.retirado.reduce((a, r) => a + r.centavos, 0);
  return (
    <div className="flex flex-col gap-2">
      {retirado > 0 ? (
        <p className="text-[13px] font-semibold text-texto-2">
          Ya se repartió: se retiran {formatearCifra(retirado)} de lo repartido después (
          {previa.retirado.map((r) => `${r.nombre} ${formatearCifra(r.centavos)}`).join(" · ")}), y el reparto los
          volverá a pedir.
        </p>
      ) : null}
      <p className="text-[12px] font-extrabold uppercase tracking-wide text-texto-2">Así queda</p>
      <ul className="flex flex-col gap-1.5">
        {previa.saldos.map((s) => (
          <li
            key={s.nombre}
            className="flex flex-wrap items-baseline justify-between gap-x-3 text-[13px] font-semibold"
          >
            <span className="min-w-0">{s.nombre}</span>
            <span className="flex items-center gap-1.5">
              <Cifra centavos={s.antes} moneda={s.moneda ?? "USD"} tamano="sm" tono="texto-2" />
              <ArrowRight size={12} aria-hidden className="text-texto-3" />
              <span className="sr-only">queda en</span>
              <Cifra
                centavos={s.despues}
                moneda={s.moneda ?? "USD"}
                tamano="sm"
                tono={s.despues < 0 ? "negativo" : "texto"}
              />
            </span>
          </li>
        ))}
      </ul>
    </div>
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
        href={conVuelta(datos.volver, true)}
        variante="peligro"
        onClick={(e) => {
          e.preventDefault();
          ventana.current?.showModal();
        }}
        className="mx-auto"
      >
        {etiquetaDe[datos.tipo]}
      </EnlaceBoton>
      <dialog
        ref={ventana}
        aria-label={etiquetaDe[datos.tipo]}
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
