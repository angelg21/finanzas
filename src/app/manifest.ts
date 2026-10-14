import type { MetadataRoute } from "next";
import { nombreApp } from "@/lib/marca";

/**
 * Manifiesto de la app instalable (spec 002, criterio 15). Los colores repiten el panel claro (--panel-a): el
 * manifiesto no lee los tokens. El acceso directo "Registrar gasto" aparece al mantener presionado el icono en
 * Android y lleva directo a la captura.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: nombreApp,
    short_name: nombreApp,
    description: "Presupuesto por sobres: cada dólar tiene un trabajo.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    lang: "es",
    background_color: "#f5f6f2",
    theme_color: "#f5f6f2",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icono-adaptable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Registrar gasto",
        short_name: "Gasto",
        url: "/nuevo/gasto",
        icons: [{ src: "/icon/192", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
