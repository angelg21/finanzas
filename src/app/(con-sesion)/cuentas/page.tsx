import type { Metadata } from "next";
import { CheckCircle2, ChevronRight, CircleAlert, Landmark, Plus } from "lucide-react";
import Link from "next/link";
import { AvisoPasajero } from "@/components/aviso-pasajero";
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
import { cuentasDelCuadre, saldosPorSobre } from "@/db/consultas";
import { cuentasConUso } from "@/db/cuentas";
import { deudasConPendiente } from "@/db/deudas";
import { nombreDeTipo } from "@/lib/cuentas";
import { patrimonioNeto, pendientePorSentido } from "@/lib/deudas";
import { formatearCentavos } from "@/lib/dinero";
import { exigirSesion } from "@/app/sesion";
import { BotonRestaurarCuenta } from "./botones-cuenta";

export const metadata: Metadata = { title: "Cuentas" };
export const dynamic = "force-dynamic";

export default async function Cuentas({ searchParams }: PageProps<"/cuentas">) {
  await exigirSesion();
  const [cuentas, sobres, deudas, todas] = await Promise.all([
    // Con las archivadas que tienen saldo: el cuadre nunca esconde dinero (spec 013, criterio 10).
    cuentasDelCuadre(),
    saldosPorSobre(),
    // Una deuda con datos rotos no tumba Cuentas: el patrimonio lo dice y /deudas muestra el error (guardian-datos, T6).
    deudasConPendiente().catch(() => null),
    cuentasConUso(),
  ]);
  // Spec 013: las archivadas, para restaurarlas. Una con saldo también sale arriba, en la lista (criterio 10).
  const archivadas = todas.filter((c) => !c.activa);
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
      {(await searchParams).transferido === "1" ? (
        // Spec 011: al volver de transferir entre cuentas.
        <div className="-mt-2 flex px-1 lg:col-span-12 lg:mt-0 lg:px-0">
          <AvisoPasajero parametros={["transferido"]}>
            <Pildora tono="positiva">
              <CheckCircle2 size={13} aria-hidden />
              Transferido
            </Pildora>
          </AvisoPasajero>
        </div>
      ) : null}

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
        <EncabezadoTarjeta titulo="Mis cuentas" enlace={{ href: "/nuevo/transferir", texto: "Transferir" }} />
        <div className="flex flex-col lg:grid lg:grid-cols-2 lg:gap-x-8">
          {cuentas.map((c) => (
            <FilaLista
              key={c.id}
              href={`/cuentas/${c.id}`}
              avatar={<CirculoCuenta tipo={c.tipo} moneda={c.moneda} icono={c.icono} color={c.color} />}
              titulo={c.nombre}
              subtitulo={`${nombreDeTipo[c.tipo]} · ${c.moneda}${!c.esPropia ? " · a nombre de mi prima" : ""}${!c.activa ? " · archivada" : ""}`}
              derecha={
                <>
                  <Cifra centavos={c.saldoCentavos} moneda={c.moneda} />
                  {c.moneda !== "USD" ? <Cifra centavos={c.saldoUsdCentavos} tamano="sm" tono="texto-3" /> : null}
                </>
              }
            />
          ))}
          <Link
            href="/cuentas/nueva"
            className="-mx-2 flex items-center gap-3 rounded-[14px] px-2 py-2.5 hover:bg-tarjeta-hover focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <span
              aria-hidden
              className="grid size-11 shrink-0 place-items-center rounded-full border border-dashed border-tarjeta-borde bg-tarjeta-hover text-texto-2"
            >
              <Plus size={21} strokeWidth={1.75} />
            </span>
            <span className="text-[13px] font-extrabold uppercase tracking-wide">Nueva cuenta</span>
          </Link>
        </div>
      </Tarjeta>

      {archivadas.length > 0 ? (
        <Tarjeta className="lg:col-span-12">
          <EncabezadoTarjeta titulo={`Archivadas (${archivadas.length})`} />
          <p className="mb-2 text-[13px] text-texto-3">
            No se ofrecen al registrar, pero sus movimientos las conservan.
          </p>
          <div className="flex flex-col lg:grid lg:grid-cols-2 lg:gap-x-8">
            {archivadas.map((c) => (
              <FilaLista
                key={c.id}
                avatar={
                  <CirculoCuenta
                    tipo={c.tipo}
                    moneda={c.moneda}
                    icono={c.icono}
                    color={c.color}
                    className="opacity-45"
                  />
                }
                titulo={c.nombre}
                subtitulo={`${nombreDeTipo[c.tipo]} · ${c.moneda}`}
                derecha={<BotonRestaurarCuenta id={c.id} nombre={c.nombre} />}
              />
            ))}
          </div>
        </Tarjeta>
      ) : null}
    </main>
  );
}
