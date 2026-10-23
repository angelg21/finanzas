"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { saldosPorCuenta } from "@/db/consultas";
import { registrarCaptura } from "@/db/movimientos";
import { categoriasDeIngresoPorUso, datosDelReparto } from "@/db/reparto";
import { esIdCaptura, referenciaDeCaptura, referenciaDeReasignacion, resolverReintento } from "@/lib/captura";
import { mensajeDeFalla } from "@/lib/fallas";
import { fechaDesdeAtajo, hoyEnCaracas } from "@/lib/fechas";
import { type EntradaIngreso, type FilaIngreso, camposDePropuesta, prepararIngreso } from "@/lib/ingresos";
import { registrarFalla } from "@/app/registro-de-fallas";
import { leerSesion } from "@/app/sesion";
import { etiquetaDelFormulario } from "../../etiqueta-del-formulario";
import {
  type ErroresFormularioIngreso,
  type EstadoIngreso,
  type ResultadoIngreso,
  type ValoresIngreso,
  claveDePropuesta,
  tecleadoDe,
} from "./valores";

const cifra = z.string().trim().max(30, "Ese número es demasiado largo");

const esquema = z.object({
  monto: cifra,
  cuentaId: z.string(),
  categoriaId: z.string(),
  fecha: z.string().trim(),
  nota: z.string().trim().max(200, "La nota admite hasta 200 caracteres"),
  etiquetaId: z.string(),
  etiquetaNueva: z.string().max(60, "Hasta 30 caracteres"),
  // Sin un id de captura válido, la página es de antes de esta versión.
  idCaptura: z.string().refine(esIdCaptura, mensajeDeFalla("version")),
  propuestaDe: z.string(),
  asignaciones: z
    .record(z.string(), cifra)
    .refine((a) => Object.keys(a).length <= 50, "Demasiados sobres en el reparto"),
});

/** Un campo suelto del formulario, fuera de lo que se vuelve a llenar. */
function campo(formData: FormData, nombre: string) {
  const valor = formData.get(nombre);
  return typeof valor === "string" ? valor : "";
}

const queNoSeGuardo = "el ingreso no se guardó";

/**
 * Registra un ingreso y su reparto (spec 004, criterios 6 a 8). Para `useActionState`. Con la sesión vencida no
 * redirige: responde con el mensaje y lo tecleado, para que la pantalla no se pierda.
 */
export async function registrarIngreso(previo: EstadoIngreso, formData: FormData): Promise<EstadoIngreso> {
  const sesion = await leerSesion();
  if (!sesion) {
    const general = mensajeDeFalla("sesion", queNoSeGuardo);
    return { ronda: (previo?.ronda ?? 0) + 1, estado: "error", errores: { general }, valores: tecleadoDe(formData) };
  }
  return { ronda: (previo?.ronda ?? 0) + 1, ...(await procesarIngreso(formData)) };
}

/**
 * Nada del formulario se cree a ciegas: la cuenta, la categoría, "Por asignar" y los sobres del reparto se buscan en
 * la base entre los activos, y la moneda sale de la cuenta. Los montos de cada sobre se guardan tal como se
 * confirmaron: la propuesta solo se calcula para llenar los campos, nunca para reemplazarlos.
 */
async function procesarIngreso(formData: FormData): Promise<ResultadoIngreso> {
  /** Lo que quedó sin repartir cuando ya se confirmó el aviso. */
  const confirmarSinAsignar = campo(formData, "confirmarSinAsignar");
  const leido = esquema.safeParse(tecleadoDe(formData));
  if (!leido.success) {
    const general = leido.error.issues[0]?.message ?? "Revisa los datos del formulario";
    return { estado: "error", errores: { general }, valores: tecleadoDe(formData) };
  }
  const valores: ValoresIngreso = leido.data;

  const [reparto, categorias, cuentas] = await Promise.all([
    datosDelReparto(),
    categoriasDeIngresoPorUso(),
    saldosPorCuenta(),
  ]);
  const { porAsignar } = reparto;
  if (!porAsignar?.activo) {
    const general = 'No hay un sobre "Por asignar" activo: el ingreso no tiene dónde caer.';
    return { estado: "error", errores: { general }, valores };
  }
  const categoria = categorias.find((c) => String(c.id) === valores.categoriaId);
  const cuenta = cuentas.find((c) => String(c.id) === valores.cuentaId && c.moneda !== "VES");

  // "Hoy" es el de ahora, al guardar, no el del día en que se abrió la pantalla.
  const hoy = hoyEnCaracas(new Date());
  const fecha = fechaDesdeAtajo(valores.fecha, hoy);
  const entrada: EntradaIngreso = {
    monto: valores.monto,
    fecha,
    nota: valores.nota,
    categoriaId: categoria?.id ?? 0,
    porAsignarId: porAsignar.id,
    sobresValidos: reparto.sobres.map((s) => s.id),
    asignaciones: Object.entries(valores.asignaciones).map(([sobreId, monto]) => ({ sobreId: Number(sobreId), monto })),
  };

  // Sin JavaScript, o si cambió el monto o la fecha, este envío solo propone: llena los campos del reparto.
  const clave = claveDePropuesta(valores.monto, valores.fecha);
  const proponiendo = valores.propuestaDe !== clave;
  const preparado = prepararIngreso(proponiendo ? { ...entrada, asignaciones: [] } : entrada, hoy, cuenta ?? null);

  const errores: ErroresFormularioIngreso = preparado.ok ? {} : { ...preparado.errores };
  if (!categoria) errores.categoria = "Elige una categoría";
  if (!preparado.ok || !categoria) return { estado: "error", errores, valores };

  if (proponiendo) {
    const montoCentavos = preparado.filas[0].montoCentavos;
    const asignaciones = camposDePropuesta(montoCentavos, fecha, reparto.reglas, reparto.recibidoPorMes);
    return { estado: "proponer", valores: { ...valores, asignaciones, propuestaDe: clave } };
  }

  if (preparado.sinAsignar > 0 && confirmarSinAsignar !== String(preparado.sinAsignar)) {
    return { estado: "confirmar", valores, sinAsignarCentavos: preparado.sinAsignar };
  }

  // La etiqueta pedida, al final y sin escribir: una nueva la crea registrarCaptura junto con el ingreso (spec 008).
  const etiqueta = await etiquetaDelFormulario(formData);
  if (!etiqueta.ok) return { estado: "error", errores: { etiqueta: etiqueta.error }, valores };

  // Cada fila con la referencia de esta captura: un reintento choca con el índice único y no duplica nada.
  const referencia = (f: FilaIngreso) =>
    f.tipo === "ingreso"
      ? referenciaDeCaptura(valores.idCaptura, "ingreso")
      : referenciaDeReasignacion(valores.idCaptura, f.sobreDestinoId);
  const filas = preparado.filas.map((f) => ({ ...f, referenciaExterna: referencia(f) }));
  let registro: Awaited<ReturnType<typeof registrarCaptura>>;
  try {
    // La etiqueta va solo en el ingreso, no en su reparto (spec 008, criterio 4); registrarCaptura la pone.
    registro = await registrarCaptura(valores.idCaptura, filas, etiqueta.etiqueta);
  } catch (error) {
    registrarFalla("No se pudo registrar el ingreso", error);
    return { estado: "error", errores: { general: "No se pudo guardar. Intenta de nuevo." }, valores };
  }
  // Ya había algo con este id. Solo es "ya estaba" si es lo mismo y reciente; si no, se avisa y el id cambia.
  if (!registro.nueva && resolverReintento(registro.guardadas, filas, new Date()) === "otra") {
    return {
      estado: "error",
      errores: {
        general: "Este ingreso ya se guardó antes: revísalo en Movimientos y, si es otro, vuelve a guardar.",
      },
      valores: { ...valores, idCaptura: crypto.randomUUID() },
    };
  }

  for (const ruta of ["/", "/movimientos", "/sobres", "/sobres/repartir", "/cuentas", "/nuevo/ingreso"]) {
    revalidatePath(ruta);
  }
  revalidatePath("/sobres/[id]", "page");

  const nombreDe = new Map(reparto.sobres.map((s) => [s.id, s.nombre]));
  const [ingreso, ...reasignaciones] = preparado.filas;
  return {
    estado: "guardado",
    cuentaId: valores.cuentaId,
    siguienteCaptura: crypto.randomUUID(),
    resumen: {
      montoCentavos: ingreso.montoCentavos,
      moneda: ingreso.moneda,
      cuenta: cuenta?.nombre ?? "",
      categoria: categoria.nombre,
      repartido: reasignaciones.map((r) => ({
        nombre: nombreDe.get(r.sobreDestinoId) ?? "",
        centavos: r.montoCentavos,
      })),
      sinAsignarCentavos: preparado.sinAsignar,
    },
  };
}
