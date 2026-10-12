import { useSyncExternalStore } from "react";
import { type BorradorCaptura, borradorATexto, borradorDesdeTexto } from "@/lib/borrador-captura";

/*
  El borrador de la captura en la pestaña (criterio 25): se guarda al tocar "Nueva", se recupera al volver
  a la captura por cualquier camino y se olvida al guardar el gasto, así que nada guardado reaparece. Si la
  pestaña no deja guardar (modo privado, almacenamiento bloqueado), no hay borrador y la captura funciona
  como sin él.
*/
const clave = "finanzas:borrador-captura";

function leerTexto(): string | null {
  try {
    return sessionStorage.getItem(clave);
  } catch {
    return null;
  }
}

/*
  Mientras el texto guardado no cambie ni caduque, el mismo objeto: useSyncExternalStore exige una lectura
  estable. La vigencia se mira en cada lectura, porque la página puede seguir abierta más de 30 minutos.
*/
let leido: { texto: string | null; borrador: BorradorCaptura | null } = { texto: null, borrador: null };

function leerBorrador(): BorradorCaptura | null {
  const texto = leerTexto();
  const ahora = borradorDesdeTexto(texto, Date.now());
  if (texto !== leido.texto || (ahora === null) !== (leido.borrador === null)) leido = { texto, borrador: ahora };
  return leido.borrador;
}

// La pestaña no avisa de sus propios cambios: basta leerla al montar la captura.
const sinSuscripcion = () => () => {};

/** El borrador vigente, sin consumirlo. En el servidor y al hidratar no hay ninguno: no hay desajuste. */
export function useBorrador(): BorradorCaptura | null {
  return useSyncExternalStore(sinSuscripcion, leerBorrador, () => null);
}

export function guardarBorrador(borrador: BorradorCaptura) {
  try {
    sessionStorage.setItem(clave, borradorATexto(borrador, Date.now()));
  } catch {
    // Sin almacenamiento, lo escrito se pierde al ir a crear la categoría, como sin JavaScript.
  }
}

export function olvidarBorrador() {
  try {
    sessionStorage.removeItem(clave);
  } catch {
    // Nada que olvidar.
  }
}
