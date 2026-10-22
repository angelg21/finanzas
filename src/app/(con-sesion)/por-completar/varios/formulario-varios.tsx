"use client";

import { useActionState, useState } from "react";
import { Boton, Campo, CampoMonto, Entrada, ErrorCampo, SelectorPildoras, Selector } from "@/components/formulario";
import { CirculoCategoria } from "@/components/ui";
import { aTasa, bolivaresDesdeUsd, formatearCentavos, montoPositivo, unidadDe } from "@/lib/dinero";
import type { ErroresVarios } from "@/lib/por-completar";
import { completarVariosConFallas } from "./varios-con-fallas";
import type { EstadoVarios, ValoresVarios } from "./valores";

type Pendiente = {
  id: number;
  fecha: string;
  nota: string | null;
  categoria: string;
  icono: string;
  color: string;
};
type Datos = {
  pendientes: Pendiente[];
  cuentas: { id: number; nombre: string; moneda: string }[];
  sobres: { id: number; nombre: string }[];
  categorias: { id: number; nombre: string }[];
};

const formasPago = [
  { valor: "dolares", texto: "Dólares" },
  { valor: "vendiendo", texto: "Bolívares vendiendo USDT" },
  { valor: "saldo", texto: "Bolívares del saldo" },
];

/** La tasa escrita en diezmilésimas, o null mientras no se lee. */
function tasaLeida(texto: string): number | null {
  try {
    const t = aTasa(texto);
    return t > 0 ? t : null;
  } catch {
    return null;
  }
}

/**
 * Completar varios (spec 009, criterios 8 a 10): una forma de pago para todos; vendiendo USDT, una sola venta. Cada
 * pendiente con su casilla, su monto y su sobre. Al pie, lo recibido de la venta y lo que sobra o falta; si sobra, la
 * acción pregunta qué hacer con el resto.
 */
export function FormularioVarios({ inicial, ...datos }: Datos & { inicial: ValoresVarios }) {
  const [estado, enviar, pendiente] = useActionState<EstadoVarios, FormData>(completarVariosConFallas, {
    ronda: 0,
    estado: "inicial",
  });
  return (
    <Campos
      key={estado.ronda}
      {...datos}
      valores={estado.estado === "inicial" ? inicial : estado.valores}
      errores={estado.estado === "error" ? estado.errores : {}}
      restoBs={estado.estado === "resto" ? estado.restoBs : null}
      enviar={enviar}
      pendiente={pendiente}
    />
  );
}

function Campos({
  pendientes,
  cuentas,
  sobres,
  categorias,
  valores,
  errores,
  restoBs,
  enviar,
  pendiente,
}: Datos & {
  valores: ValoresVarios;
  errores: ErroresVarios;
  restoBs: number | null;
  enviar: (datos: FormData) => void;
  pendiente: boolean;
}) {
  const [forma, setForma] = useState(valores.forma);
  const [cuentaId, setCuentaId] = useState(valores.cuentaId);
  const [tasa, setTasa] = useState(valores.tasa);
  const [vendido, setVendido] = useState(valores.vendido);
  const [elegidos, setElegidos] = useState(new Set(valores.elegidos));
  const [montos, setMontos] = useState(valores.montos);
  const [resto, setResto] = useState(valores.resto);

  const enBolivares = forma !== "dolares";
  const unidad = enBolivares
    ? unidadDe("VES")
    : unidadDe(cuentas.find((c) => String(c.id) === cuentaId)?.moneda ?? "USD");
  const opcionesCuenta = cuentas.map((c) => ({ valor: String(c.id), texto: c.nombre, detalle: c.moneda }));
  const total = pendientes
    .filter((p) => elegidos.has(String(p.id)))
    .reduce((a, p) => a + (montoPositivo(montos[String(p.id)] ?? "") ?? 0), 0);
  const tasaDm = tasaLeida(tasa);
  const vendidoCentavos = montoPositivo(vendido);
  const recibidos =
    forma === "vendiendo" && tasaDm && vendidoCentavos ? bolivaresDesdeUsd(vendidoCentavos, tasaDm) : null;
  const familia = sobres.find((s) => s.nombre === "Familia");
  const categoriaFamilia = categorias.find((c) => c.nombre === "Familia");

  return (
    <form action={enviar} className="flex flex-col gap-5">
      <input type="hidden" name="idCaptura" value={valores.idCaptura} />
      <SelectorPildoras
        etiqueta="Forma de pago"
        name="forma"
        opciones={formasPago}
        valorInicial={valores.forma}
        onCambio={setForma}
        envolver
      />
      {forma === "dolares" ? (
        <SelectorPildoras
          etiqueta="Cuenta"
          name="cuentaId"
          opciones={opcionesCuenta}
          valorInicial={valores.cuentaId}
          onCambio={setCuentaId}
          envolver
          error={errores.cuenta}
        />
      ) : null}
      {forma === "vendiendo" ? (
        <SelectorPildoras
          etiqueta="Salen de"
          name="cuentaVentaId"
          opciones={opcionesCuenta}
          valorInicial={valores.cuentaVentaId}
          envolver
          error={errores.cuenta}
        />
      ) : null}
      {enBolivares ? (
        <div className="grid grid-cols-2 gap-3">
          {forma === "vendiendo" ? (
            <Campo etiqueta="USDT vendidos" error={errores.vendido}>
              <Entrada
                name="vendido"
                inputMode="decimal"
                autoComplete="off"
                placeholder="50"
                defaultValue={valores.vendido}
                onChange={(e) => setVendido(e.target.value)}
              />
            </Campo>
          ) : null}
          <Campo etiqueta="Tasa Bs/USD" error={errores.tasa}>
            <Entrada
              name="tasa"
              inputMode="decimal"
              autoComplete="off"
              placeholder="241,8"
              defaultValue={valores.tasa}
              onChange={(e) => setTasa(e.target.value)}
            />
          </Campo>
        </div>
      ) : null}

      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1.5 text-[12px] font-semibold text-texto-3">Gastos</legend>
        <ul className="divide-y divide-tarjeta-borde">
          {pendientes.map((p) => {
            const id = String(p.id);
            const marcado = elegidos.has(id);
            return (
              <li key={p.id} className="flex flex-col gap-2 py-3">
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    name="pendiente"
                    value={id}
                    defaultChecked={marcado}
                    onChange={(e) =>
                      setElegidos((antes) => {
                        const nuevos = new Set(antes);
                        if (e.target.checked) nuevos.add(id);
                        else nuevos.delete(id);
                        return nuevos;
                      })
                    }
                    className="size-5 shrink-0 accent-enlace"
                  />
                  <CirculoCategoria icono={p.icono} color={p.color} tamano="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-bold">{p.nota ?? p.categoria}</span>
                    <span className="block text-[12px] text-texto-3">
                      {[p.nota ? p.categoria : null, p.fecha.split("-").reverse().join("-")]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </label>
                {marcado ? (
                  <div className="grid grid-cols-2 gap-2 pl-8">
                    <CampoMonto
                      name={`monto-${id}`}
                      defaultValue={valores.montos[id] ?? ""}
                      unidad={unidad}
                      aria-label={`Monto de ${p.nota ?? p.categoria}`}
                      onChange={(e) => setMontos((m) => ({ ...m, [id]: e.target.value }))}
                    />
                    <Selector
                      name={`sobre-${id}`}
                      defaultValue={valores.sobres[id] ?? ""}
                      aria-label={`Sobre de ${p.nota ?? p.categoria}`}
                    >
                      <option value="">Sobre…</option>
                      {sobres.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nombre}
                        </option>
                      ))}
                    </Selector>
                    {errores.porPendiente?.[p.id] ? (
                      <span className="col-span-2">
                        <ErrorCampo>{errores.porPendiente[p.id]}</ErrorCampo>
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </fieldset>

      <p aria-live="polite" className="text-[13px] font-semibold text-texto-2">
        Gastos: {formatearCentavos(total, enBolivares ? "VES" : "USD")}
        {recibidos !== null
          ? ` · la venta da ${formatearCentavos(recibidos, "VES")} · ${
              recibidos >= total
                ? `sobran ${formatearCentavos(recibidos - total, "VES")}`
                : `faltan ${formatearCentavos(total - recibidos, "VES")}: Bolívares quedará en negativo`
            }`
          : ""}
      </p>

      {restoBs !== null || valores.resto !== "" ? (
        <div
          role="group"
          aria-label="El resto de la venta"
          className="flex flex-col gap-3 rounded-[14px] bg-tarjeta-hover p-3"
        >
          <p className="text-[14px] font-bold">
            {restoBs !== null ? `Sobran ${formatearCentavos(restoBs, "VES")} de la venta.` : "El resto de la venta"}{" "}
            ¿Qué hago con ellos?
          </p>
          <SelectorPildoras
            etiqueta="El resto"
            name="resto"
            opciones={[
              { valor: "bolivares", texto: "A mi cuenta de Bolívares" },
              { valor: "gasto", texto: "No es mío: registrarlo como gasto" },
            ]}
            valorInicial={valores.resto}
            onCambio={setResto}
            envolver
            error={errores.resto}
          />
          {resto === "gasto" ? (
            <div className="grid grid-cols-2 gap-2">
              <Selector
                name="restoCategoriaId"
                defaultValue={valores.restoCategoriaId || String(categoriaFamilia?.id ?? "")}
                aria-label="Categoría del resto"
              >
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </Selector>
              <Selector
                name="restoSobreId"
                defaultValue={valores.restoSobreId || String(familia?.id ?? "")}
                aria-label="Sobre del resto"
              >
                {sobres.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </Selector>
            </div>
          ) : null}
        </div>
      ) : null}

      <ErrorCampo>{errores.general}</ErrorCampo>
      <Boton type="submit" disabled={pendiente || elegidos.size === 0} className="w-full">
        {pendiente
          ? "Registrando…"
          : elegidos.size === 1
            ? "Registrar 1 gasto"
            : `Registrar los ${elegidos.size} gastos`}
      </Boton>
    </form>
  );
}
