/**
 * Criterio ★ 18 de la spec 002, escrito desde su texto: el service worker no guarda datos ni repite acciones. Se
 * carga public/sw.js tal cual, con un `self`, unas cachés y una red simulados, y se le mandan los eventos que manda el
 * navegador: instalar, activar y cada tipo de solicitud. Que /sw.js se sirva sin caché lo comprueba pnpm humo.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";
import configuracion from "../../next.config";

const raiz = process.cwd();
const codigo = fs.readFileSync(path.join(raiz, "public", "sw.js"), "utf8");
const origen = "https://arca.test";

/** Lo que Next sirve en /sin-conexion: su CSS, sus scripts, el del tema en línea y los datos de RSC. */
const htmlSinConexion = `<!DOCTYPE html><html lang="es"><head>
<link rel="stylesheet" href="/_next/static/chunks/0abc.css" data-precedence="next"/>
<link rel="preload" as="script" fetchPriority="low" href="/_next/static/chunks/webpack-1.js"/>
<script src="/_next/static/chunks/main-2.js" async=""></script>
<link rel="icon" href="/icon/32?1a2b" type="image/png" sizes="32x32"/>
<link rel="manifest" href="/manifest.webmanifest"/>
<script>(function(){document.documentElement.dataset.theme="claro"})()</script>
</head><body><h1>Sin conexión</h1><p>Sin red no se puede registrar ni consultar. Tus datos siguen a salvo.</p>
<form method="get"><button type="submit">Reintentar</button></form>
<script>(self.__next_f=self.__next_f||[]).push([0])</script><script>self.__next_f.push([1,"0:{}"])</script>
</body></html>`;
const cssSinConexion = `@font-face{font-family:Roboto Flex;src:url(../media/roboto-flex.woff2) format("woff2")}
@font-face{font-family:Otra;src:url(/_next/static/media/otra.woff) format("woff")}
.fondo{background:url(data:image/png;base64,AAAA)}.ext{background:url(https://cdn.otro.test/x.woff2)}`;

/** Las solicitudes del navegador, como las ve el service worker. */
const solicitud = (ruta: string, { method = "GET", mode = "cors", headers = {} as Record<string, string> } = {}) => ({
  method,
  mode,
  url: `${origen}${ruta}`,
  headers: new Headers(headers),
});

type Solicitud = ReturnType<typeof solicitud>;
type Red = (ruta: string) => Promise<Response>;

/** La ruta relativa al origen, como clave de caché y en el registro de lo pedido. */
const rutaDe = (destino: string | { url: string }) => {
  const url = new URL(typeof destino === "string" ? destino : destino.url, origen);
  return url.origin === origen ? url.pathname + url.search : url.href;
};

/** La red de siempre: /sin-conexion, su CSS y sus fuentes, y cualquier otra ruta con datos. */
const redConServidor: Red = async (ruta) => {
  if (ruta === "/sin-conexion") return new Response(htmlSinConexion, { headers: { "content-type": "text/html" } });
  if (ruta.endsWith(".css")) return new Response(cssSinConexion, { headers: { "content-type": "text/css" } });
  if (ruta.endsWith(".woff2") || ruta.endsWith(".woff")) return new Response("fuente");
  return new Response(`<html>${ruta}: saldo 1.234,56 USD</html>`, { headers: { "content-type": "text/html" } });
};
const sinRed: Red = async () => {
  throw new TypeError("Failed to fetch");
};

function cargarServiceWorker() {
  const escuchas: Record<string, (evento: unknown) => void> = {};
  const almacenes = new Map<string, Map<string, Response>>();
  const pedidos: string[] = [];
  let red = redConServidor;
  const espias = { skipWaiting: vi.fn(), claim: vi.fn(), preload: vi.fn(async () => undefined) };

  const fetchSimulado = vi.fn(async (destino: string | Solicitud) => {
    const ruta = rutaDe(destino);
    pedidos.push(ruta);
    return red(ruta);
  });
  const almacen = (nombre: string) => {
    if (!almacenes.has(nombre)) almacenes.set(nombre, new Map());
    const guardado = almacenes.get(nombre) as Map<string, Response>;
    return {
      async addAll(rutas: string[]) {
        for (const ruta of rutas) guardado.set(rutaDe(ruta), await fetchSimulado(ruta));
      },
      async put(destino: string | Solicitud, respuesta: Response) {
        guardado.set(rutaDe(destino), respuesta);
      },
      async match(destino: string | Solicitud) {
        return guardado.get(rutaDe(destino))?.clone();
      },
    };
  };
  const caches = {
    open: async (nombre: string) => almacen(nombre),
    async match(destino: string | Solicitud) {
      for (const guardado of almacenes.values()) {
        const encontrado = guardado.get(rutaDe(destino));
        if (encontrado) return encontrado.clone();
      }
      return undefined;
    },
    keys: async () => [...almacenes.keys()],
    delete: async (nombre: string) => almacenes.delete(nombre),
  };
  const self = {
    location: { origin: origen },
    addEventListener: (tipo: string, escucha: (evento: unknown) => void) => (escuchas[tipo] = escucha),
    skipWaiting: espias.skipWaiting,
    clients: { claim: espias.claim },
    registration: { navigationPreload: { enable: espias.preload } },
  };
  vm.runInNewContext(codigo, { self, caches, fetch: fetchSimulado, Response, Headers, URL, console });

  /** Un evento con waitUntil: espera a que termine lo que el service worker pidió esperar. */
  async function ciclo(tipo: "install" | "activate") {
    const esperas: Promise<unknown>[] = [];
    escuchas[tipo]({ waitUntil: (p: Promise<unknown>) => esperas.push(p) });
    await Promise.all(esperas);
  }

  /** Una solicitud: la respuesta del service worker, o null si la deja pasar sin tocarla. */
  async function pedir(s: Solicitud, preloadResponse?: Promise<Response | undefined>) {
    let respuesta: Promise<Response> | null = null;
    escuchas.fetch({ request: s, preloadResponse, respondWith: (p: Promise<Response>) => (respuesta = p) });
    return respuesta === null ? null : await (respuesta as Promise<Response>);
  }

  const claves = () => [...almacenes.values()].flatMap((guardado) => [...guardado.keys()]).sort();
  const cambiarRed = (nueva: Red) => (red = nueva);
  return { ciclo, pedir, claves, almacenes, pedidos, espias, cambiarRed };
}

/** Un service worker ya instalado y activo, como queda tras la primera visita. */
async function instalado() {
  const sw = cargarServiceWorker();
  await sw.ciclo("install");
  await sw.ciclo("activate");
  sw.pedidos.length = 0;
  return sw;
}

const loQueNecesitaSinConexion = [
  "/_next/static/chunks/0abc.css",
  "/_next/static/media/otra.woff",
  "/_next/static/media/roboto-flex.woff2",
  "/sin-conexion",
];

describe("★ 18 · se registra /sw.js con alcance /", () => {
  it("el registro pide /sw.js con alcance /, y el layout raíz lo monta en todas las páginas", () => {
    const registro = fs.readFileSync(path.join(raiz, "src", "components", "registro-service-worker.tsx"), "utf8");
    expect(registro).toMatch(/serviceWorker\.register\(\s*"\/sw\.js",\s*\{[^}]*scope:\s*"\/"/);
    const layout = fs.readFileSync(path.join(raiz, "src", "app", "layout.tsx"), "utf8");
    expect(layout).toMatch(/<RegistroServiceWorker\s*\/>/);
  });

  it("no se activa experimental.useOffline de Next, que reintenta las acciones al volver la conexión", () => {
    expect((configuracion.experimental as Record<string, unknown> | undefined)?.useOffline).toBeUndefined();
    expect(fs.readFileSync(path.join(raiz, "next.config.ts"), "utf8")).not.toMatch(/useOffline/);
  });
});

describe("★ 18 · al instalarse guarda solo /sin-conexion y lo que esa página necesita", () => {
  it("guarda la página, su CSS y sus fuentes, y nada más: ni scripts, ni iconos, ni otras rutas", async () => {
    const sw = cargarServiceWorker();
    await sw.ciclo("install");
    expect(sw.claves()).toEqual(loQueNecesitaSinConexion);
    expect(sw.pedidos.filter((ruta) => !loQueNecesitaSinConexion.includes(ruta))).toEqual([]);
  });

  it("la página guardada no trae los scripts de Next, que no están en la caché, y conserva el texto y el del tema", async () => {
    const sw = cargarServiceWorker();
    await sw.ciclo("install");
    const [guardado] = [...sw.almacenes.values()];
    const pagina = await guardado.get("/sin-conexion")?.clone().text();
    expect(pagina).toContain("Sin conexión");
    expect(pagina).toContain("Reintentar");
    expect(pagina).toContain("document.documentElement.dataset.theme");
    expect(pagina).toContain('href="/_next/static/chunks/0abc.css"');
    expect(pagina).not.toMatch(/<script[^>]*\bsrc=|__next_f|as="script"/);
  });
});

describe("★ 18 · cada navegación va primero a la red y, sin red, responde /sin-conexion", () => {
  it("con red, responde lo que trae la red y no guarda nada", async () => {
    const sw = await instalado();
    const respuesta = await sw.pedir(solicitud("/movimientos", { mode: "navigate" }));
    expect(await respuesta?.text()).toContain("/movimientos: saldo");
    expect(sw.pedidos).toEqual(["/movimientos"]);
    expect(sw.claves()).toEqual(loQueNecesitaSinConexion);
  });

  it("con la navegación ya pedida por adelantado, la usa y no pide otra vez", async () => {
    const sw = await instalado();
    const adelantada = Promise.resolve(new Response("<html>/sobres: de la red</html>"));
    const respuesta = await sw.pedir(solicitud("/sobres", { mode: "navigate" }), adelantada);
    expect(await respuesta?.text()).toBe("<html>/sobres: de la red</html>");
    expect(sw.pedidos).toEqual([]);
    expect(sw.claves()).toEqual(loQueNecesitaSinConexion);
  });

  it("sin red, cualquier navegación muestra /sin-conexion, sin saldos y sin los scripts de Next", async () => {
    const sw = await instalado();
    sw.cambiarRed(sinRed);
    for (const ruta of ["/", "/movimientos", "/nuevo/gasto", "/sobres/3?x=1"]) {
      const pagina = await (await sw.pedir(solicitud(ruta, { mode: "navigate" })))?.text();
      expect(pagina, ruta).toContain("Sin conexión");
      expect(pagina, ruta).toContain("Tus datos siguen a salvo.");
      expect(pagina, ruta).toContain("document.documentElement.dataset.theme");
      expect(pagina, ruta).not.toMatch(/saldo|<script[^>]*\bsrc=|__next_f|as="script"/);
    }
    expect(sw.claves()).toEqual(loQueNecesitaSinConexion);
  });

  it("sin red y con la navegación adelantada fallida, también /sin-conexion", async () => {
    const sw = await instalado();
    sw.cambiarRed(sinRed);
    const pagina = await (await sw.pedir(solicitud("/cuentas", { mode: "navigate" }), sinRed("/cuentas")))?.text();
    expect(pagina).toContain("Sin conexión");
  });
});

describe("★ 18 · nunca guarda otra ruta ni RSC, y no intercepta nada que no sea GET", () => {
  it("las server actions pasan directo: ni con JavaScript ni sin él (un formulario es una navegación POST)", async () => {
    const sw = await instalado();
    const conJs = solicitud("/nuevo/gasto", { method: "POST", headers: { "next-action": "abc" } });
    const sinJs = solicitud("/nuevo/gasto", { method: "POST", mode: "navigate" });
    expect(await sw.pedir(conJs)).toBeNull();
    expect(await sw.pedir(sinJs)).toBeNull();
    for (const method of ["PUT", "PATCH", "DELETE"])
      expect(await sw.pedir(solicitud("/sobres/3", { method }))).toBeNull();
    expect(sw.pedidos).toEqual([]);
  });

  it("sin red, una acción tampoco se encola ni se responde con la página guardada: falla en la red", async () => {
    const sw = await instalado();
    sw.cambiarRed(sinRed);
    expect(await sw.pedir(solicitud("/nuevo/gasto", { method: "POST", headers: { "next-action": "abc" } }))).toBeNull();
    expect(sw.pedidos).toEqual([]);
  });

  it("las respuestas RSC del enrutador pasan sin tocarse y no se guardan", async () => {
    const sw = await instalado();
    expect(await sw.pedir(solicitud("/movimientos?_rsc=1x2y", { headers: { rsc: "1" } }))).toBeNull();
    expect(await sw.pedir(solicitud("/sobres", { headers: { rsc: "1", "next-router-prefetch": "1" } }))).toBeNull();
    expect(sw.claves()).toEqual(loQueNecesitaSinConexion);
  });

  it("de /_next/static/ solo responde lo guardado; lo demás va a la red y no se guarda", async () => {
    const sw = await instalado();
    const css = await sw.pedir(solicitud("/_next/static/chunks/0abc.css"));
    expect(await css?.text()).toBe(cssSinConexion);
    expect(sw.pedidos).toEqual([]);
    await sw.pedir(solicitud("/_next/static/chunks/pagina-3.js"));
    expect(sw.pedidos).toEqual(["/_next/static/chunks/pagina-3.js"]);
    expect(await sw.pedir(solicitud("/icon/192"))).toBeNull();
    expect(sw.claves()).toEqual(loQueNecesitaSinConexion);
  });
});

describe("★ 18 · una versión nueva toma el control en la siguiente apertura", () => {
  it("no se salta la espera ni reclama las pestañas abiertas", async () => {
    const sw = cargarServiceWorker();
    await sw.ciclo("install");
    await sw.ciclo("activate");
    expect(sw.espias.skipWaiting).not.toHaveBeenCalled();
    expect(sw.espias.claim).not.toHaveBeenCalled();
    expect(codigo).not.toMatch(/skipWaiting\(|clients\.claim\(/);
  });

  it("al activarse borra las cachés de versiones anteriores y deja solo la suya", async () => {
    const sw = cargarServiceWorker();
    sw.almacenes.set("finanzas-sin-conexion-v1", new Map([["/movimientos", new Response("viejo")]]));
    await sw.ciclo("install");
    await sw.ciclo("activate");
    expect(sw.almacenes.size).toBe(1);
    expect(sw.claves()).toEqual(loQueNecesitaSinConexion);
  });
});
