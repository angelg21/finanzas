import { ImageResponse } from "next/og";
import { CuadroEmblema } from "@/components/emblema";

/** Se genera una vez, en el build. */
export const dynamic = "force-static";

/**
 * El icono adaptable (maskable) de 512 del manifiesto (spec 002, criterio 16). Android lo recorta con la forma que
 * quiera dentro de un círculo del 80 %: el emblema entero, punta de la flecha incluida, queda dentro de ese círculo
 * con margen, sobre el fondo del panel claro.
 */
export function GET() {
  return new ImageResponse(<CuadroEmblema lado={512} radio={0.37} fondo="#f5f6f2" />, { width: 512, height: 512 });
}
