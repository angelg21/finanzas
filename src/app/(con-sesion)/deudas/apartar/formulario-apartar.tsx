"use client";

import { useActionState } from "react";
import { Boton, Campo, CampoMonto, ErrorCampo, SelectorPildoras } from "@/components/formulario";
import { formatearCifra } from "@/lib/dinero";
import { apartarConFallas } from "./apartar-con-fallas";
import type { ErroresFormularioApartado, EstadoApartado, ValoresApartado } from "./valores";

type Datos = {
  inicial: ValoresApartado;
  /** Los sobres desde los que se puede apartar, con su saldo. */
  origenes: { id: number; nombre: string; saldoCentavos: number }[];
};

/** De qué sobre y cuánto apartar para Deudas (spec 005, criterio 13). Sin JavaScript, radios y un campo. */
export function FormularioApartar({ inicial, origenes }: Datos) {
  const [estado, enviar, pendiente] = useActionState<EstadoApartado, FormData>(apartarConFallas, {
    ronda: 0,
    estado: "inicial",
  });
  return (
    <Campos
      key={estado.ronda}
      origenes={origenes}
      valores={estado.estado === "error" ? estado.valores : inicial}
      errores={estado.estado === "error" ? estado.errores : {}}
      enviar={enviar}
      pendiente={pendiente}
    />
  );
}

function Campos({
  origenes,
  valores,
  errores,
  enviar,
  pendiente,
}: Omit<Datos, "inicial"> & {
  valores: ValoresApartado;
  errores: ErroresFormularioApartado;
  enviar: (datos: FormData) => void;
  pendiente: boolean;
}) {
  return (
    <form action={enviar} className="flex flex-col gap-4">
      <input type="hidden" name="idCaptura" value={valores.idCaptura} />
      <SelectorPildoras
        etiqueta="De dónde"
        name="sobreOrigenId"
        opciones={origenes.map((s) => ({
          valor: String(s.id),
          texto: s.nombre,
          detalle: formatearCifra(s.saldoCentavos),
        }))}
        valorInicial={valores.sobreOrigenId}
        envolver
        error={errores.sobre}
      />
      <Campo etiqueta="Cuánto apartar" error={errores.monto}>
        <CampoMonto name="monto" defaultValue={valores.monto} unidad="USD" />
      </Campo>
      <ErrorCampo>{errores.general}</ErrorCampo>
      <Boton type="submit" disabled={pendiente} className="w-full">
        Apartar para deudas
      </Boton>
    </form>
  );
}
