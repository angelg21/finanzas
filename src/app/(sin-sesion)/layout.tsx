import { PiggyBank, Target, TrendingUp } from "lucide-react";
import { Emblema } from "@/components/emblema";
import { nombreApp } from "@/lib/marca";

const ideas = [
  { Icono: PiggyBank, texto: "Sobres" },
  { Icono: Target, texto: "Metas" },
  { Icono: TrendingUp, texto: "Inversión" },
];

/**
 * El marco de /entrar y /sin-conexion, a pantalla completa (pedido del desarrollador, 2026-10-14). En escritorio,
 * la pantalla partida en dos: de un lado la marca, el emblema sobre un disco claro en el verde pino, con el nombre y
 * el lema; del otro, el formulario. En el celular, la marca arriba y el formulario debajo. Nada de este grupo
 * consulta la base ni exige la sesión.
 */
export default function LayoutSinSesion({ children }: LayoutProps<"/">) {
  return (
    // El panel va detrás de todo: tras las esquinas redondeadas de la marca no asoma el gris del lienzo.
    <div className="panel flex min-h-dvh flex-col lg:grid lg:grid-cols-2">
      <aside className="marca-acceso flex flex-col items-center justify-center gap-5 rounded-b-[32px] px-6 pb-10 pt-[max(2.5rem,env(safe-area-inset-top))] text-center [--centro-anillos:42%] lg:min-h-dvh lg:gap-7 lg:rounded-none lg:px-12 lg:py-16 lg:[--centro-anillos:38%]">
        <div className="disco-emblema grid size-[128px] place-items-center rounded-full lg:size-[236px]">
          <Emblema tamano={88} className="lg:hidden" />
          <Emblema tamano={164} className="hidden lg:block" />
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-[36px] font-extrabold leading-none tracking-tight lg:text-[56px]">{nombreApp}</p>
          <p className="text-[15px] opacity-80 lg:text-[18px]">Cada dólar tiene un trabajo.</p>
        </div>
        <ul aria-label="Lo que ordena" className="hidden flex-wrap justify-center gap-2 lg:flex">
          {ideas.map(({ Icono, texto }) => (
            <li
              key={texto}
              className="mosaico flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold"
            >
              <Icono size={16} aria-hidden />
              {texto}
            </li>
          ))}
        </ul>
      </aside>
      <main className="flex flex-1 flex-col px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-10 lg:justify-center lg:px-16 lg:py-16">
        <div className="mx-auto w-full max-w-[400px]">{children}</div>
      </main>
    </div>
  );
}
