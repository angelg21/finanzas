import Link from "next/link";
import { BarraLateral, BotonFlotanteRegistrar, Marca, MenuMovil, TituloRuta } from "@/components/navegacion";
import { CambioTema } from "@/components/tema";
import { salir } from "./acciones";

function fechaLarga() {
  // En hora de Caracas: el servidor (Vercel) corre en UTC.
  const texto = new Intl.DateTimeFormat("es-VE", {
    timeZone: "America/Caracas",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function Avatar() {
  return (
    <span
      aria-hidden
      className="grid size-10 place-items-center rounded-full bg-palido text-sm font-extrabold text-palido-texto"
    >
      A
    </span>
  );
}

/**
 * El cascarón de las pantallas con datos (spec 002): barra lateral, barras superiores, menú móvil y el "+" flotante. Cada página de este grupo exige la sesión por su cuenta; el layout no la comprueba, porque al navegar
 * entre páginas no se vuelve a ejecutar.
 */
export default function LayoutConSesion({ children }: LayoutProps<"/">) {
  return (
    <>
      {/*
        La app ocupa la pantalla completa, también en escritorio (pedido del desarrollador, 2026-10-14): barra lateral
        fija y el contenido con un ancho máximo para que no se estire en pantallas muy anchas.
      */}
      <div className="panel flex min-h-dvh w-full flex-col lg:flex-row">
        <BarraLateral salir={salir} />

        <div className="mx-auto flex w-full min-w-0 max-w-[1400px] flex-1 flex-col">
          {/* Barra superior móvil: menú, marca, tema y avatar. */}
          <header className="flex items-center justify-between px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:hidden">
            <div className="flex items-center gap-1">
              <MenuMovil salir={salir} />
              <Link href="/" aria-label="Inicio">
                <Marca tamano={30} />
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <CambioTema />
              <Avatar />
            </div>
          </header>

          {/* Barra superior de escritorio: título de la página y fecha. */}
          <header className="hidden items-center justify-between px-8 pb-2 pt-7 lg:flex xl:px-10">
            <div>
              <TituloRuta />
              <p className="text-sm text-texto-3">{fechaLarga()}</p>
            </div>
            <div className="flex items-center gap-3">
              <CambioTema />
              <Avatar />
            </div>
          </header>

          <div className="flex-1 px-4 pb-24 pt-1 lg:px-8 lg:pb-10 lg:pt-4 xl:px-10">{children}</div>
        </div>
      </div>
      <BotonFlotanteRegistrar />
    </>
  );
}
