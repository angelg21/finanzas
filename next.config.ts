import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Solo en desarrollo: deja que el celular abra `pnpm dev` por la IP de la red local. Sin esto, Next bloquea
  // sus recursos de desarrollo desde otro origen y la app no arranca en el celular (botón de tema muerto).
  allowedDevOrigins: ["10.*.*.*", "192.168.*.*"],
};

export default nextConfig;
