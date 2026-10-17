"use client";

import { Plus, Search, X } from "lucide-react";
import { useState } from "react";
import { coincidenConEtiqueta, etiquetaIgual } from "@/lib/etiquetas";
import { Entrada, ErrorCampo, pildoraNormal, pildoraOpcion } from "./formulario";

type Etiqueta = { id: number; nombre: string };

const estiloPildora = `${pildoraOpcion} ${pildoraNormal} group-hover:text-texto group-has-checked:border-transparent group-has-checked:bg-palido group-has-checked:text-palido-texto group-has-focus-visible:ring-2 group-has-focus-visible:ring-palido group-has-focus-visible:ring-offset-2 group-has-focus-visible:ring-offset-tarjeta`;

/**
 * "Etiquetas" (spec 008): las que existen, en píldoras; tocar una la elige y tocar la elegida la quita. "+ Añadir
 * etiqueta" y la lupa abren el mismo campo: lo que se escribe filtra las píldoras y, si no hay una igual, se crea al
 * guardar. Envía `etiquetaId` (la elegida) o `etiquetaNueva` (lo escrito, que manda). Sin JavaScript, el campo está
 * siempre a la vista y hay una opción "Sin etiqueta".
 */
export function SelectorEtiqueta({
  etiquetas,
  valorInicial,
  nuevaInicial = "",
  error,
}: {
  etiquetas: Etiqueta[];
  valorInicial: string;
  nuevaInicial?: string;
  error?: string;
}) {
  const [elegida, setElegida] = useState(valorInicial);
  const [abierto, setAbierto] = useState(nuevaInicial !== "");
  const [texto, setTexto] = useState(nuevaInicial);
  const visibles = abierto ? coincidenConEtiqueta(etiquetas, texto) : etiquetas;
  const igual = etiquetaIgual(etiquetas, texto);
  const titulo = "etiquetas-titulo";

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span id={titulo} className="text-[12px] font-semibold text-texto-3">
          Etiquetas
        </span>
        <button
          type="button"
          aria-label="Buscar o añadir etiqueta"
          onClick={() => setAbierto(true)}
          className="grid size-8 place-items-center rounded-full text-enlace hover:bg-tarjeta-hover"
        >
          <Search size={18} aria-hidden />
        </button>
      </div>
      <div role="radiogroup" aria-labelledby={titulo} className="flex flex-wrap gap-2">
        <noscript>
          <label className="group shrink-0 cursor-pointer">
            <input type="radio" name="etiquetaId" value="" defaultChecked={valorInicial === ""} className="sr-only" />
            <span className={estiloPildora}>Sin etiqueta</span>
          </label>
        </noscript>
        {visibles.map((e) => (
          <label key={e.id} className="group shrink-0 cursor-pointer">
            <input
              type="radio"
              name="etiquetaId"
              value={e.id}
              className="sr-only"
              checked={elegida === String(e.id)}
              onChange={() => setElegida(String(e.id))}
              // Tocar la elegida la quita: un radio marcado no emite change, pero sí click.
              onClick={() => {
                if (elegida === String(e.id)) setElegida("");
              }}
            />
            <span className={estiloPildora}>{e.nombre}</span>
          </label>
        ))}
        {abierto ? null : (
          <button
            type="button"
            onClick={() => setAbierto(true)}
            className={`${pildoraOpcion} ${pildoraNormal} border-dashed text-enlace`}
          >
            <Plus size={16} aria-hidden />
            Añadir etiqueta
          </button>
        )}
      </div>
      {abierto ? (
        <div className="mt-1 flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Entrada
              name="etiquetaNueva"
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value);
                // Lo escrito manda: no se queda a la vez una píldora elegida.
                if (e.target.value.trim() !== "") setElegida("");
              }}
              placeholder="Nombre de la etiqueta"
              maxLength={30}
              autoComplete="off"
              autoFocus={nuevaInicial === ""}
              aria-label="Nombre de la etiqueta"
              className="flex-1"
            />
            <button
              type="button"
              aria-label="Cerrar"
              onClick={() => {
                setTexto("");
                setAbierto(false);
              }}
              className="grid size-10 shrink-0 place-items-center rounded-full text-texto-3 hover:bg-tarjeta-hover"
            >
              <X size={18} aria-hidden />
            </button>
          </div>
          {texto.trim() !== "" ? (
            <p aria-live="polite" className="text-[12px] text-texto-3">
              {igual ? `Se usará «${igual.nombre}», que ya existe.` : `Se creará «${texto.trim()}» al guardar.`}
            </p>
          ) : null}
        </div>
      ) : (
        <noscript>
          <Entrada name="etiquetaNueva" placeholder="Etiqueta nueva (opcional)" maxLength={30} autoComplete="off" />
        </noscript>
      )}
      <ErrorCampo>{error}</ErrorCampo>
    </div>
  );
}
