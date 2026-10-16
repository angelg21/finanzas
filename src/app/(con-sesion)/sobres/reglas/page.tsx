import type { Metadata } from "next";
import { TituloPagina } from "@/components/ui";
import { reglasPorSobre } from "@/db/reglas";
import { cuotaDelMes } from "@/db/reparto";
import { centavosATexto } from "@/lib/dinero";
import { reglaEditable } from "@/lib/reglas";
import { FormularioReglas } from "./formulario-reglas";
import type { ValoresReglas } from "./valores";
import { exigirSesion } from "@/app/sesion";

export const metadata: Metadata = { title: "Reglas de reparto" };
export const dynamic = "force-dynamic";

/**
 * Las reglas de reparto (spec 004, criterio 11): monto fijo mensual, porcentaje o ninguna por sobre, y el tope de
 * Emergencia. Los fondos muestran su aporte, que se cambia en su desglose, y Deudas su cuota calculada (spec 005).
 */
export default async function Reglas() {
  await exigirSesion();
  const [sobres, cuota] = await Promise.all([reglasPorSobre(), cuotaDelMes()]);
  const deudas = sobres.find((s) => s.tipoSobre === "deudas");
  const editables = sobres.filter((s) => reglaEditable(s.tipoSobre));
  const emergencia = sobres.find((s) => s.tipoSobre === "emergencia");

  const inicial: ValoresReglas = {
    // Una regla desactivada se muestra como "ninguna", con su último valor a mano por si se vuelve a elegir.
    reglas: Object.fromEntries(
      editables.map((s) => [
        s.sobreId,
        {
          tipo: s.regla?.activa ? s.regla.tipo : "ninguna",
          valor: s.regla ? centavosATexto(s.regla.valor) : "",
        },
      ]),
    ),
    tope: emergencia?.topeCentavos ? centavosATexto(emergencia.topeCentavos) : "",
  };

  return (
    <main className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-5">
      <TituloPagina titulo="Reglas de reparto" />
      <FormularioReglas
        editables={editables.map(({ sobreId, nombre }) => ({ sobreId, nombre }))}
        fondos={sobres
          .filter((s) => s.tipoSobre === "fondo")
          .map((s) => ({
            sobreId: s.sobreId,
            nombre: s.nombre,
            aporteCentavos: s.regla?.activa && s.regla.tipo === "fijo" ? s.regla.valor : null,
          }))}
        deudas={deudas ? { nombre: deudas.nombre, cuotaCentavos: cuota?.cuotaCentavos ?? 0 } : null}
        emergencia={emergencia ? { nombre: emergencia.nombre } : null}
        inicial={inicial}
      />
    </main>
  );
}
