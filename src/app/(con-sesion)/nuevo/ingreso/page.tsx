import type { Metadata } from "next";
import { Tarjeta } from "@/components/ui";
import { saldosPorCuenta } from "@/db/consultas";
import { categoriasDeIngresoPorUso, cuentaDelUltimoIngreso, datosDelReparto } from "@/db/reparto";
import { hoyEnCaracas } from "@/lib/fechas";
import { SelectorTipo } from "../selector-tipo";
import { FormularioIngreso } from "./formulario-ingreso";
import { exigirSesion } from "@/app/sesion";

export const metadata: Metadata = { title: "Nuevo ingreso" };
export const dynamic = "force-dynamic";

/** Registro de un ingreso con su reparto (spec 004). `?cuenta=` viene de "Registrar otro" sin JavaScript. */
export default async function NuevoIngreso({ searchParams }: PageProps<"/nuevo/ingreso">) {
  await exigirSesion();
  const parametros = await searchParams;
  const [reparto, categorias, cuentas, ultima] = await Promise.all([
    datosDelReparto(),
    categoriasDeIngresoPorUso(),
    saldosPorCuenta(),
    cuentaDelUltimoIngreso(),
  ]);

  // Los bolívares no se ofrecen: un ingreso en Bs pediría una tasa (fuera de alcance).
  const enDolares = cuentas.filter((c) => c.moneda !== "VES");
  const cuenta =
    enDolares.find((c) => String(c.id) === parametros.cuenta) ?? enDolares.find((c) => c.id === ultima) ?? enDolares[0];
  const { porAsignar } = reparto;

  return (
    <main className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-5">
      <header className="flex flex-col gap-3 px-1 lg:col-span-12 lg:px-0">
        <h1 className="text-[24px] font-extrabold tracking-tight lg:hidden">Nuevo ingreso</h1>
        <SelectorTipo actual="ingreso" />
      </header>

      {porAsignar?.activo ? (
        <FormularioIngreso
          cuentas={enDolares.map(({ id, nombre, moneda, esPropia }) => ({ id, nombre, moneda, esPropia }))}
          categorias={categorias.map(({ id, nombre, icono, color }) => ({ id, nombre, icono, color }))}
          reglas={reparto.reglas}
          recibidoPorMes={reparto.recibidoPorMes}
          hoy={hoyEnCaracas(new Date())}
          // Cada apertura es una captura nueva; el id viaja con lo tecleado y evita duplicar al reintentar.
          inicial={{
            cuentaId: String(cuenta?.id ?? ""),
            categoriaId: String(categorias[0]?.id ?? ""),
            idCaptura: crypto.randomUUID(),
          }}
        />
      ) : (
        <Tarjeta className="lg:col-span-7">
          <p role="alert" className="text-[13px] font-semibold text-negativo">
            {porAsignar
              ? 'El sobre "Por asignar" está inactivo: el ingreso no tiene dónde caer. Actívalo para registrar ingresos.'
              : 'No existe el sobre "Por asignar": el ingreso no tiene dónde caer. Corre la semilla para crearlo.'}
          </p>
        </Tarjeta>
      )}
    </main>
  );
}
