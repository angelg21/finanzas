"use client";

import { Plus, Search, X } from "lucide-react";
import { useRef, useState, useSyncExternalStore } from "react";
import { coincidenConEtiqueta, etiquetaIgual } from "@/lib/etiquetas";
import { Entrada, ErrorCampo, pildoraDeRadio, pildoraNormal, pildoraOpcion } from "./formulario";

type Etiqueta = { id: number; nombre: string };

/**
 * "Etiquetas" (spec 008): las que existen, en píldoras; tocar una la elige y tocar la elegida la quita. "+ Añadir
 * etiqueta" y la lupa abren el mismo campo: lo que se escribe filtra las píldoras y, si no hay una igual, se crea al
 * guardar. Tocar una píldora, también una filtrada, la elige, borra lo escrito y cierra la búsqueda. Escribir quita
 * la píldora elegida hasta que se cierre la búsqueda o se borre lo escrito, que la devuelven: mientras tanto viaja en un
 * `etiquetaId` oculto, así sobrevive a un error del servidor, y lo escrito manda (revisión de la 008, primera y segunda
 * vuelta). Enter en la búsqueda solo busca: no guarda el formulario. Sin JavaScript, el campo está siempre a la vista,
 * hay una opción "Sin etiqueta", la lupa, "+ Añadir", la X y el aviso no se ven, y si llegan las dos manda lo escrito.
 * Lo que pinta el servidor es lo de sin JavaScript: todas las píldoras, con la elegida marcada aunque haya algo escrito;
 * la búsqueda filtra y aparta la elegida solo ya en el navegador (tercera vuelta).
 */

const sinSuscripcion = () => () => {};
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
  // Si vuelve del servidor con algo escrito y una elegida, la elegida era la de antes de escribir.
  const escribiendo = nuevaInicial.trim() !== "";
  const [elegida, setElegida] = useState(escribiendo ? "" : valorInicial);
  const [abierto, setAbierto] = useState(nuevaInicial !== "");
  // Enfocar el campo solo cuando lo abre la persona, no cuando vuelve abierto del servidor (tercera vuelta, hallazgo 2).
  const [enfocar, setEnfocar] = useState(false);
  const [texto, setTexto] = useState(nuevaInicial);
  // En el servidor, y al hidratar, false: lo pintado sirve sin JavaScript. En el navegador, true desde el primer render.
  const conJs = useSyncExternalStore(
    sinSuscripcion,
    () => true,
    () => false,
  );
  const lupa = useRef<HTMLButtonElement>(null);
  /** La píldora que estaba elegida antes de escribir: cerrar la búsqueda o borrar lo escrito la devuelve. */
  const [previa, setPrevia] = useState<string | null>(escribiendo && valorInicial !== "" ? valorInicial : null);
  const elegir = (id: string) => {
    setElegida(id);
    setPrevia(null);
    setTexto("");
    setAbierto(false);
  };
  const abrir = () => {
    setAbierto(true);
    setEnfocar(true);
  };
  const marcada = conJs ? elegida : valorInicial;
  const visibles = abierto && conJs ? coincidenConEtiqueta(etiquetas, texto) : etiquetas;
  const igual = etiquetaIgual(etiquetas, texto);
  const titulo = "etiquetas-titulo";

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span id={titulo} className="text-[12px] font-semibold text-texto-3">
          Etiquetas
        </span>
        <button
          ref={lupa}
          type="button"
          aria-label="Buscar o añadir etiqueta"
          onClick={abrir}
          className="grid size-8 place-items-center rounded-full text-enlace hover:bg-tarjeta-hover noscript:hidden"
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
              checked={marcada === String(e.id)}
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
            onClick={abrir}
            className={`${pildoraOpcion} ${pildoraNormal} border-dashed text-enlace noscript:hidden`}
          >
            <Plus size={16} aria-hidden />
            Añadir etiqueta
          </button>
        )}
      </div>
      {previa !== null && conJs ? <input type="hidden" name="etiquetaId" value={previa} /> : null}
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
              // Enter (o "Ir" en el celular) solo busca: no guarda el movimiento con lo escrito como etiqueta nueva.
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
              autoFocus={enfocar}
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
                // La X desaparece al cerrar: el foco pasa a la lupa, que abre otra vez (tercera vuelta, hallazgo 3).
                lupa.current?.focus();
              }}
              className="grid size-10 shrink-0 place-items-center rounded-full text-texto-3 hover:bg-tarjeta-hover noscript:hidden"
            >
              <X size={18} aria-hidden />
            </button>
          </div>
          {texto.trim() !== "" ? (
            <p aria-live="polite" className="text-[12px] text-texto-3 noscript:hidden">
              {igual ? `Se usará «${igual.nombre}», que ya existe.` : `Se creará «${texto.trim()}» al guardar.`}
            </p>
          ) : null}
        </div>
      ) : (
        <noscript>
          <Entrada name="etiquetaNueva" placeholder="Etiqueta nueva (opcional)" maxLength={30} autoComplete="off" />
        </noscript>
      )}
      <p className="hidden text-[12px] text-texto-3 noscript:block">
        Si escribes una, se guarda la escrita y no la marcada.
      </p>
      <ErrorCampo>{error}</ErrorCampo>
    </div>
  );
}
