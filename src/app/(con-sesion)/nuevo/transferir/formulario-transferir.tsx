"use client";

import { useActionState, useState } from "react";
import { SelectorFecha } from "@/components/calendario";
import { Boton, Campo, CampoMonto, Entrada, ErrorCampo, SelectorPildoras } from "@/components/formulario";
import { type Moneda, formatearCentavos, montoPositivo } from "@/lib/dinero";
import { transferirConFallas } from "./transferir-con-fallas";
import type { ErroresFormularioTransferir, EstadoTransferir, ValoresTransferir } from "./valores";

type Cuenta = { id: number; nombre: string; moneda: Moneda; saldoCentavos: number };
type Sobre = { id: number; nombre: string };

/**
 * Transferir entre cuentas (spec 011): de qué cuenta, a qué cuenta, cuánto salió y cuánto llegó. Si llegó menos, la
 * diferencia es la comisión, un gasto del sobre que se elija. Sin JavaScript, radios y campos; con él, la línea de la
 * comisión se ve mientras se escribe.
 */
export function FormularioTransferir({
  inicial,
  cuentas,
  sobres,
  hoy,
}: {
  inicial: ValoresTransferir;
  cuentas: Cuenta[];
  sobres: Sobre[];
  hoy: string;
}) {
  const [estado, enviar, pendiente] = useActionState<EstadoTransferir, FormData>(transferirConFallas, {
    ronda: 0,
    estado: "inicial",
  });
  return (
    <Campos
      key={estado.ronda}
      cuentas={cuentas}
      sobres={sobres}
      hoy={hoy}
      valores={estado.estado === "inicial" ? inicial : estado.valores}
      errores={estado.estado === "error" ? estado.errores : {}}
      enviar={enviar}
      pendiente={pendiente}
    />
  );
}

function Campos({
  cuentas,
  sobres,
  hoy,
  valores,
  errores,
  enviar,
  pendiente,
}: {
  cuentas: Cuenta[];
  sobres: Sobre[];
  hoy: string;
  valores: ValoresTransferir;
  errores: ErroresFormularioTransferir;
  enviar: (datos: FormData) => void;
  pendiente: boolean;
}) {
  const [origenId, setOrigenId] = useState(valores.origenId);
  const [destinoId, setDestinoId] = useState(valores.destinoId);
  const [salio, setSalio] = useState(valores.salio);
  const [llego, setLlego] = useState(valores.llego);
  const [fecha, setFecha] = useState(valores.fecha);
  const opciones = cuentas.map((c) => ({
    valor: String(c.id),
    texto: c.nombre,
    detalle: formatearCentavos(c.saldoCentavos, c.moneda),
  }));
  const moneda = cuentas.find((c) => String(c.id) === origenId)?.moneda ?? "USD";
  const monedaDestino = cuentas.find((c) => String(c.id) === destinoId)?.moneda ?? moneda;
  const deSalio = montoPositivo(salio);
  const deLlego = llego.trim() === "" ? deSalio : montoPositivo(llego);
  const comision = deSalio !== null && deLlego !== null && deLlego < deSalio ? deSalio - deLlego : 0;

  return (
    <form action={enviar} className="flex flex-col gap-5">
      <input type="hidden" name="idCaptura" value={valores.idCaptura} />
      <SelectorPildoras
        etiqueta="De"
        name="origenId"
        opciones={opciones}
        valorInicial={valores.origenId}
        onCambio={setOrigenId}
        envolver
        error={errores.origen}
      />
      <SelectorPildoras
        etiqueta="A"
        name="destinoId"
        opciones={opciones}
        valorInicial={valores.destinoId}
        onCambio={setDestinoId}
        envolver
        error={errores.destino}
      />
      <Campo etiqueta="Cuánto salió" error={errores.salio}>
        <CampoMonto
          name="salio"
          defaultValue={valores.salio}
          unidad={moneda}
          onChange={(e) => setSalio(e.target.value)}
        />
      </Campo>
      <Campo etiqueta="Cuánto llegó" ayuda="Vacío si llegó lo mismo" error={errores.llego}>
        <CampoMonto
          name="llego"
          defaultValue={valores.llego}
          unidad={monedaDestino}
          onChange={(e) => setLlego(e.target.value)}
        />
      </Campo>
      {comision > 0 ? (
        <p aria-live="polite" className="text-[13px] font-semibold text-texto-2">
          Comisión: {formatearCentavos(comision, moneda)}. Se registra como un gasto, en Comisiones.
        </p>
      ) : null}
      <SelectorPildoras
        etiqueta="La comisión sale de"
        name="sobreId"
        opciones={sobres.map((s) => ({ valor: String(s.id), texto: s.nombre }))}
        valorInicial={valores.sobreId}
        envolver
        error={errores.sobre}
      />
      <SelectorFecha name="fecha" valor={fecha} hoy={hoy} onCambio={setFecha} error={errores.fecha} />
      <Campo etiqueta="Nota" ayuda="Opcional">
        <Entrada name="nota" defaultValue={valores.nota} maxLength={200} autoComplete="off" />
      </Campo>
      <ErrorCampo>{errores.general}</ErrorCampo>
      <Boton type="submit" disabled={pendiente} className="w-full">
        {pendiente ? "Transfiriendo…" : "Transferir"}
      </Boton>
    </form>
  );
}
