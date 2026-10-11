"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

type Tema = "claro" | "oscuro";

const CLAVE = "tema";

/**
 * Script que corre antes de pintar para que no haya destello de tema.
 * Sin preferencia guardada, sigue al sistema operativo.
 * Debe ser autónomo: no importa nada.
 */
export const scriptTemaInicial = `(function(){var d=document.documentElement;try{var q=new URLSearchParams(location.search).get("${CLAVE}");if(q==="claro"||q==="oscuro"){localStorage.setItem("${CLAVE}",q);}var t=localStorage.getItem("${CLAVE}");if(t!=="claro"&&t!=="oscuro"){t=matchMedia("(prefers-color-scheme: dark)").matches?"oscuro":"claro";}d.dataset.tema=t;}catch(e){d.dataset.tema="claro";}})();`;

function temaActual(): Tema {
  try {
    const guardado = localStorage.getItem(CLAVE);
    if (guardado === "claro" || guardado === "oscuro") return guardado;
  } catch {
    // sin almacenamiento
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "oscuro" : "claro";
}

const oyentes = new Set<() => void>();

function suscribir(oyente: () => void) {
  oyentes.add(oyente);
  window.addEventListener("storage", oyente);
  return () => {
    oyentes.delete(oyente);
    window.removeEventListener("storage", oyente);
  };
}

function fijarTema(tema: Tema) {
  try {
    localStorage.setItem(CLAVE, tema);
  } catch {
    // el cambio dura hasta recargar
  }
  document.documentElement.dataset.tema = tema;
  oyentes.forEach((o) => o());
}

/**
 * Botón de tema. Sin texto: círculo con luna o sol, para las barras superiores.
 * Con texto: fila para la barra lateral y el menú.
 */
export function CambioTema({ conTexto = false }: { conTexto?: boolean }) {
  const tema = useSyncExternalStore(suscribir, temaActual, () => "claro" as const);
  const siguiente: Tema = tema === "oscuro" ? "claro" : "oscuro";
  const Icono = tema === "oscuro" ? Moon : Sun;

  if (conTexto) {
    return (
      <button
        type="button"
        onClick={() => fijarTema(siguiente)}
        className="flex w-full items-center gap-3 rounded-[14px] px-3.5 py-3 text-[14px] font-semibold text-texto-2 hover:bg-tarjeta-hover hover:text-texto"
      >
        <Icono size={20} aria-hidden />
        <span className="flex-1 text-left">Tema {tema}</span>
        <span className="text-[12px] text-texto-3">Cambiar</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => fijarTema(siguiente)}
      aria-label={`Cambiar a tema ${siguiente}`}
      className="tarjeta grid size-10 place-items-center rounded-full text-texto-2 hover:text-texto"
    >
      <Icono size={18} aria-hidden />
    </button>
  );
}
