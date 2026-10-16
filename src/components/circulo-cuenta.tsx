import { Banknote, Bitcoin, Building2, DollarSign, Landmark, type LucideIcon, Wallet } from "lucide-react";
import { createElement } from "react";
import { type AspectoCuenta, aspectoDeCuenta } from "@/lib/cuentas";

/*
  Una cuenta como las categorías: círculo de color con un icono de línea encima, nunca emojis. El aspecto sale de su
  tipo y su moneda (src/lib/cuentas.ts). Los tonos son los de la paleta de categorías, salvo el amarillo de cripto,
  que lleva el icono en pino oscuro porque en blanco no se leería (paleta-cuentas.test.ts).
*/

const aspectos: Record<AspectoCuenta, { Icono: LucideIcon; clases: string }> = {
  cripto: { Icono: Bitcoin, clases: "bg-cuenta-cripto text-palida-texto" },
  billetera: { Icono: Wallet, clases: "bg-cat-turquesa text-white" },
  efectivo: { Icono: DollarSign, clases: "bg-cat-verde text-white" },
  exterior: { Icono: Landmark, clases: "bg-cat-azul text-white" },
  bolivares: { Icono: Banknote, clases: "bg-cat-coral text-white" },
  banco: { Icono: Building2, clases: "bg-cat-indigo text-white" },
};

const medidas = {
  md: { caja: "size-10", icono: 19 },
  lg: { caja: "size-11", icono: 21 },
} as const;

export function CirculoCuenta({
  tipo,
  moneda,
  tamano = "lg",
  className = "",
}: {
  tipo: string;
  moneda: string;
  /** `lg` en las listas, del alto del avatar que reemplaza. */
  tamano?: keyof typeof medidas;
  className?: string;
}) {
  const { Icono, clases } = aspectos[aspectoDeCuenta({ tipo, moneda })];
  const { caja, icono } = medidas[tamano];
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center rounded-full ${clases} ${caja} ${className}`}>
      {createElement(Icono, { size: icono, strokeWidth: 1.9 })}
    </span>
  );
}
