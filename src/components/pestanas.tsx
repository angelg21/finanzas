import Link from "next/link";

export type OpcionPestana = { clave: string; texto: string; href: string };

/**
 * Pestañas en una píldora `tarjeta`: la elegida en menta con `aria-current`, las demás como enlaces, así que
 * funcionan sin JavaScript. Las usan /categorias (Gastos, Ingresos) y /movimientos (tipo y periodo). `llena` las
 * reparte en todo el ancho, para las pestañas principales en el celular.
 */
export function Pestanas({
  etiqueta,
  opciones,
  activa,
  llena = false,
}: {
  etiqueta: string;
  opciones: OpcionPestana[];
  activa: string;
  llena?: boolean;
}) {
  const forma = `rounded-full font-bold ${llena ? "flex-1 px-3 py-1.5 text-center text-[13px]" : "px-2.5 py-1 text-[12px]"}`;
  return (
    <nav
      aria-label={etiqueta}
      className={`tarjeta flex items-center gap-1 rounded-full p-1 ${llena ? "w-full" : "w-fit"}`}
    >
      {opciones.map((o) =>
        o.clave === activa ? (
          <span key={o.clave} aria-current="page" className={`${forma} bg-palido text-palido-texto`}>
            {o.texto}
          </span>
        ) : (
          <Link key={o.clave} href={o.href} className={`${forma} text-texto-2 hover:text-texto`}>
            {o.texto}
          </Link>
        ),
      )}
    </nav>
  );
}
