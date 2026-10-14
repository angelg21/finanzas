/**
 * Service worker de Finanzas (spec 002, criterio 18; ADR 0009). No guarda datos ni repite acciones:
 * - al instalarse guarda solo /sin-conexion y lo que esa página necesita para verse: su CSS y sus fuentes;
 * - cada navegación va primero a la red y, sin red, responde /sin-conexion;
 * - nunca guarda el HTML de otra ruta ni respuestas RSC, y no intercepta nada que no sea GET: las server actions
 *   pasan directo, y un gasto que falla no se encola ni se reintenta;
 * - una versión nueva espera a que se cierre la app y toma el control en la siguiente apertura: sin skipWaiting.
 * Es la base del push de la fase 2; todavía no recibe notificaciones.
 */
const VERSION = "2";
const CACHE = `finanzas-sin-conexion-v${VERSION}`;
const PAGINA = "/sin-conexion";

/** Las rutas de /_next/static/ que nombra un HTML o un CSS, resueltas contra `base`. */
function recursosDe(texto, base) {
  const urls = [
    ...texto.matchAll(/(?:href|src)="([^"]+)"/g),
    ...texto.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g),
  ].map((m) => new URL(m[1].replace(/&amp;/g, "&"), base));
  return urls
    .filter((u) => u.origin === self.location.origin && u.pathname.startsWith("/_next/static/"))
    .filter((u) => /\.(css|woff2?)$/.test(u.pathname))
    .map((u) => u.pathname);
}

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const pagina = await fetch(PAGINA, { cache: "no-store" });
      if (!pagina.ok) throw new Error(`${PAGINA} respondió ${pagina.status}`);
      const html = await pagina.clone().text();
      const recursos = recursosDe(html, self.location.origin);
      // Las fuentes las nombra el CSS, no el HTML.
      for (const hoja of recursos.filter((ruta) => ruta.endsWith(".css"))) {
        const css = await (await fetch(hoja)).text();
        recursos.push(...recursosDe(css, new URL(hoja, self.location.origin)));
      }
      await cache.addAll([...new Set(recursos)]);
      // Se guarda sin los scripts de Next: sus JS no están en esta caché y, sin red, uno que falte hace que Next
      // cambie la página por su error global ("This page couldn't load"). Queda el script del tema, que va en línea,
      // y "Reintentar" es un formulario que funciona sin JavaScript.
      const sinNext = html
        .replace(/<script\b[^>]*\bsrc="[^"]*"[^>]*><\/script>/g, "")
        .replace(/<script>\(?self\.__next_f[\s\S]*?<\/script>/g, "")
        .replace(/<link rel="preload" as="script"[^>]*>/g, "");
      const cabeceras = new Headers(pagina.headers);
      cabeceras.delete("content-length");
      cabeceras.delete("content-encoding");
      await cache.put(PAGINA, new Response(sinNext, { headers: cabeceras }));
    })(),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    (async () => {
      // La navegación sale a la red mientras arranca el service worker: no hace más lenta la captura.
      await self.registration.navigationPreload?.enable();
      for (const nombre of await caches.keys()) if (nombre !== CACHE) await caches.delete(nombre);
    })(),
  );
});

self.addEventListener("fetch", (evento) => {
  const { request } = evento;
  if (request.method !== "GET") return;

  if (request.mode === "navigate") {
    evento.respondWith(
      (async () => {
        try {
          return (await evento.preloadResponse) ?? (await fetch(request));
        } catch {
          return (await caches.match(PAGINA)) ?? Response.error();
        }
      })(),
    );
    return;
  }

  // Solo lo que guardó la instalación, y solo si está guardado: lo demás va a la red sin tocarlo.
  const url = new URL(request.url);
  if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
    evento.respondWith(caches.match(url.pathname).then((guardado) => guardado ?? fetch(request)));
  }
});
