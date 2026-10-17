"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

type Tema = "claro" | "oscuro";

const CLAVE = "tema";

/**
 * Color de la barra de estado del celular para cada tema: el de --panel-a, que el meta theme-color no puede leer.
 * Con el tema elegido manda este y no el del sistema (spec 002, criterio 17).
 */
const barraDeEstado: Record<Tema, string> = { claro: "#f5f6f2", oscuro: "#15241f" };

/**
 * Script que corre antes de pintar para que no haya destello de tema. Sin preferencia guardada, sigue al sistema
 * operativo. También pinta la barra de estado con el tema elegido: los meta theme-color del layout siguen al
 * sistema, y se reescriben al cargar y cada vez que Next los vuelve a poner al navegar (revisión de la 002: tras un
 * enlace, la barra volvía al tema del sistema). Solo escribe si el color cambia, para no despertarse a sí mismo, y
 * nada sin tema: la página de error de Next trae un <html> sin data-tema, y escribir "undefined" una y otra vez
 * colgaba la pestaña (segunda revisión de la 002).
 * Debe ser autónomo: no importa nada.
 */
export const scriptTemaInicial = `(function(){var d=document.documentElement;var c=${JSON.stringify(barraDeEstado)};function b(){var v=c[d.dataset.tema];if(!v){return;}var m=document.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<m.length;i++){if(m[i].getAttribute("content")!==v){m[i].setAttribute("content",v);}}}try{var q=new URLSearchParams(location.search).get("${CLAVE}");if(q==="claro"||q==="oscuro"){localStorage.setItem("${CLAVE}",q);}var t=localStorage.getItem("${CLAVE}");if(t!=="claro"&&t!=="oscuro"){t=matchMedia("(prefers-color-scheme: dark)").matches?"oscuro":"claro";}d.dataset.tema=t;}catch(e){d.dataset.tema="claro";}b();document.addEventListener("DOMContentLoaded",b);try{new MutationObserver(b).observe(document.head,{childList:true,subtree:true,attributes:true,attributeFilter:["content"]});}catch(e){/* sin MutationObserver: se pinta solo al cargar */}})();`;

/** Pinta la barra de estado del celular con el color del tema. */
function pintarBarraDeEstado(tema: Tema) {
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    meta.setAttribute("content", barraDeEstado[tema]);
  }
}

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
  pintarBarraDeEstado(tema);
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
