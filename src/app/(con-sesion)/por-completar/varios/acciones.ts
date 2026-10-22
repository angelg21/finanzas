"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { categoriasDeGastoPorUso, saldosPorCuenta, sobresParaGasto } from "@/db/consultas";
import { completarPorCompletar, listarPorCompletar } from "@/db/por-completar";
import { esIdCaptura, prefijoDeCaptura } from "@/lib/captura";
import { mensajeDeFalla } from "@/lib/fallas";
import { hoyEnCaracas } from "@/lib/fechas";
import type { FormaPago } from "@/lib/gastos";
import { type ItemVarios, prepararCompletarVarios } from "@/lib/por-completar";
import { registrarFalla } from "@/app/registro-de-fallas";
import { leerSesion } from "@/app/sesion";
import { type EstadoVarios, tecleadoDe } from "./valores";

const queNoSeGuardo = "no se registró nada";
const formas: readonly string[] = ["dolares", "vendiendo", "saldo"] satisfies FormaPago[];

function revalidar() {
  for (const ruta of ["/", "/movimientos", "/sobres", "/cuentas", "/nuevo", "/por-completar"]) revalidatePath(ruta);
  revalidatePath("/sobres/[id]", "page");
}

/**
 * Completa varios pendientes a la vez (spec 009, criterios 8 a 10): con la misma forma de pago, y vendiendo USDT con
 * una sola venta. Si de la venta sobran bolívares y no se dijo qué hacer, responde "resto" y la pantalla pregunta.
 * Todo en una transacción que borra los pendientes; si alguno ya no está, no se guarda nada.
 */
export async function completarVariosAccion(previo: EstadoVarios, datos: FormData): Promise<EstadoVarios> {
  const sesion = await leerSesion();
  if (!sesion) {
    const general = mensajeDeFalla("sesion", queNoSeGuardo);
    return { ronda: (previo?.ronda ?? 0) + 1, estado: "error", errores: { general }, valores: tecleadoDe(datos) };
  }
  const ronda = (previo?.ronda ?? 0) + 1;
  const valores = tecleadoDe(datos);
  if (!esIdCaptura(valores.idCaptura)) {
    return { ronda, estado: "error", errores: { general: mensajeDeFalla("version") }, valores };
  }
  const forma = formas.includes(valores.forma) ? (valores.forma as FormaPago) : null;
  if (!forma) return { ronda, estado: "error", errores: { general: "Elige la forma de pago" }, valores };

  const [pendientes, sobres, cuentas, categorias] = await Promise.all([
    listarPorCompletar(),
    sobresParaGasto(),
    saldosPorCuenta(),
    categoriasDeGastoPorUso(),
  ]);
  const ids = [...new Set(valores.elegidos.map(Number))];
  const elegidos = pendientes.filter((p) => ids.includes(p.id));
  if (elegidos.length !== ids.length) {
    return {
      ronda,
      estado: "error",
      errores: { general: "Alguno ya se completó o se descartó: recarga la lista" },
      valores,
    };
  }
  // Inversión no se ofrece aquí: sacar de ella pide una confirmación propia, la de la captura.
  const aptos = sobres.filter((s) => s.tipo !== "inversion");
  const porPendiente: Record<number, string> = {};
  const deGasto = new Set(categorias.map((c) => c.id));
  const items: ItemVarios[] = elegidos.map((p) => {
    const sobre = aptos.find((s) => String(s.id) === valores.sobres[String(p.id)]);
    if (!sobre) porPendiente[p.id] = "Elige un sobre";
    // Su categoría tiene que seguir siendo de gasto y estar activa (guardian-datos, 0007, hallazgo 3).
    if (!deGasto.has(p.categoriaId)) porPendiente[p.id] = "Su categoría ya no se ofrece: complétalo uno por uno";
    return {
      pendienteId: p.id,
      monto: valores.montos[String(p.id)] ?? "",
      sobreId: sobre?.id ?? 0,
      categoriaId: p.categoriaId,
      fecha: p.fecha,
      nota: p.nota ?? "",
    };
  });
  if (Object.keys(porPendiente).length > 0) return { ronda, estado: "error", errores: { porPendiente }, valores };

  const enDolares = cuentas.filter((c) => c.moneda !== "VES");
  const elegida = forma === "vendiendo" ? valores.cuentaVentaId : valores.cuentaId;
  const cuentaOrigen = enDolares.find((c) => String(c.id) === elegida);
  const bolivares = cuentas.find((c) => c.moneda === "VES") ?? null;
  const resto = valores.resto === "bolivares" || valores.resto === "gasto" ? valores.resto : "";
  const restoCategoria = categorias.find((c) => String(c.id) === valores.restoCategoriaId);
  const restoSobre = aptos.find((s) => String(s.id) === valores.restoSobreId);
  const hoy = hoyEnCaracas(new Date());
  const preparado = prepararCompletarVarios(
    {
      forma,
      // Sin una cuenta válida, una en bolívares hace que prepararGasto pida "Elige una cuenta en dólares".
      cuentaOrigen: cuentaOrigen ?? { id: 0, moneda: "VES" },
      cuentaBolivares: bolivares,
      tasa: valores.tasa,
      vendido: valores.vendido,
      items,
      resto,
      restoCategoriaId: restoCategoria?.id ?? null,
      restoSobreId: restoSobre?.id ?? null,
    },
    hoy,
  );
  if (preparado.estado === "resto") return { ronda, estado: "resto", restoBs: preparado.restoBs, valores };
  if (preparado.estado === "error") return { ronda, estado: "error", errores: preparado.errores, valores };

  // Una referencia por fila con el id de esta captura: la venta, un gasto por pendiente y el resto, si lo hay.
  const prefijo = prefijoDeCaptura(valores.idCaptura);
  let siguiente = 0;
  const filas = preparado.filas.map((f) => {
    if (f.tipo === "transferencia") return { ...f, referenciaExterna: `${prefijo}transferencia` };
    const item = items[siguiente++];
    return { ...f, referenciaExterna: item ? `${prefijo}gasto-${item.pendienteId}` : `${prefijo}gasto-resto` };
  });
  let registro: Awaited<ReturnType<typeof completarPorCompletar>>;
  try {
    registro = await completarPorCompletar(valores.idCaptura, preparado.pendientes, filas);
  } catch (error) {
    registrarFalla("No se pudieron completar los gastos", error);
    return { ronda, estado: "error", errores: { general: mensajeDeFalla("otra", queNoSeGuardo) }, valores };
  }
  if ("otra" in registro) {
    const general = "Esta captura ya se usó para otra cosa: vuelve a tocar Registrar.";
    return { ronda, estado: "error", errores: { general }, valores: { ...valores, idCaptura: crypto.randomUUID() } };
  }
  if ("faltan" in registro) {
    return {
      ronda,
      estado: "error",
      errores: { general: "Alguno ya se completó o se descartó: recarga la lista" },
      valores,
    };
  }
  // Un reintento que ya había guardado todo cae aquí con lo de antes: también vuelve a la lista.
  revalidar();
  redirect("/por-completar?completados=1");
}
