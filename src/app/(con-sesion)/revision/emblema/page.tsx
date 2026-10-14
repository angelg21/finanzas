import type { Metadata } from "next";
import Image from "next/image";
import { exigirSesion } from "@/app/sesion";
import { Emblema } from "@/components/emblema";
import { Tarjeta, TituloPagina } from "@/components/ui";
import referencia from "../../../../../docs/referencias/logo-emblema.png";

export const metadata: Metadata = { title: "Revisión del emblema" };

/**
 * Comparación lado a lado del emblema vectorizado con el logo original (spec 002, T9), para que el desarrollador lo
 * apruebe antes de generar los iconos. Se borra al aprobarlo.
 */
export default async function RevisionEmblema() {
  await exigirSesion();
  return (
    <div className="flex flex-col gap-5">
      <TituloPagina titulo="Revisión del emblema" detalle="Izquierda: logo-emblema.png. Derecha: el trazo en vector." />
      <Tarjeta className="flex flex-wrap items-center justify-center gap-8">
        <Image src={referencia} alt="Logo original" width={310} height={310} unoptimized />
        <Emblema tamano={310} />
      </Tarjeta>
      <Tarjeta className="flex flex-wrap items-end justify-center gap-8">
        <div className="flex flex-col items-center gap-2">
          <Image src={referencia} alt="Logo original a 72 px" width={72} height={72} unoptimized />
          <span className="text-[12px] text-texto-3">original, 72 px</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <Emblema tamano={72} />
          <span className="text-[12px] text-texto-3">vector, 72 px (/entrar)</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <Emblema tamano={512} className="h-auto max-w-full" />
          <span className="text-[12px] text-texto-3">vector, 512 px (icono)</span>
        </div>
      </Tarjeta>
    </div>
  );
}
