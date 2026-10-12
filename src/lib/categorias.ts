/**
 * Categorías con icono y color (spec 001, ampliación). Aquí viven el catálogo y las reglas, sin React:
 * qué iconos y colores existen, cómo se valida una categoría y si al eliminarla se borra o se archiva.
 * El icono que pinta cada nombre está en src/components/iconos-categoria.tsx; el color de cada nombre,
 * en los tokens --cat-* de src/app/globals.css. En la base se guardan los nombres, nunca un hexadecimal.
 */

export type TipoCategoria = "gasto" | "ingreso";

export type IconoCategoria = { nombre: string; grupo: string; palabras: string[] };

const icono = (nombre: string, grupo: string, palabras: string) => ({
  nombre,
  grupo,
  palabras: palabras.split(",").map((p) => p.trim()),
});

/** Iconos de línea, nunca emojis. Las palabras, en español, son las que encuentra el buscador. */
export const iconosCategoria: IconoCategoria[] = [
  icono("cubiertos", "Comida", "comida, restaurante, almuerzo, cena"),
  icono("cafe", "Comida", "café, cafetería, desayuno, taza"),
  icono("pizza", "Comida", "pizza, comida rápida"),
  icono("sandwich", "Comida", "sándwich, hamburguesa, comida rápida, merienda"),
  icono("cesta", "Comida", "mercado, alimentación, víveres"),
  icono("carrito", "Comida", "supermercado, compras, abasto"),
  icono("manzana", "Comida", "fruta, frutería, saludable"),
  icono("zanahoria", "Comida", "verduras, hortalizas"),
  icono("pan", "Comida", "panadería, pan, cachitos"),
  icono("torta", "Comida", "postre, dulce, pastelería"),
  icono("helado", "Comida", "helado, postre"),
  icono("cerveza", "Comida", "cerveza, salidas, bar"),
  icono("vino", "Comida", "vino, licor"),
  icono("coctel", "Comida", "tragos, cóctel, bar"),
  icono("refresco", "Comida", "refresco, bebida, jugo"),
  icono("sopa", "Comida", "sopa, almuerzo"),
  icono("pescado", "Comida", "pescado, mariscos"),
  icono("carne", "Comida", "carne, carnicería, parrilla"),
  icono("galleta", "Comida", "galletas, chucherías, snacks"),

  icono("auto", "Transporte", "carro, auto, coche, vehículo"),
  icono("bus", "Transporte", "bus, camioneta, transporte público, pasaje"),
  icono("taxi", "Transporte", "taxi, ridery, yummy, uber"),
  icono("bicicleta", "Transporte", "bicicleta, bici"),
  icono("gasolina", "Transporte", "gasolina, combustible, gasoil"),
  icono("tren", "Transporte", "tren, metro"),
  icono("estacionamiento", "Transporte", "estacionamiento, parqueo"),
  icono("taller", "Transporte", "taller, mecánico, reparación, mantenimiento"),

  icono("casa", "Hogar", "casa, hogar, vivienda"),
  icono("llave", "Hogar", "alquiler, llaves, condominio"),
  icono("sofa", "Hogar", "muebles, sala, sofá"),
  icono("silla", "Hogar", "mobiliario, muebles, silla"),
  icono("cama", "Hogar", "cama, colchón, dormitorio"),
  icono("bombillo", "Hogar", "luz, electricidad, servicios, bombillo"),
  icono("agua", "Hogar", "agua, servicios"),
  icono("gas", "Hogar", "gas, bombona"),
  icono("internet", "Hogar", "internet, wifi"),
  icono("tv", "Hogar", "televisión, cable, streaming"),
  icono("lavadora", "Hogar", "lavadora, lavandería, ropa limpia"),
  icono("martillo", "Hogar", "reparación, ferretería, herramientas"),
  icono("pintura", "Hogar", "pintura, remodelación"),
  icono("limpieza", "Hogar", "limpieza, productos de limpieza"),
  icono("planta", "Hogar", "plantas, jardín"),
  icono("nevera", "Hogar", "nevera, electrodomésticos"),

  icono("salud", "Salud", "salud, médico, corazón"),
  icono("pastilla", "Salud", "medicinas, farmacia, pastillas"),
  icono("estetoscopio", "Salud", "consulta, doctor, médico"),
  icono("hospital", "Salud", "hospital, clínica, emergencia"),
  icono("vacuna", "Salud", "vacuna, inyección, exámenes, laboratorio"),
  icono("mente", "Salud", "psicólogo, terapia, mente"),
  icono("ojo", "Salud", "óptica, oftalmólogo, vista"),
  icono("sonrisa", "Salud", "dentista, odontólogo"),
  icono("pesas", "Salud", "gimnasio, rutina, ejercicio, pesas"),

  icono("camisa", "Personal", "ropa, vestimenta, camisa"),
  icono("zapatos", "Personal", "zapatos, calzado"),
  icono("tijera", "Personal", "peluquería, barbería, corte de pelo"),
  icono("belleza", "Personal", "belleza, cuidado personal, cosméticos"),
  icono("reloj", "Personal", "reloj, accesorios"),
  icono("gafas", "Personal", "lentes, gafas"),
  icono("joya", "Personal", "joyas, prendas, anillo"),
  icono("bolsa", "Personal", "compras, tienda, bolsa"),
  icono("mochila", "Personal", "mochila, bolso"),

  icono("mando", "Ocio", "videojuegos, juegos, consola"),
  icono("cine", "Ocio", "cine, películas"),
  icono("musica", "Ocio", "música, conciertos"),
  icono("audifonos", "Ocio", "audífonos, spotify, podcast"),
  icono("entrada", "Ocio", "entradas, eventos, boletos"),
  icono("dados", "Ocio", "juego, azar, apuestas, dados"),
  icono("fiesta", "Ocio", "fiesta, celebración, salidas"),
  icono("carpa", "Ocio", "camping, acampar"),
  icono("montana", "Ocio", "excursión, montaña, paseo"),
  icono("playa", "Ocio", "playa, vacaciones"),
  icono("camara", "Ocio", "fotos, fotografía"),
  icono("libro", "Ocio", "libros, lectura"),
  icono("arte", "Ocio", "arte, pintura, manualidades"),
  icono("trofeo", "Ocio", "deporte, competencia, trofeo"),
  icono("teatro", "Ocio", "teatro, espectáculo"),

  icono("familia", "Familia", "familia, padres, hermanos"),
  icono("corazon", "Familia", "pareja, amor, novia, novio"),
  icono("regalo", "Familia", "regalos, obsequios"),
  icono("pastel", "Familia", "cumpleaños, torta, celebración"),
  icono("huella", "Familia", "mascotas, veterinario, huella"),
  icono("perro", "Familia", "perro, mascota"),
  icono("gato", "Familia", "gato, mascota"),
  icono("bebe", "Familia", "bebé, pañales, niños"),
  icono("donacion", "Familia", "donación, ayuda, aporte"),
  icono("iglesia", "Familia", "iglesia, diezmo, ofrenda"),
  icono("flor", "Familia", "flores, detalles"),

  icono("celular", "Tecnología", "teléfono, celular, saldo, recarga"),
  icono("portatil", "Tecnología", "computadora, laptop, portátil"),
  icono("monitor", "Tecnología", "monitor, pantalla, computadora"),
  icono("nube", "Tecnología", "nube, almacenamiento, hosting"),
  icono("suscripcion", "Tecnología", "suscripción, membresía, mensualidad"),
  icono("dispositivos", "Tecnología", "dispositivos, electrónica, tablet"),

  icono("billetera", "Dinero", "billetera, gastos, cartera"),
  icono("billete", "Dinero", "efectivo, billetes"),
  icono("monedas", "Dinero", "monedas, ingresos, otros ingresos"),
  icono("alcancia", "Dinero", "ahorro, alcancía"),
  icono("banco", "Dinero", "banco, comisión bancaria"),
  icono("tarjeta", "Dinero", "tarjeta, crédito, deuda"),
  icono("recibo", "Dinero", "factura, recibo, cuentas"),
  icono("calculadora", "Dinero", "deuda, impuestos, cálculo"),
  icono("inversion", "Dinero", "inversión, rendimiento, acciones"),
  icono("maletin", "Dinero", "trabajo, sueldo, empleo, remoto"),
  icono("sueldo", "Dinero", "sueldo, salario, pago, dólar"),
  icono("cambio", "Dinero", "cambio, divisas, conversión"),
  icono("aporte", "Dinero", "aporte, préstamo, ayuda, apoyo"),
  icono("porcentaje", "Dinero", "intereses, comisión, porcentaje"),
  icono("documento", "Dinero", "trámites, impuestos, documentos"),
  icono("oficina", "Dinero", "oficina, empresa, proyecto, cliente"),

  icono("birrete", "Educación", "educación, universidad, estudios"),
  icono("escuela", "Educación", "colegio, escuela"),
  icono("lapiz", "Educación", "útiles, papelería, lápiz"),
  icono("idiomas", "Educación", "idiomas, inglés, curso"),
  icono("clase", "Educación", "curso, taller, clase"),

  icono("avion", "Viajes", "avión, vuelo, pasaje aéreo, viaje"),
  icono("maleta", "Viajes", "viaje, equipaje, maleta"),
  icono("hotel", "Viajes", "hotel, hospedaje, posada"),
  icono("mapa", "Viajes", "mapa, turismo"),
  icono("mundo", "Viajes", "internacional, mundo, extranjero"),

  icono("etiqueta", "Otros", "general, varios, etiqueta"),
  icono("otros", "Otros", "otros, varios, misceláneos"),
  icono("estrella", "Otros", "favoritos, especial"),
  icono("paquete", "Otros", "paquete, encomienda, envío"),
  icono("camion", "Otros", "mudanza, envío, delivery"),
  icono("energia", "Otros", "energía, electricidad, planta eléctrica"),
  icono("telefono", "Otros", "llamadas, teléfono fijo"),
  icono("seguro", "Otros", "seguro, póliza, protección"),
  icono("paraguas", "Otros", "imprevistos, seguro, emergencia"),
];

/** Los colores de la paleta, en el orden en que se ofrecen. Su tono vive en los tokens --cat-*. */
export const coloresCategoria = [
  "coral",
  "naranja",
  "ambar",
  "oliva",
  "verde",
  "pino",
  "turquesa",
  "azul",
  "indigo",
  "lavanda",
  "rosa",
  "pizarra",
] as const;

export type ColorCategoria = (typeof coloresCategoria)[number];

/** Los valores que pone la base cuando no se elige nada. */
export const iconoPorDefecto = "etiqueta";
export const colorPorDefecto: ColorCategoria = "pizarra";

type CategoriaBase = { nombre: string; tipo: TipoCategoria; icono: string; color: ColorCategoria };

/** Las categorías con que arranca la app (pnpm db:seed), en su orden. Las propias llegan con el importador. */
export const categoriasBase: CategoriaBase[] = [
  { nombre: "Comida", tipo: "gasto", icono: "cubiertos", color: "coral" },
  { nombre: "Transporte", tipo: "gasto", icono: "bus", color: "azul" },
  { nombre: "Servicios", tipo: "gasto", icono: "bombillo", color: "ambar" },
  { nombre: "Salud", tipo: "gasto", icono: "salud", color: "rosa" },
  { nombre: "Ocio", tipo: "gasto", icono: "mando", color: "lavanda" },
  { nombre: "Ropa", tipo: "gasto", icono: "camisa", color: "indigo" },
  { nombre: "Tecnología", tipo: "gasto", icono: "celular", color: "turquesa" },
  { nombre: "Hogar", tipo: "gasto", icono: "casa", color: "naranja" },
  { nombre: "Educación", tipo: "gasto", icono: "birrete", color: "azul" },
  { nombre: "Familia", tipo: "gasto", icono: "familia", color: "verde" },
  { nombre: "Regalos", tipo: "gasto", icono: "regalo", color: "rosa" },
  { nombre: "Otros gastos", tipo: "gasto", icono: "otros", color: "pizarra" },
  { nombre: "Sueldo remoto", tipo: "ingreso", icono: "maletin", color: "pino" },
  { nombre: "Proyecto local", tipo: "ingreso", icono: "oficina", color: "oliva" },
  { nombre: "Otros ingresos", tipo: "ingreso", icono: "monedas", color: "verde" },
];

const LARGO_MAXIMO = 40;

/** Minúsculas, sin acentos y sin espacios de más: "  Educación " y "educacion" son la misma clave. */
function clave(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
}

export type EntradaCategoria = {
  nombre: string;
  tipo: TipoCategoria;
  icono: string;
  color: string;
  /** Al editar: la categoría tal como está guardada y cuántos movimientos tiene. */
  edicion?: { id: number; tipo: TipoCategoria; movimientos: number };
};

type Existente = { id: number; nombre: string; tipo: TipoCategoria; activa: boolean };

export type ErroresCategoria = Partial<Record<"nombre" | "tipo" | "icono" | "color", string>>;

export type CategoriaValidada =
  | { ok: true; valores: { nombre: string; tipo: TipoCategoria; icono: string; color: string } }
  /** `archivada`: el id de una archivada con el mismo nombre, para ofrecer restaurarla. */
  | { ok: false; errores: ErroresCategoria; archivada?: number };

/** Criterios 19 y 20: nombre limpio y único en su tipo, icono y color del catálogo, tipo fijo si hay movimientos. */
export function validarCategoria(entrada: EntradaCategoria, existentes: Existente[]): CategoriaValidada {
  const errores: ErroresCategoria = {};
  let archivada: number | undefined;
  const nombre = entrada.nombre.trim().replace(/\s+/g, " ");
  const tipoValido = entrada.tipo === "gasto" || entrada.tipo === "ingreso";

  if (nombre === "") errores.nombre = "Escribe un nombre";
  else if (nombre.length > LARGO_MAXIMO) errores.nombre = `Máximo ${LARGO_MAXIMO} caracteres`;
  else if (tipoValido) {
    const repetida = existentes.find(
      (c) => c.tipo === entrada.tipo && c.id !== entrada.edicion?.id && clave(c.nombre) === clave(nombre),
    );
    if (repetida?.activa) errores.nombre = "Ya existe una categoría con ese nombre";
    else if (repetida) {
      errores.nombre = "Hay una archivada con ese nombre: puedes restaurarla";
      archivada = repetida.id;
    }
  }

  if (!tipoValido) errores.tipo = "Elige gasto o ingreso";
  else if (entrada.edicion && entrada.edicion.tipo !== entrada.tipo && entrada.edicion.movimientos > 0) {
    errores.tipo = "Tiene movimientos: no puede cambiar de tipo";
  }
  if (!iconosCategoria.some((i) => i.nombre === entrada.icono)) errores.icono = "Elige un icono";
  if (!coloresCategoria.some((c) => c === entrada.color)) errores.color = "Elige un color";

  if (Object.keys(errores).length > 0) return archivada ? { ok: false, errores, archivada } : { ok: false, errores };
  return { ok: true, valores: { nombre, tipo: entrada.tipo, icono: entrada.icono, color: entrada.color } };
}

/** Criterio 21: con movimientos se archiva para que el historial conserve su categoría; sin ellos, se borra. */
export function destinoAlEliminar(movimientos: number): "borrar" | "archivar" {
  return movimientos > 0 ? "archivar" : "borrar";
}

/** Criterio 23: iconos cuyo nombre o palabras contienen el texto, sin distinguir acentos ni mayúsculas. */
export function buscarIconos(texto: string): IconoCategoria[] {
  const buscado = clave(texto);
  if (buscado === "") return iconosCategoria;
  return iconosCategoria.filter(
    (i) => i.nombre.includes(buscado) || i.palabras.some((p) => clave(p).includes(buscado)),
  );
}
