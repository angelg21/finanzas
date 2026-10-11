import type { Metadata, Viewport } from "next";
import { Roboto_Flex } from "next/font/google";
import Link from "next/link";
import { BarraLateral, MenuMovil, NavInferior, TituloRuta } from "@/components/navegacion";
import { CambioTema, scriptTemaInicial } from "@/components/tema";
import "./globals.css";

// Variable con eje óptico: las cifras grandes y el texto pequeño usan dibujos distintos de la misma fuente.
const robotoFlex = Roboto_Flex({
  variable: "--font-roboto-flex",
  subsets: ["latin"],
  axes: ["opsz", "wdth"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Finanzas", template: "%s · Finanzas" },
  description: "Presupuesto por sobres: cada dólar tiene un trabajo.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6f2" },
    { media: "(prefers-color-scheme: dark)", color: "#15241f" },
  ],
};

function fechaLarga() {
  const texto = new Intl.DateTimeFormat("es-VE", {
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" suppressHydrationWarning className={`${robotoFlex.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTemaInicial }} />
      </head>
      <body className="min-h-full">
        {/*
          Móvil: el panel ocupa toda la pantalla, como las pantallas de la referencia.
          Escritorio: el panel flota sobre el lienzo con radio 28, barra lateral y contenido en rejilla.
        */}
        <div className="panel mx-auto flex min-h-dvh w-full flex-col lg:my-5 lg:min-h-[calc(100dvh-40px)] lg:w-[calc(100%-40px)] lg:max-w-[1480px] lg:flex-row lg:rounded-panel lg:border lg:border-panel-borde lg:shadow-panel">
          <BarraLateral />

          <div className="flex min-w-0 flex-1 flex-col">
            {/* Barra superior móvil: menú, marca, tema y avatar. */}
            <header className="flex items-center justify-between px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:hidden">
              <div className="flex items-center gap-1">
                <MenuMovil />
                <Link href="/" className="text-[19px] font-bold tracking-tight">
                  finanzas
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

            <div className="flex-1 px-4 pb-28 pt-1 lg:px-8 lg:pb-10 lg:pt-4 xl:px-10">{children}</div>
          </div>
        </div>
        <NavInferior />
      </body>
    </html>
  );
}
