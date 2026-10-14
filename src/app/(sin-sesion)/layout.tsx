import { PiggyBank, Target, TrendingUp } from "lucide-react";
import { Emblema } from "@/components/emblema";
import { nombreApp } from "@/lib/marca";

const ideas = [
  { Icono: PiggyBank, texto: "Sobres" },
  { Icono: Target, texto: "Metas" },
  { Icono: TrendingUp, texto: "Inversión" },
];

/**
 * El marco de /entrar y /sin-conexion, a pantalla completa (pedido del desarrollador, 2026-10-14). Los fondos los
 * ponen las clases .acceso, .acceso-marca y .acceso-hoja de globals.css, que cambian con el ancho:
 * - celular: la marca (el emblema sobre un disco claro, el nombre, el lema y tres ideas) es el fondo de toda la
 *   pantalla, y el formulario va en una hoja clara que flota sobre ella;
 * - escritorio: la pantalla partida en dos, la marca a la izquierda y el formulario sobre el panel a la derecha.
 * Nada de este grupo consulta la base ni exige la sesión.
 */
export default function LayoutSinSesion({ children }: LayoutProps<"/">) {
  return (
    <div className="acceso flex min-h-dvh flex-col lg:grid lg:grid-cols-2">
      <aside className="acceso-marca flex flex-col items-center justify-center gap-4 px-6 pb-7 pt-[max(2.25rem,env(safe-area-inset-top))] text-center text-white lg:min-h-dvh lg:gap-7 lg:px-12 lg:py-16">
        <div className="disco-emblema grid size-[104px] place-items-center rounded-full lg:size-[236px]">
          <Emblema tamano={72} className="lg:hidden" />
          <Emblema tamano={164} className="hidden lg:block" />
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-[34px] font-extrabold leading-none tracking-tight lg:text-[56px]">{nombreApp}</p>
          <p className="text-[15px] opacity-80 lg:text-[18px]">Cada dólar tiene un trabajo.</p>
        </div>
        <ul aria-label="Lo que ordena" className="flex flex-wrap justify-center gap-2">
          {ideas.map(({ Icono, texto }) => (
            <li
              key={texto}
              className="mosaico flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold lg:gap-2 lg:px-4 lg:py-2 lg:text-[13px]"
            >
              <Icono size={15} aria-hidden />
              {texto}
            </li>
          ))}
        </ul>
      </aside>
      <main className="flex flex-1 flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:justify-center lg:px-16 lg:py-16">
        <div className="acceso-hoja mx-auto w-full max-w-[400px] px-5 py-6 lg:p-0">{children}</div>
      </main>
    </div>
  );
}
