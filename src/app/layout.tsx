import type { Metadata, Viewport } from "next";
import { Roboto_Flex } from "next/font/google";
import { scriptTemaInicial } from "@/components/tema";
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
      <body className="min-h-full">{children}</body>
    </html>
  );
}
