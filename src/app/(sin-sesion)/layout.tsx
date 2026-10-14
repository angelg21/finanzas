/**
 * El marco de /entrar y /sin-conexion (spec 002, "Pantallas"): el lienzo y el panel, sin navegación. En el móvil el
 * panel ocupa toda la pantalla, con una columna centrada en vertical y 16 px de relleno lateral; en escritorio flota
 * sobre el lienzo, de 440 px de ancho y centrado. Nada de este grupo consulta la base ni exige la sesión.
 */
export default function LayoutSinSesion({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh items-center justify-center lg:p-5">
      <main className="panel flex min-h-dvh w-full flex-col justify-center px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))] lg:min-h-0 lg:max-w-[440px] lg:rounded-panel lg:border lg:border-panel-borde lg:px-8 lg:py-10 lg:shadow-panel">
        {children}
      </main>
    </div>
  );
}
