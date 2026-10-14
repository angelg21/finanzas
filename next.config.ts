import type { NextConfig } from "next";

/** Spec 002, criterio 14: en toda respuesta. Lo comprueba pnpm humo. */
const cabecerasDeSeguridad = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Solo en desarrollo: deja que el celular abra `pnpm dev` por la IP de la red local. Sin esto, Next bloquea
  // sus recursos de desarrollo desde otro origen y la app no arranca en el celular (botón de tema muerto).
  allowedDevOrigins: ["10.*.*.*", "192.168.*.*"],
  async headers() {
    return [
      { source: "/:ruta*", headers: cabecerasDeSeguridad },
      {
        // El service worker nunca se guarda en caché, para que una versión nueva llegue en la siguiente apertura.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
