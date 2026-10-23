/**
 * Las páginas de la comprobación de la spec 003, que corre scripts/comprobar-003.ts con --url después de insertar sus
 * datos. Entra a un servidor en marcha como el usuario de prueba (HUMO_CORREO y HUMO_CLAVE, igual que scripts/humo.mjs)
 * y mira /movimientos como un navegador sin JavaScript:
 *   ★ 1 y 2 · el centro del anillo, la suma de cada categoría, porcentajes que suman 100 y "<1 %";
 *   ★ 3     · cada pestaña muestra solo las filas de su tipo, y Mover va sin anillo;
 *   ★ 4     · la fila del gasto en bolívares con los Bs y la tasa;
 *   ★ 6     · cada parámetro manipulado responde 200 y cae en Gastos del mes actual sin filtro;
 *   ★ 7     · "200 de 250" con 200 filas, y ningún "de 200" con 200 justos.
 * No escribe en la base. Al terminar, sale.
 */
import { formatearCentavos, partesCentavos } from "../src/lib/dinero";

export type DatosDePaginas = {
  hoy: string;
  /** Las notas de lo insertado en marzo de 2025, por la pestaña en la que deben salir. */
  notas: { gastos: string[]; ingresos: string[]; mover: string[] };
  /** Cada categoría de gasto de marzo de 2025 con su suma. */
  categoriasMarzo: { nombre: string; centavos: number }[];
  totalIngresosMarzo: number;
  totalJunio: number;
  comidaId: number;
  sueldoId: number;
};
type Comprobar = (criterio: string, descripcion: string, ok: boolean, detalle?: string) => void;

const suma = (numeros: number[]) => numeros.reduce((a, n) => a + n, 0);

/** El texto visible de un trozo de HTML: sin etiquetas, sin los comentarios que React pone entre textos. */
export const texto = (html: string) =>
  html
    .replace(/<!-- -->/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&");

/** Los campos de un formulario, como los enviaría un navegador sin JavaScript. */
function camposDe(formulario: string) {
  const datos = new FormData();
  for (const [entrada] of formulario.matchAll(/<input[^>]*>/g)) {
    const nombre = /name="([^"]*)"/.exec(entrada)?.[1];
    if (nombre) datos.append(nombre, texto(/value="([^"]*)"/.exec(entrada)?.[1] ?? ""));
  }
  return datos;
}

/** Entra con el usuario de prueba y devuelve cómo pedir páginas con esa sesión, ya sin los scripts de React. */
export async function abrirSesion(origen: string) {
  const frasco = new Map<string, string>();
  async function pedir(ruta: string, opciones: RequestInit = {}) {
    const cookie = [...frasco].map(([n, v]) => `${n}=${v}`).join("; ");
    const r = await fetch(`${origen}${ruta}`, { redirect: "manual", ...opciones, headers: cookie ? { cookie } : {} });
    for (const linea of r.headers.getSetCookie()) {
      const [par] = linea.split(";");
      const nombre = par.slice(0, par.indexOf("="));
      const valor = par.slice(par.indexOf("=") + 1);
      if (!valor || /max-age=0\b/i.test(linea)) frasco.delete(nombre);
      else frasco.set(nombre, valor);
    }
    return r;
  }
  const formularios = (html: string) => [...html.matchAll(/<form[\s\S]*?<\/form>/g)].map((m) => m[0]);
  const { HUMO_CORREO: correo, HUMO_CLAVE: clave } = process.env;
  if (!correo || !clave) throw new Error("Con --url hacen falta HUMO_CORREO y HUMO_CLAVE del usuario de prueba.");
  const datos = camposDe(formularios(await (await pedir("/entrar")).text())[0] ?? "");
  datos.set("correo", correo);
  datos.set("clave", clave);
  const entrada = await pedir("/entrar", { method: "POST", body: datos });
  await entrada.arrayBuffer();
  if (entrada.status !== 303) throw new Error(`No se pudo entrar con el usuario de prueba (${entrada.status}).`);
  return {
    async pagina(ruta: string) {
      const r = await pedir(ruta);
      // Sin los scripts: llevan el mismo contenido para React y contarían cada fila dos veces.
      const html = (await r.text()).replace(/<script[\s\S]*?<\/script>/g, "");
      return { estado: r.status, html };
    },
    /** La respuesta entera, con los scripts: lo que Next manda por el stream de React también está ahí. */
    async crudo(ruta: string) {
      const r = await pedir(ruta);
      return { estado: r.status, html: await r.text() };
    },
    /** Envía un formulario como un navegador sin JavaScript: el estado, la página que vuelve y a dónde redirige. */
    async enviar(ruta: string, datos: FormData) {
      const r = await pedir(ruta, { method: "POST", body: datos });
      const html = (await r.text()).replace(/<script[\s\S]*?<\/script>/g, "");
      return { estado: r.status, html, ubicacion: r.headers.get("location") };
    },
    async salir() {
      const salida = formularios(await (await pedir("/")).text()).find(
        (f) => f.includes("$ACTION_ID_") && f.includes("Salir"),
      );
      await (await pedir("/", { method: "POST", body: camposDe(salida ?? "") })).arrayBuffer();
    },
  };
}

/** Lo que dice qué se está mirando: pestaña y periodo marcados, el nombre del periodo y el encabezado de la lista. */
function firma(html: string) {
  const marcadas = [...html.matchAll(/<span aria-current="page"[^>]*>([^<]*)<\/span>/g)].map((m) => m[1]);
  // El botón del calendario: su texto visible, sin la parte que solo oye el lector de pantalla.
  const periodo = /aria-haspopup="dialog"[\s\S]*?<\/svg>([\s\S]*?)<span class="sr-only">/.exec(html)?.[1];
  const encabezado = /<h2 class="flex items-baseline[^"]*">([\s\S]*?)<\/h2>/.exec(html)?.[1];
  return `${marcadas.join(" · ")} | ${texto(periodo ?? "?")} | ${texto(encabezado ?? "?")}`;
}

/** Cuántas veces sale una nota: en el título de un gasto o un ingreso, o en el detalle de Mover. */
const vecesQueSale = (html: string, nota: string) => texto(html).split(nota).length - 1;
const centro = (html: string) => /<text[^>]*>([^<]*)<\/text>/.exec(html)?.[1];
const cifra = (centavos: number) => `${partesCentavos(centavos).entero},${partesCentavos(centavos).decimales}`;

export async function comprobarPaginas(origen: string, d: DatosDePaginas, comprobar: Comprobar) {
  console.log(`— páginas, contra ${origen}`);
  const sesion = await abrirSesion(origen);
  try {
    // ★ 1, 2, 3 y 4 · marzo de 2025
    const totalGastos = suma(d.categoriasMarzo.map((c) => c.centavos));
    const gastos = await sesion.pagina("/movimientos?fecha=2025-03-31");
    comprobar(
      "1",
      `/movimientos de marzo de 2025: el centro dice ${cifra(totalGastos)} y cada categoría su suma`,
      gastos.estado === 200 &&
        centro(gastos.html) === cifra(totalGastos) &&
        d.categoriasMarzo.every(({ nombre, centavos }) =>
          gastos.html.includes(
            `${nombre}</span><span class="tabular block text-texto-3">${formatearCentavos(centavos)} · `,
          ),
        ),
      `${gastos.estado}, centro ${centro(gastos.html)}`,
    );
    const leyenda = [...texto(gastos.html).matchAll(/USD · (<1|\d+) %/g)].map((m) => m[1]);
    comprobar(
      "2",
      'la leyenda tiene porcentajes enteros que suman 100, y Salud, con 0,01, dice "<1 %"',
      leyenda.length === d.categoriasMarzo.length &&
        suma(leyenda.map((p) => (p === "<1" ? 0 : Number(p)))) === 100 &&
        texto(gastos.html).includes("0,01 USD · <1 %"),
      leyenda.join(", "),
    );
    const ingresos = await sesion.pagina("/movimientos?tipo=ingresos&fecha=2025-03-31");
    const mover = await sesion.pagina("/movimientos?tipo=mover&fecha=2025-03-31");
    /** Las notas que no salen como deben en una pestaña: una vez las suyas, ninguna vez las de las otras. */
    const fueraDeLugar = (pestana: string, html: string, propias: string[]) =>
      [...d.notas.gastos, ...d.notas.ingresos, ...d.notas.mover]
        .filter((nota) => vecesQueSale(html, nota) !== (propias.includes(nota) ? 1 : 0))
        .map((nota) => `${pestana}: "${nota}" sale ${vecesQueSale(html, nota)} veces`);
    const malas = [
      ...fueraDeLugar("Gastos", gastos.html, d.notas.gastos),
      ...fueraDeLugar("Ingresos", ingresos.html, d.notas.ingresos),
      ...fueraDeLugar("Mover", mover.html, d.notas.mover),
    ];
    // El anillo se reconoce por su etiqueta: el emblema de la app también es role="img".
    const anillo = /role="img" aria-label="[^"]* por categoría/;
    comprobar(
      "3",
      "en la página, cada pestaña muestra solo las filas de su tipo, y Mover va sin anillo",
      malas.length === 0 &&
        centro(ingresos.html) === cifra(d.totalIngresosMarzo) &&
        anillo.test(gastos.html) &&
        anillo.test(ingresos.html) &&
        !anillo.test(mover.html),
      malas.length ? malas.join("; ") : `centro de ingresos ${centro(ingresos.html)}`,
    );
    comprobar(
      "4",
      "la fila del gasto en bolívares dice 1.182,50 Bs · 236,50 Bs/USD",
      texto(gastos.html).includes("1.182,50 Bs · 236,50 Bs/USD"),
    );

    // ★ 7 · lista larga
    const junio = await sesion.pagina("/movimientos?fecha=2025-06-30");
    const filasJunio = junio.html.split(">c003 lista ").length - 1;
    comprobar(
      "7",
      'junio de 2025: la página dice "200 de 250", muestra 200 filas y el centro cuenta los 250',
      texto(junio.html).includes("200 de 250") && filasJunio === 200 && centro(junio.html) === cifra(d.totalJunio),
      `${filasJunio} filas, centro ${centro(junio.html)}`,
    );
    const julio = await sesion.pagina("/movimientos?fecha=2025-07-31");
    comprobar(
      "7",
      'julio de 2025, con 200 justos: 200 filas y ningún "de 200"',
      julio.html.split(">c003 justa ").length - 1 === 200 && !texto(julio.html).includes(" de 200"),
    );

    // ★ 6 · parámetros manipulados: la página no falla y cae en Gastos del mes actual sin filtro
    const normal = await sesion.pagina("/movimientos");
    const esperada = firma(normal.html);
    const manana = new Date(Date.parse(`${d.hoy}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    const manipuladas = [
      "?tipo=hack",
      "?tipo=",
      "?tipo=gastos&tipo=ingresos",
      "?tipo=%3Cscript%3Ealert(1)%3C%2Fscript%3E",
      "?periodo=siglo",
      "?periodo=",
      "?periodo=dia&periodo=mes",
      "?fecha=2026-02-30",
      "?fecha=2026-13-01",
      `?fecha=${manana}`,
      "?fecha=9999-12-31",
      "?fecha=hoy",
      "?fecha=2026-10-01%27%20or%20%271%27%3D%271",
      "?categoria=-1",
      "?categoria=0",
      "?categoria=1.5",
      "?categoria=abc",
      "?categoria=99999999999",
      "?categoria=2147483647",
      `?categoria=${d.sueldoId}`,
      "?tipo=x&periodo=y&fecha=2026-02-30&categoria=-1",
    ];
    const fallidas: string[] = [];
    for (const consulta of manipuladas) {
      const p = await sesion.pagina(`/movimientos${consulta}`);
      if (p.estado !== 200 || firma(p.html) !== esperada) fallidas.push(`${consulta} → ${p.estado} ${firma(p.html)}`);
    }
    comprobar(
      "6",
      `${manipuladas.length} direcciones manipuladas responden 200 y muestran lo mismo que /movimientos`,
      // Sin periodo leído, la firma diría "?" en las dos páginas y compararía nada: eso también es una falla.
      normal.estado === 200 &&
        esperada.startsWith("Gastos · Mes | ") &&
        !esperada.includes("| ? |") &&
        fallidas.length === 0,
      fallidas.length ? fallidas.join("; ") : esperada,
    );
    const conComida = firma((await sesion.pagina(`/movimientos?categoria=${d.comidaId}`)).html);
    const ingresosConComida = firma((await sesion.pagina(`/movimientos?tipo=ingresos&categoria=${d.comidaId}`)).html);
    const ingresosSolos = firma((await sesion.pagina("/movimientos?tipo=ingresos")).html);
    comprobar(
      "6",
      "una categoría del tipo de la pestaña filtra; una de gasto en Ingresos no filtra",
      conComida.includes("| Comida · ") && ingresosConComida === ingresosSolos && ingresosSolos.includes("| Todas · "),
      `${conComida}; ${ingresosConComida}`,
    );
    // ★ 6: válida es "un id de categoría entero positivo del tipo de la pestaña", tenga o no movimientos en el periodo.
    // Comida en enero de 2020, sin movimientos: el filtro se queda, lo dice y viaja en las flechas y las píldoras.
    const vacio = await sesion.pagina(`/movimientos?fecha=2020-01-15&categoria=${d.comidaId}`);
    const sinAmp = (h: string) => h.replace(/&amp;/g, "&");
    const hrefDe = (etiqueta: string) =>
      sinAmp(
        /href="([^"]*)"/.exec(new RegExp(`<a[^>]*aria-label="${etiqueta}"[^>]*>`).exec(vacio.html)?.[0] ?? "")?.[1] ??
          "",
      );
    const flechas = [hrefDe("Periodo anterior"), hrefDe("Periodo siguiente")];
    const pildoras = [...vacio.html.matchAll(/href="(\/movimientos[^"]*periodo=(?:dia|semana|anio)[^"]*)"/g)].map((m) =>
      sinAmp(m[1]),
    );
    const conFiltro = (h: string) => h.includes(`categoria=${d.comidaId}`);
    comprobar(
      "6",
      "una categoría del tipo de la pestaña sin movimientos en el periodo sigue filtrando, lo dice y viaja en los enlaces",
      vacio.estado === 200 &&
        texto(vacio.html).includes("No hay gastos de Comida en enero de 2020.") &&
        flechas.every(conFiltro) &&
        pildoras.length === 3 &&
        pildoras.every(conFiltro),
      [...flechas, ...pildoras].join(" "),
    );
  } finally {
    await sesion.salir();
  }
}
