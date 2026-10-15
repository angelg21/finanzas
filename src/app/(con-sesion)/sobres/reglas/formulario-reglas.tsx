"use client";

import { CheckCircle2, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Boton, Campo, Entrada, ErrorCampo, SelectorPildoras } from "@/components/formulario";
import { Tarjeta } from "@/components/ui";
import { formatearCentavos, leerExacto } from "@/lib/dinero";
import { PUNTOS_BASE_TOTAL } from "@/lib/reparto";
import { formatearPorcentaje } from "@/lib/reglas";
import { guardarConFallas } from "./guardar-con-fallas";
import { type ErroresFormularioReglas, type EstadoReglas, type ValoresReglas, campoTipo, campoValor } from "./valores";

type Datos = {
  editables: { sobreId: number; nombre: string }[];
  /** Sobres de tipo fondo: su aporte se muestra, pero se cambia en su desglose. */
  fondos: { sobreId: number; nombre: string; aporteCentavos: number | null }[];
  emergencia: { nombre: string } | null;
};

const tipos = [
  { valor: "fijo", texto: "Fijo" },
  { valor: "porcentaje", texto: "%" },
  { valor: "ninguna", texto: "Ninguna" },
];

/*
  Qué se ve según el tipo elegido en cada fila, en CSS con :has() sobre el radio marcado: funciona sin JavaScript.
  Cada fila es su propio grupo `regla`.
*/
const sinValor = "group-has-[[value=ninguna]:checked]/regla:hidden";
const soloFijo = "hidden group-has-[[value=fijo]:checked]/regla:inline";
const soloPorcentaje = "hidden group-has-[[value=porcentaje]:checked]/regla:inline";

/** Las reglas de reparto de cada sobre, el tope de Emergencia y la suma de los porcentajes. */
export function FormularioReglas({ inicial, ...datos }: Datos & { inicial: ValoresReglas }) {
  const [estado, enviar, pendiente] = useActionState<EstadoReglas, FormData>(guardarConFallas, {
    ronda: 0,
    estado: "inicial",
  });
  return (
    <Campos
      key={estado.ronda}
      {...datos}
      valores={estado.estado === "inicial" ? inicial : estado.valores}
      errores={estado.estado === "error" ? estado.errores : {}}
      guardado={estado.estado === "guardado" ? { sinPorcentajes: estado.sinPorcentajes } : null}
      enviar={enviar}
      pendiente={pendiente}
    />
  );
}

function Campos({
  editables,
  fondos,
  emergencia,
  valores,
  errores,
  guardado,
  enviar,
  pendiente,
}: Datos & {
  valores: ValoresReglas;
  errores: ErroresFormularioReglas;
  guardado: { sinPorcentajes: boolean } | null;
  enviar: (formData: FormData) => void;
  pendiente: boolean;
}) {
  // Lo elegido, para la suma de los porcentajes mientras se escribe. Los campos siguen siendo no controlados.
  const [reglas, setReglas] = useState(valores.reglas);
  const cambiar = (sobreId: number, cambio: Partial<{ tipo: string; valor: string }>) =>
    setReglas((r) => ({ ...r, [sobreId]: { ...(r[sobreId] ?? { tipo: "ninguna", valor: "" }), ...cambio } }));

  const porcentajes = editables.filter((s) => reglas[s.sobreId]?.tipo === "porcentaje");
  const lecturas = porcentajes.map((s) => leerExacto(reglas[s.sobreId]?.valor ?? ""));
  const suma = lecturas.reduce((a, l) => a + (l.ok ? l.valor : 0), 0);
  const legibles = lecturas.every((l) => l.ok);

  return (
    <form action={enviar} className="flex flex-col gap-4 lg:col-span-8 lg:col-start-3">
      <Tarjeta>
        <p className="mb-2 text-[13px] text-texto-2">
          Al repartir un ingreso, primero van los fijos, una vez al mes; lo que queda se reparte por porcentaje.
        </p>
        <div className="flex flex-col">
          {editables.map((s) => {
            const regla = valores.reglas[s.sobreId] ?? { tipo: "ninguna", valor: "" };
            return (
              <div key={s.sobreId} className="group/regla flex flex-col gap-2 border-t border-tarjeta-borde py-3">
                <p className="text-[13px] font-extrabold uppercase tracking-wide">{s.nombre}</p>
                <div className="flex flex-wrap items-end gap-3">
                  <SelectorPildoras
                    etiqueta="Regla"
                    name={campoTipo(s.sobreId)}
                    opciones={tipos}
                    valorInicial={regla.tipo}
                    onCambio={(tipo) => cambiar(s.sobreId, { tipo })}
                    envolver
                  />
                  <div className={`flex items-center gap-2 ${sinValor}`}>
                    <span className="w-32">
                      <Entrada
                        name={campoValor(s.sobreId)}
                        inputMode="decimal"
                        autoComplete="off"
                        aria-label={`Valor de la regla de ${s.nombre}`}
                        aria-invalid={errores.sobres?.[s.sobreId] ? true : undefined}
                        defaultValue={regla.valor}
                        onChange={(e) => cambiar(s.sobreId, { valor: e.target.value })}
                        className="tabular text-right font-bold"
                      />
                    </span>
                    <span className="text-[13px] font-bold text-texto-3">
                      <span className={soloFijo}>USD al mes</span>
                      <span className={soloPorcentaje}>%</span>
                    </span>
                  </div>
                </div>
                <ErrorCampo>{errores.sobres?.[s.sobreId]}</ErrorCampo>
              </div>
            );
          })}
          {fondos.map((f) => (
            <div key={f.sobreId} className="flex items-center gap-3 border-t border-tarjeta-borde py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-extrabold uppercase tracking-wide">{f.nombre}</p>
                <p className="mt-0.5 text-[12px] text-texto-3">
                  {f.aporteCentavos === null
                    ? "Sin regla"
                    : `Fijo · ${formatearCentavos(f.aporteCentavos)} al mes, calculado de su desglose`}
                </p>
              </div>
              <Link
                href={`/sobres/${f.sobreId}`}
                className="flex shrink-0 items-center gap-0.5 text-[13px] font-semibold text-enlace hover:text-texto"
              >
                Desglose
                <ChevronRight size={16} aria-hidden />
              </Link>
            </div>
          ))}
        </div>

        {emergencia ? (
          <div className="mt-2 border-t border-tarjeta-borde pt-4">
            <Campo
              etiqueta={`Tope de ${emergencia.nombre} (USD)`}
              ayuda="Al llegarle, deja de recibir y su parte va a los otros porcentajes."
              error={errores.tope}
            >
              <Entrada name="tope" inputMode="decimal" autoComplete="off" defaultValue={valores.tope} />
            </Campo>
          </div>
        ) : null}

        <div className="mt-4 border-t border-tarjeta-borde pt-3 text-[13px] font-semibold">
          {porcentajes.length === 0 ? (
            <p className="text-texto-2">Sin porcentajes: lo que quede tras los fijos se quedará en Por asignar.</p>
          ) : (
            <p className={legibles && suma === PUNTOS_BASE_TOTAL ? "text-texto" : "text-negativo"}>
              Porcentajes: {legibles ? formatearPorcentaje(suma) : "revisa los valores"}
            </p>
          )}
          <ErrorCampo>{errores.total}</ErrorCampo>
        </div>
      </Tarjeta>

      {guardado ? (
        <p role="status" className="flex items-start gap-2 text-[13px] font-semibold text-positivo">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden />
          {guardado.sinPorcentajes
            ? "Reglas guardadas. Sin porcentajes, lo que quede tras los fijos se quedará en Por asignar."
            : "Reglas guardadas. Valen para los próximos repartos; los anteriores no cambian."}
        </p>
      ) : null}
      {errores.general ? (
        <p role="alert" className="text-[13px] font-semibold text-negativo">
          {errores.general}
        </p>
      ) : null}
      <Boton type="submit" disabled={pendiente} className="w-full">
        {pendiente ? "Guardando…" : "Guardar reglas"}
      </Boton>
    </form>
  );
}
