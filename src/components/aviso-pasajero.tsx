"use client";

import { type ReactNode, useEffect, useState } from "react";

/**
 * Un aviso de lo que se acaba de hacer, que llega en la dirección ("?movido=1", "?borrado=deshecho"). Al mostrarse
 * quita esos parámetros de la dirección, para que recargar no lo repita, y se va en cuanto se envía otro formulario
 * de la página: así no queda junto al error de lo siguiente (revisión de la 007, hallazgo 3). Sin JavaScript se queda
 * como antes.
 */
export function AvisoPasajero({
  parametros,
  className,
  children,
}: {
  parametros: string[];
  className?: string;
  children: ReactNode;
}) {
  const [visible, setVisible] = useState(true);
  const claves = parametros.join(",");
  useEffect(() => {
    const url = new URL(window.location.href);
    const presentes = claves.split(",").filter((p) => url.searchParams.has(p));
    for (const p of presentes) url.searchParams.delete(p);
    if (presentes.length > 0) window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    const ocultar = () => setVisible(false);
    document.addEventListener("submit", ocultar, true);
    return () => document.removeEventListener("submit", ocultar, true);
  }, [claves]);
  if (!visible) return null;
  return (
    <div role="status" className={className}>
      {children}
    </div>
  );
}
