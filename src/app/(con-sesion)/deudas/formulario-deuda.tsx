"use client";

import { useActionState, useState } from "react";
import { SelectorFecha } from "@/components/calendario";
import { Boton, Campo, CampoMonto, Entrada, ErrorCampo, SelectorPildoras } from "@/components/formulario";
import { guardarConFallas } from "./guardar-con-fallas";
import type { ErroresFormularioDeuda, EstadoDeuda, ValoresDeuda } from "./valores";

type Datos = {
  inicial: ValoresDeuda;
  /** Las cuentas activas en dólares, para la cuenta prevista. */
  cuentas: { id: number; nombre: string; moneda: string }[];
  hoy: string;
  /** Al editar, el sentido no cambia y el monto es el inicial: pagos, préstamos y cobros van aparte. */
  editando: boolean;
};

/**
 * Registrar o corregir una deuda (spec 005, criterios 1 y 16): sentido, persona, cuánto se debe, fecha prevista,
 * cuenta prevista y nota. La cuenta prevista solo va en "debo": se oculta con :has() sobre el radio "Me deben", así
 * que funciona sin JavaScript, y el servidor la ignora en "me deben" aunque llegue.
 */
export function FormularioDeuda({ inicial, ...datos }: Datos) {
  const [estado, enviar, pendiente] = useActionState<EstadoDeuda, FormData>(guardarConFallas, {
    ronda: 0,
    estado: "inicial",
  });
  return (
    <Campos
      key={estado.ronda}
      {...datos}
      valores={estado.estado === "error" ? estado.valores : inicial}
      errores={estado.estado === "error" ? estado.errores : {}}
      enviar={enviar}
      pendiente={pendiente}
    />
  );
}

function Campos({
  valores,
  errores,
  cuentas,
  hoy,
  editando,
  enviar,
  pendiente,
}: Omit<Datos, "inicial"> & {
  valores: ValoresDeuda;
  errores: ErroresFormularioDeuda;
  enviar: (datos: FormData) => void;
  pendiente: boolean;
}) {
  const [fecha, setFecha] = useState(valores.fechaPrevista);
  const conCuenta = !editando || valores.sentido === "debo";

  return (
    <form action={enviar} className="group/deuda flex flex-col gap-4">
      <input type="hidden" name="id" value={valores.id} />
      <input type="hidden" name="idCaptura" value={valores.idCaptura} />
      {editando ? (
        <input type="hidden" name="sentido" value={valores.sentido} />
      ) : (
        <SelectorPildoras
          etiqueta="Sentido"
          name="sentido"
          opciones={[
            { valor: "debo", texto: "Debo" },
            { valor: "me_deben", texto: "Me deben" },
          ]}
          valorInicial={valores.sentido}
          envolver
        />
      )}

      <Campo etiqueta="Persona" error={errores.persona}>
        <Entrada name="persona" defaultValue={valores.persona} maxLength={80} autoComplete="off" />
      </Campo>

      <Campo
        etiqueta={editando ? "Monto inicial" : "Cuánto se debe hoy"}
        ayuda={editando ? "Lo que se debía al registrarla. Pagos, préstamos y cobros se suman aparte." : undefined}
        error={errores.monto}
      >
        <CampoMonto name="monto" defaultValue={valores.monto} unidad="USD" />
      </Campo>

      <SelectorFecha
        name="fechaPrevista"
        variante="futura"
        etiqueta="Fecha prevista"
        valor={fecha}
        hoy={hoy}
        onCambio={setFecha}
        error={errores.fechaPrevista}
      />

      {conCuenta ? (
        <div className="group-has-[[value=me_deben]:checked]/deuda:hidden">
          <SelectorPildoras
            etiqueta="Cuenta prevista"
            name="cuentaPrevistaId"
            opciones={[
              { valor: "", texto: "Sin definir" },
              ...cuentas.map((c) => ({ valor: String(c.id), texto: c.nombre, detalle: c.moneda })),
            ]}
            valorInicial={valores.cuentaPrevistaId}
            envolver
            error={errores.cuentaPrevista}
          />
        </div>
      ) : null}

      <Campo etiqueta="Nota" ayuda="Opcional">
        <Entrada name="nota" defaultValue={valores.nota} maxLength={200} autoComplete="off" />
      </Campo>

      <ErrorCampo>{errores.general}</ErrorCampo>
      <Boton type="submit" disabled={pendiente} className="w-full">
        {editando ? "Guardar cambios" : "Registrar"}
      </Boton>
    </form>
  );
}
