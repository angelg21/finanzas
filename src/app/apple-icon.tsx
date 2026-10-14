import { ImageResponse } from "next/og";
import { CuadroEmblema } from "@/components/emblema";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * El icono de iPhone para "Añadir a inicio" (spec 002, criterio 15). iOS pinta de negro lo transparente y redondea
 * las esquinas: fondo del panel claro y la punta de la flecha lejos de la esquina. El hexadecimal repite el del
 * panel claro, como themeColor en layout.tsx: ImageResponse no lee los tokens.
 */
export default function IconoApple() {
  return new ImageResponse(<CuadroEmblema lado={size.width} radio={0.56} fondo="#f5f6f2" />, size);
}
