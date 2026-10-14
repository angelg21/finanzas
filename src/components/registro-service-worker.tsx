"use client";

import { useEffect } from "react";

/**
 * Registra /sw.js con alcance / (spec 002, criterio 18). Solo en producción: en desarrollo estorbaría a la recarga en
 * caliente. `updateViaCache: "none"` busca una versión nueva del service worker en cada apertura.
 */
export function RegistroServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Sin service worker la app funciona igual: solo pierde la página sin conexión.
    });
  }, []);
  return null;
}
