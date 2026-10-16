import type { Metadata } from "next";
import { CheckCircle2, ChevronRight, CircleAlert, Landmark } from "lucide-react";
import Link from "next/link";
import { CirculoCuenta } from "@/components/circulo-cuenta";
import {
  Cifra,
  Dato,
  EncabezadoTarjeta,
  FilaLista,
  Pildora,
  Tarjeta,
  TarjetaPalida,
  TituloPagina,
} from "@/components/ui";
import { saldosPorCuenta, saldosPorSobre } from "@/db/consultas";
import { deudasConPendiente } from "@/db/deudas";
import { patrimonioNeto, pendientePorSentido } from "@/lib/deudas";
import { formatearCentavos } from "@/lib/dinero";
import { exigirSesion } from "@/app/sesion";

export const metadata: Metadata = { title: "Cuentas" };
export const dynamic = "force-dynamic";

const nombreTipo: Record<string, string> = {
  exchange: "Exchange",
  billetera: "Billetera",
  efectivo: "Efectivo",
  banco: "Banco",
  transito: "USD en EE. UU.",
};

export default async function Cuentas() {
  await exigirSesion();
  const [cuentas, sobres, deudas] = await Promise.all([
    saldosPorCuenta(),
    saldosPorSobre(),
    // Una deuda con datos rotos no tumba Cuentas: el patrimonio lo dice y /deudas muestra el error (guardian-datos, T6).
    deudasConPendiente().catch(() => null),
  ]);
  // Todas las cuentas, también la de la prima: el dinero que la app registra ahí es mío aunque la cuenta
  // no lo sea, y desde ella también se gasta (spec 001, criterio 16).
  const totalCuentas = cuentas.reduce((acc, c) => acc + c.saldoUsdCentavos, 0);
  const totalSobres = sobres.reduce((acc, s) => acc + s.saldoCentavos, 0);
  const cuadra = totalCuentas === totalSobres;
  // Lo que me deben y lo que debo no entran en el cuadre: solo en el patrimonio neto (spec 005, criterio 15).
  const pendientes = deudas && pendientePorSentido(deudas);

  return (
    <main className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-5">
      <TituloPagina titulo="Cuentas" />

      <section className="hero rounded-tarjeta p-5 lg:col-span-7 lg:p-6">
        <p className="text-[13px] font-semibold text-white/75">Patrimonio en cuentas</p>
        <div className="mt-2">
          <Cifra centavos={totalCuentas} tamano="hero" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Pildora tono={cuadra ? "positiva" : "negativa"}>
            {cuadra ? <CheckCircle2 size={13} aria-hidden /> : <CircleAlert size={13} aria-hidden />}
            {cuadra ? "Cuadra con los sobres" : "No cuadra con los sobres"}
          </Pildora>
          <Pildora tono="hero">
            <Landmark size={13} aria-hidden />
            {cuentas.length} cuentas
          </Pildora>
        </div>
      </section>

      <div className="flex flex-col gap-4 lg:col-span-5 lg:gap-5">
        <TarjetaPalida>
          <EncabezadoTarjeta
            titulo="Verificación"
            palida
            derecha={<Pildora tono="navy">{cuadra ? "Cuadra" : "No cuadra"}</Pildora>}
          />
          <p className="text-[13px] text-palida-texto-2">
            Cada dólar tiene un trabajo: la suma de los sobres debe ser igual a la suma de las cuentas.
          </p>
          <div className="mt-4 flex flex-col gap-2 border-t border-palida-pista pt-3">
            <Dato etiqueta="Sobres">{formatearCentavos(totalSobres)}</Dato>
            <Dato etiqueta="Cuentas">{formatearCentavos(totalCuentas)}</Dato>
            <Dato etiqueta="Diferencia">{formatearCentavos(totalCuentas - totalSobres)}</Dato>
          </div>
        </TarjetaPalida>

        <TarjetaPalida>
          <EncabezadoTarjeta titulo="Patrimonio neto" palida />
          {pendientes ? (
            <>
              <Cifra
                centavos={patrimonioNeto({ cuentasCentavos: totalCuentas, ...pendientes })}
                tamano="lg"
                tono="palida"
              />
              <div className="mt-3 flex flex-col gap-2 border-t border-palida-pista pt-3">
                <Dato etiqueta="Cuentas">{formatearCentavos(totalCuentas)}</Dato>
                <Dato etiqueta="Me deben">+{formatearCentavos(pendientes.meDebenCentavos)}</Dato>
                <Dato etiqueta="Debo">{formatearCentavos(-pendientes.deboCentavos)}</Dato>
              </div>
            </>
          ) : (
            <p className="text-[13px] text-palida-texto-2">Revisa Deudas: hay una deuda con datos que no cuadran.</p>
          )}
          <Link
            href="/deudas"
            className="mt-3 flex items-center gap-0.5 text-[13px] font-semibold text-palida-texto-2 hover:text-palida-texto"
          >
            Ver deudas
            <ChevronRight size={16} aria-hidden />
          </Link>
        </TarjetaPalida>
      </div>

      <Tarjeta className="lg:col-span-12">
        <EncabezadoTarjeta titulo="Mis cuentas" />
        <div className="flex flex-col lg:grid lg:grid-cols-2 lg:gap-x-8">
          {cuentas.map((c) => (
            <FilaLista
              key={c.id}
              avatar={<CirculoCuenta tipo={c.tipo} moneda={c.moneda} />}
              titulo={c.nombre}
              subtitulo={`${nombreTipo[c.tipo] ?? c.tipo} · ${c.moneda}${!c.esPropia ? " · a nombre de mi prima" : ""}`}
              derecha={
                <>
                  <Cifra centavos={c.saldoCentavos} moneda={c.moneda} />
                  {c.moneda !== "USD" ? <Cifra centavos={c.saldoUsdCentavos} tamano="sm" tono="texto-3" /> : null}
                </>
              }
            />
          ))}
        </div>
      </Tarjeta>
    </main>
  );
}
