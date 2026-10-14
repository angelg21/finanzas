import type { Metadata, Viewport } from "next";
import { Roboto_Flex } from "next/font/google";
import { RegistroServiceWorker } from "@/components/registro-service-worker";
import { scriptTemaInicial } from "@/components/tema";
import { nombreApp } from "@/lib/marca";
import "./globals.css";

// Variable con eje óptico: las cifras grandes y el texto pequeño usan dibujos distintos de la misma fuente.
const robotoFlex = Roboto_Flex({
  variable: "--font-roboto-flex",
  subsets: ["latin"],
  axes: ["opsz", "wdth"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: nombreApp, template: `%s · ${nombreApp}` },
  description: "Presupuesto por sobres: cada dólar tiene un trabajo.",
  // iPhone: Compartir → "Añadir a inicio" abre la app a pantalla completa (spec 002, criterio 15).
  appleWebApp: { capable: true, title: nombreApp, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Los colores de --panel-a. Siguen al sistema hasta que el script del tema los cambia por los del tema elegido.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6f2" },
    { media: "(prefers-color-scheme: dark)", color: "#15241f" },
  ],
};

/**
 * Lo común a todas las pantallas: el documento, la fuente, el tema y los metadatos. El cascarón con navegación vive
 * en (con-sesion)/layout.tsx; /entrar y /sin-conexion, sin navegación, en (sin-sesion)/layout.tsx.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" suppressHydrationWarning className={`${robotoFlex.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTemaInicial }} />
      </head>
      <body className="min-h-full">
        {children}
        <RegistroServiceWorker />
      </body>
    </html>
  );
}
