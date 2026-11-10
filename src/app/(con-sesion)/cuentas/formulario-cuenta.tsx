"use client";

import { Search } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { Boton, Campo, Entrada, SelectorColor, SelectorIcono, SelectorPildoras } from "@/components/formulario";
import { CirculoCategoria, Tarjeta, TarjetaPalida } from "@/components/ui";
import { buscarIconos } from "@/lib/categorias";
import { monedasDeCuenta, nombreDeTipo, tiposDeCuenta } from "@/lib/cuentas";
import { conFallas, mensajeDeFalla } from "@/lib/fallas";
import { type EstadoCuenta, type ValoresFormularioCuenta, guardarCuenta } from "./acciones";

/** Sin red o con una versión vieja, el mensaje junto al botón y lo escrito en su sitio (spec 002, criterio 19). */
const guardarConFallas = conFallas<EstadoCuenta>(guardarCuenta, (previo, datos, causa) => {
  const leer = (nombre: string) => {
    const valor = datos.get(nombre);
    return typeof valor === "string" ? valor : "";
  };
  return {
    ronda: (previo?.ronda ?? 0) + 1,
    estado: "error",
    errores: { general: mensajeDeFalla(causa, "no se guardó") },
    valores: {
      nombre: leer("nombre"),
      moneda: leer("moneda"),
      tipo: leer("tipo"),
      icono: leer("icono"),
      color: leer("color"),
    },
  };
});

const monedas = monedasDeCuenta.map((m) => ({ valor: m, texto: m }));
const tipos = tiposDeCuenta.map((t) => ({ valor: t, texto: nombreDeTipo[t] }));

/**
 * Crear o editar una cuenta (spec 013): nombre, moneda, tipo, icono con buscador y color, con la vista previa del
 * círculo. Como el formulario de categoría; funciona sin JavaScript y el buscador y la vista previa son mejoras.
 */
export function FormularioCuenta({
  id,
  inicial,
  monedaFija = false,
}: {
  id?: number;
  inicial: ValoresFormularioCuenta;
  /** Con movimientos la moneda no cambia (criterio 5): se muestra fija. */
  monedaFija?: boolean;
}) {
  const [estado, enviar, pendiente] = useActionState<EstadoCuenta, FormData>(guardarConFallas, {
    ronda: 0,
    estado: "inicial",
  });
  return (
    // Con la ronda como key los campos se montan de nuevo con lo tecleado tras cada respuesta.
    <Campos
      key={estado.ronda}
      id={id}
      valores={estado.estado === "error" ? estado.valores : inicial}
      monedaFija={monedaFija}
      errores={estado.estado === "error" ? estado.errores : {}}
      enviar={enviar}
      pendiente={pendiente}
    />
  );
}

function Campos({
  id,
  valores,
  monedaFija,
  errores,
  enviar,
  pendiente,
}: {
  id?: number;
  valores: ValoresFormularioCuenta;
  monedaFija: boolean;
  errores: Extract<EstadoCuenta, { estado: "error" }>["errores"];
  enviar: (formData: FormData) => void;
  pendiente: boolean;
}) {
  const [nombre, setNombre] = useState(valores.nombre);
  const [moneda, setMoneda] = useState(valores.moneda);
  const [tipo, setTipo] = useState(valores.tipo);
  const [icono, setIcono] = useState(valores.icono);
  const [color, setColor] = useState(valores.color);
  const [busqueda, setBusqueda] = useState("");
  const zonaIconos = useRef<HTMLFieldSetElement>(null);

  // Al abrir, la lista de iconos se desplaza hasta el elegido, que puede quedar abajo (al editar).
  useEffect(() => {
    const lista = zonaIconos.current?.querySelector<HTMLElement>("[data-iconos]");
    const elegido = lista?.querySelector("input:checked")?.closest("label");
    if (lista && elegido) lista.scrollTop = Math.max(0, elegido.offsetTop - 8);
  }, []);
  const visibles = new Set(buscarIconos(busqueda).map((i) => i.nombre));
  const nombreTipo = (tiposDeCuenta as readonly string[]).includes(tipo)
    ? nombreDeTipo[tipo as (typeof tiposDeCuenta)[number]]
    : "Cuenta";

  const vistaPrevia = (
    <div className="flex flex-col items-center gap-2 py-2 text-center">
      <CirculoCategoria icono={icono} color={color} tamano="lg" />
      <p className={`max-w-full break-words text-[16px] font-bold ${nombre.trim() ? "" : "text-texto-3"}`}>
        {nombre.trim() || "Nombre de la cuenta"}
      </p>
      <p className="text-[12px] text-texto-3">
        {nombreTipo} · {moneda}
      </p>
    </div>
  );

  return (
    <>
      <Tarjeta className="lg:col-span-7">
        <form action={enviar} className="flex flex-col gap-5">
          {id !== undefined ? <input type="hidden" name="id" value={id} /> : null}
          <div className="lg:hidden">{vistaPrevia}</div>

          <Campo etiqueta="Nombre" error={errores.nombre}>
            <Entrada
              name="nombre"
              defaultValue={valores.nombre}
              maxLength={40}
              autoComplete="off"
              autoFocus={id === undefined}
              placeholder="Zinli"
              onChange={(e) => setNombre(e.target.value)}
            />
          </Campo>

          {monedaFija ? (
            <p className="text-[13px] text-texto-2">
              <input type="hidden" name="moneda" value={valores.moneda} />
              Moneda: <strong>{valores.moneda}</strong>. Tiene movimientos, así que no cambia de moneda.
            </p>
          ) : (
            <SelectorPildoras
              etiqueta="Moneda"
              name="moneda"
              opciones={monedas}
              valorInicial={valores.moneda}
              onCambio={setMoneda}
              envolver
              error={errores.moneda}
            />
          )}

          <SelectorPildoras
            etiqueta="Tipo"
            name="tipo"
            opciones={tipos}
            valorInicial={valores.tipo}
            onCambio={setTipo}
            envolver
            error={errores.tipo}
          />

          <fieldset ref={zonaIconos} className="flex min-w-0 flex-col gap-2">
            <legend className="mb-1.5 text-[12px] font-semibold text-texto-3">Icono</legend>
            {/* Sin JavaScript el buscador no filtra: no se muestra. */}
            <label className="relative noscript:hidden">
              <Search
                size={16}
                aria-hidden
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-texto-3"
              />
              <Entrada
                type="search"
                aria-label="Buscar icono"
                placeholder="Buscar: banco, billetera, cripto…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                // Enter (o "Buscar" en el celular) solo busca: no envía el formulario con un icono sin elegir.
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.preventDefault();
                }}
                className="pl-10"
              />
            </label>
            {visibles.size === 0 ? <p className="text-[13px] text-texto-3">Ningún icono con esa palabra.</p> : null}
            <SelectorIcono
              name="icono"
              valorInicial={valores.icono}
              visibles={visibles}
              color={color}
              onCambio={setIcono}
              error={errores.icono}
            />
          </fieldset>

          <SelectorColor name="color" valorInicial={valores.color} onCambio={setColor} error={errores.color} />

          {errores.general ? (
            <p role="alert" className="text-[13px] font-semibold text-negativo">
              {errores.general}
            </p>
          ) : null}

          <Boton type="submit" disabled={pendiente} className="w-full">
            {pendiente ? "Guardando…" : id === undefined ? "Crear cuenta" : "Guardar cambios"}
          </Boton>
        </form>
      </Tarjeta>

      <TarjetaPalida className="hidden lg:col-span-5 lg:block">
        <p className="text-[13px] font-semibold text-palida-texto-2">Así se verá</p>
        <div className="mt-3 rounded-[18px] bg-tarjeta p-4 text-texto">{vistaPrevia}</div>
      </TarjetaPalida>
    </>
  );
}
