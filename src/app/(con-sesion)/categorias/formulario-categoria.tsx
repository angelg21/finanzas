"use client";

import { RotateCcw, Search } from "lucide-react";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { Boton, Campo, Entrada, SelectorColor, SelectorIcono, SelectorPildoras } from "@/components/formulario";
import { CirculoCategoria, Tarjeta, TarjetaPalida } from "@/components/ui";
import { type TipoCategoria, buscarIconos } from "@/lib/categorias";
import { conFallas, mensajeDeFalla } from "@/lib/fallas";
import { type EstadoCategoria, type ValoresCategoria, guardarCategoria, restaurarCategoriaAccion } from "./acciones";

/** Sin red o con una versión vieja, el mensaje junto al botón y lo escrito en su sitio (spec 002, criterio 19). */
const guardarConFallas = conFallas<EstadoCategoria>(guardarCategoria, (previo, datos, causa) => {
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
      tipo: leer("tipo") === "ingreso" ? "ingreso" : "gasto",
      icono: leer("icono"),
      color: leer("color"),
    },
  };
});

const tipos = [
  { valor: "gasto", texto: "Gasto" },
  { valor: "ingreso", texto: "Ingreso" },
];

/**
 * Crear o editar una categoría (spec 001, criterios 18 a 20, 23 y 24), como el formulario de la referencia
 * docs/referencias/categorias-gestor-crear.jpg: nombre, tipo, icono con buscador y color, con una vista
 * previa que cambia mientras se elige. Funciona sin JavaScript; el buscador y la vista previa son mejoras.
 */
export function FormularioCategoria({
  id,
  inicial,
  movimientos = 0,
  volver,
}: {
  id?: number;
  inicial: ValoresCategoria;
  movimientos?: number;
  volver?: string;
}) {
  const [estado, enviar, pendiente] = useActionState<EstadoCategoria, FormData>(guardarConFallas, {
    ronda: 0,
    estado: "inicial",
  });
  const valores = estado.estado === "error" ? estado.valores : inicial;

  return (
    // Con la ronda como key los campos se montan de nuevo con lo tecleado tras cada respuesta.
    <Campos
      key={estado.ronda}
      id={id}
      valores={valores}
      movimientos={movimientos}
      volver={volver}
      errores={estado.estado === "error" ? estado.errores : {}}
      archivada={estado.estado === "error" ? estado.archivada : undefined}
      enviar={enviar}
      pendiente={pendiente}
    />
  );
}

function Campos({
  id,
  valores,
  movimientos,
  volver,
  errores,
  archivada,
  enviar,
  pendiente,
}: {
  id?: number;
  valores: ValoresCategoria;
  movimientos: number;
  volver?: string;
  errores: Extract<EstadoCategoria, { estado: "error" }>["errores"];
  archivada?: number;
  enviar: (formData: FormData) => void;
  pendiente: boolean;
}) {
  const [nombre, setNombre] = useState(valores.nombre);
  const [tipo, setTipo] = useState<TipoCategoria>(valores.tipo);
  const [icono, setIcono] = useState(valores.icono);
  const [color, setColor] = useState(valores.color);
  const [busqueda, setBusqueda] = useState("");
  const zonaIconos = useRef<HTMLFieldSetElement>(null);
  const formularioRestaurar = useId();

  // Al abrir, la lista de iconos se desplaza hasta el elegido, que puede quedar abajo (al editar).
  useEffect(() => {
    const lista = zonaIconos.current?.querySelector<HTMLElement>("[data-iconos]");
    const elegido = lista?.querySelector("input:checked")?.closest("label");
    if (lista && elegido) lista.scrollTop = Math.max(0, elegido.offsetTop - 8);
  }, []);
  const visibles = new Set(buscarIconos(busqueda).map((i) => i.nombre));
  // Con movimientos el tipo no cambia (criterio 20); desde la captura de gasto, es de gasto (25). Fijo y oculto.
  const conMovimientos = id !== undefined && movimientos > 0;
  const tipoFijo = conMovimientos || volver !== undefined;

  const vistaPrevia = (
    <div className="flex flex-col items-center gap-2 py-2 text-center">
      <CirculoCategoria icono={icono} color={color} tamano="lg" />
      <p className={`max-w-full truncate text-[16px] font-bold ${nombre.trim() ? "" : "text-texto-3"}`}>
        {nombre.trim() || "Nombre de la categoría"}
      </p>
      <p className="text-[12px] text-texto-3">{tipo === "gasto" ? "Categoría de gasto" : "Categoría de ingreso"}</p>
    </div>
  );

  return (
    <>
      <Tarjeta className="lg:col-span-7">
        <form action={enviar} className="flex flex-col gap-5">
          {id !== undefined ? <input type="hidden" name="id" value={id} /> : null}
          {volver ? <input type="hidden" name="volver" value={volver} /> : null}
          <div className="lg:hidden">{vistaPrevia}</div>

          <Campo etiqueta="Nombre" error={errores.nombre}>
            <Entrada
              name="nombre"
              defaultValue={valores.nombre}
              maxLength={40}
              autoComplete="off"
              autoFocus={id === undefined}
              placeholder="Mascotas"
              onChange={(e) => setNombre(e.target.value)}
            />
          </Campo>
          {archivada !== undefined ? (
            // Pertenece al formulario de restaurar, fuera de este: Enter aquí guarda, nunca restaura (criterio 19).
            <button
              type="submit"
              form={formularioRestaurar}
              className="-mt-3 flex w-fit items-center gap-1.5 rounded-full px-2 py-1 text-[13px] font-bold text-enlace hover:bg-tarjeta-hover"
            >
              <RotateCcw size={14} aria-hidden />
              Restaurar la archivada
            </button>
          ) : null}

          {tipoFijo ? (
            <p className="text-[13px] text-texto-2">
              <input type="hidden" name="tipo" value={valores.tipo} />
              Tipo: <strong>{valores.tipo === "gasto" ? "Gasto" : "Ingreso"}</strong>.{" "}
              {conMovimientos
                ? "Tiene movimientos, así que no cambia de tipo."
                : "Viene de la captura de gasto, así que es de gasto."}
            </p>
          ) : (
            <SelectorPildoras
              etiqueta="Tipo"
              name="tipo"
              opciones={tipos}
              valorInicial={valores.tipo}
              onCambio={(v) => setTipo(v === "ingreso" ? "ingreso" : "gasto")}
              envolver
              error={errores.tipo}
            />
          )}

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
                placeholder="Buscar: carro, café, mascota…"
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
            {pendiente ? "Guardando…" : id === undefined ? "Crear categoría" : "Guardar cambios"}
          </Boton>
        </form>
        {archivada !== undefined ? (
          // Formulario aparte, sin nada visible: su único botón vive arriba, bajo el nombre, con form={id}.
          <form id={formularioRestaurar} action={restaurarCategoriaAccion} className="hidden">
            <input type="hidden" name="restaurar" value={archivada} />
            {volver ? <input type="hidden" name="volver" value={volver} /> : null}
          </form>
        ) : null}
      </Tarjeta>

      <TarjetaPalida className="hidden lg:col-span-5 lg:block">
        <p className="text-[13px] font-semibold text-palida-texto-2">Así se verá</p>
        <div className="mt-3 rounded-[18px] bg-tarjeta p-4 text-texto">{vistaPrevia}</div>
      </TarjetaPalida>
    </>
  );
}
