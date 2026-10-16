import Link from "next/link";

/** Una lista de deudas vacía, con el enlace para registrar la primera (spec 005, pantallas). */
export function NadaPorAqui({ href }: { href: string }) {
  return (
    <p className="py-2 text-[13px] text-texto-3">
      Nada por aquí.{" "}
      <Link href={href} className="font-semibold text-enlace hover:text-texto">
        Registrar
      </Link>
    </p>
  );
}
