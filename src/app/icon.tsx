import { ImageResponse } from "next/og";
import { CuadroEmblema } from "@/components/emblema";

/**
 * Favicon (32) e iconos del manifiesto (192 y 512), sobre fondo transparente (spec 002, criterios 15 y 16). Se
 * generan en el build desde el emblema en vector: ningún PNG se edita a mano.
 */
export function generateImageMetadata() {
  return [32, 192, 512].map((lado) => ({
    id: String(lado),
    size: { width: lado, height: lado },
    contentType: "image/png",
  }));
}

export default async function Icono({ id }: { id: Promise<string | number> }) {
  const lado = Number(await id);
  return new ImageResponse(<CuadroEmblema lado={lado} radio={0.66} />, { width: lado, height: lado });
}
