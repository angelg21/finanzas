"use client";

import { Plus, Search, X } from "lucide-react";
import { useState } from "react";
import { coincidenConEtiqueta, etiquetaIgual } from "@/lib/etiquetas";
import { Entrada, ErrorCampo, pildoraDeRadio, pildoraNormal, pildoraOpcion } from "./formulario";

type Etiqueta = { id: number; nombre: string };

/**
 * "Etiquetas" (spec 008): las que existen, en píldoras; tocar una la elige y tocar la elegida la quita. "+ Añadir
 * etiqueta" y la lupa abren el mismo campo: lo que se escribe filtra las píldoras y, si no hay una igual, se crea al
 * guardar. Envía `etiquetaId` (la elegida) o `etiquetaNueva` (lo escrito); nunca las dos con JavaScript: tocar una
 * píldora, también una filtrada, borra lo escrito y cierra la búsqueda, y escribir quita la píldora elegida hasta que
 * se cierre la búsqueda o se borre lo escrito, que la devuelven (revisión de la 008, hallazgos 1 y 5). Sin JavaScript,
 * el campo está siempre a la vista, hay una opción "Sin etiqueta", y si llegan las dos manda lo escrito.
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
  /** La píldora que estaba elegida antes de escribir: cerrar la búsqueda o borrar lo escrito la devuelve. */
  const [previa, setPrevia] = useState<string | null>(null);
  const elegir = (id: string) => {
    setElegida(id);
    setPrevia(null);
    setTexto("");
    setAbierto(false);
  };
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
            <span className={pildoraDeRadio}>Sin etiqueta</span>
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
              onChange={() => elegir(String(e.id))}
              // Tocar la elegida la quita: un radio marcado no emite change, pero sí click.
              onClick={() => {
                if (elegida === String(e.id)) elegir("");
              }}
            />
            <span className={pildoraDeRadio}>{e.nombre}</span>
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
                const escrito = e.target.value;
                setTexto(escrito);
                // Mientras hay algo escrito no queda a la vez una píldora elegida; borrarlo la devuelve.
                if (escrito.trim() !== "" && elegida !== "") {
                  setPrevia(elegida);
                  setElegida("");
                } else if (escrito.trim() === "" && previa !== null) {
                  setElegida(previa);
                  setPrevia(null);
                }
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
                // Cerrar es cancelar la búsqueda: vuelve la píldora que estaba elegida.
                if (previa !== null) setElegida(previa);
                setPrevia(null);
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
