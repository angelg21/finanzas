import { describe, expect, it, vi } from "vitest";
import { causaDeFalla, conFallas, mensajeDeFalla, mensajeDeFallaAlEntrar } from "./fallas";

const redireccion = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;push;/entrar;303;" });
const noEncontrado = Object.assign(new Error("NEXT_HTTP_ERROR_FALLBACK;404"), {
  digest: "NEXT_HTTP_ERROR_FALLBACK;404",
});
const versionVieja = Object.assign(new Error('Server Action "abc" was not found on the server.'), {
  name: "UnrecognizedActionError",
});

describe("causaDeFalla (spec 002, criterio 19)", () => {
  it("sin red: el fetch de la acción falla con TypeError en cualquier navegador", () => {
    expect(causaDeFalla(new TypeError("Failed to fetch"))).toBe("sin-red");
    expect(causaDeFalla(new TypeError("Load failed"))).toBe("sin-red");
    expect(causaDeFalla(new TypeError("NetworkError when attempting to fetch resource."))).toBe("sin-red");
  });

  it("versión vieja: el servidor ya no conoce la acción", () => {
    expect(causaDeFalla(versionVieja)).toBe("version");
  });

  it("las redirecciones y los 404 de Next no son fallas: los maneja Next", () => {
    expect(causaDeFalla(redireccion)).toBe("de-next");
    expect(causaDeFalla(noEncontrado)).toBe("de-next");
  });

  it("lo demás es otra falla", () => {
    expect(causaDeFalla(new Error("algo"))).toBe("otra");
    expect(causaDeFalla("texto")).toBe("otra");
    expect(causaDeFalla(undefined)).toBe("otra");
    expect(causaDeFalla({ digest: 42 })).toBe("otra");
  });
});

describe("mensajeDeFalla: un mensaje por causa (criterio 19)", () => {
  it("dice exactamente lo de la spec para el gasto", () => {
    // Sin red no se sabe si llegó: el corte pudo ser después de guardar (decisión del desarrollador, 2026-10-17).
    expect(mensajeDeFalla("sin-red")).toBe(
      "Sin conexión: no se pudo confirmar. Vuelve a tocar Guardar cuando tengas red; no se duplica.",
    );
    expect(mensajeDeFalla("sesion")).toBe("Tu sesión terminó: el gasto no se guardó. Entra de nuevo.");
    expect(mensajeDeFalla("version")).toBe("La app se actualizó: recarga y vuelve a guardar.");
  });

  it("en categorías y sobres dice lo mismo sin nombrar el gasto", () => {
    expect(mensajeDeFalla("sin-red", "no se guardó")).toBe(
      "Sin conexión: no se pudo confirmar si se guardó. Vuelve a intentarlo cuando tengas red.",
    );
    expect(mensajeDeFalla("sin-red", "el ingreso no se guardó")).toBe(mensajeDeFalla("sin-red", "no se guardó"));
    expect(mensajeDeFalla("sesion", "no se guardó")).toBe("Tu sesión terminó: no se guardó. Entra de nuevo.");
    expect(mensajeDeFalla("version", "no se guardó")).toBe("La app se actualizó: recarga y vuelve a guardar.");
  });

  it("una falla desconocida pide intentarlo otra vez", () => {
    expect(mensajeDeFalla("otra")).toBe("No se pudo guardar. Intenta de nuevo.");
  });
});

describe("mensajeDeFallaAlEntrar: entrar no guarda nada, así que no habla de guardar", () => {
  it("dice qué pasó al entrar, por causa", () => {
    expect(mensajeDeFallaAlEntrar("sin-red")).toBe(
      "Sin conexión: no se pudo entrar. Vuelve a intentarlo cuando tengas red.",
    );
    expect(mensajeDeFallaAlEntrar("version")).toBe("La app se actualizó: recarga y vuelve a entrar.");
    expect(mensajeDeFallaAlEntrar("otra")).toBe("No se pudo entrar. Intenta de nuevo.");
  });
});

type Estado = { ronda: number; error?: string };
const alFallar = (previo: Estado, _datos: FormData, causa: string): Estado => ({
  ronda: previo.ronda + 1,
  error: causa,
});

describe("conFallas: la acción envuelta nunca pierde la pantalla", () => {
  it("devuelve lo que devuelve la acción", async () => {
    const accion = vi.fn(async (previo: Estado) => ({ ronda: previo.ronda + 1 }));
    expect(await conFallas(accion, alFallar)({ ronda: 0 }, new FormData())).toEqual({ ronda: 1 });
    expect(accion).toHaveBeenCalledTimes(1);
  });

  it("convierte una falla en estado, sin reintentar", async () => {
    const accion = vi.fn(async (): Promise<Estado> => {
      throw new TypeError("Failed to fetch");
    });
    expect(await conFallas(accion, alFallar)({ ronda: 3 }, new FormData())).toEqual({ ronda: 4, error: "sin-red" });
    expect(accion).toHaveBeenCalledTimes(1);
  });

  it("deja pasar las redirecciones de Next", async () => {
    const accion = async (): Promise<Estado> => {
      throw redireccion;
    };
    await expect(conFallas(accion, alFallar)({ ronda: 0 }, new FormData())).rejects.toBe(redireccion);
  });

  it("conserva las marcas con que React pinta el formulario sin JavaScript", () => {
    const formAction = () => ({ name: "$ACTION_ID_x" });
    const firmaIgual = () => true;
    const ligada = Object.assign(() => undefined, { $$FORM_ACTION: formAction });
    const accion = Object.assign(async (previo: Estado) => previo, {
      $$FORM_ACTION: formAction,
      $$IS_SIGNATURE_EQUAL: firmaIgual,
      bind: vi.fn<(...argumentos: unknown[]) => typeof ligada>(() => ligada),
    });
    const envuelta = conFallas(accion, alFallar) as typeof accion;
    expect(envuelta.$$FORM_ACTION).toBe(formAction);
    // Atada a la acción del servidor, no copiada tal cual: ver la prueba siguiente (spec 004, T6).
    expect(envuelta.$$IS_SIGNATURE_EQUAL()).toBe(firmaIgual());
    // React liga el estado inicial a la acción del servidor, no a la envoltura.
    expect(envuelta.bind(null, { ronda: 0 })).toBe(ligada);
    expect(accion.bind).toHaveBeenCalledWith(null, { ronda: 0 });
  });

  it("al responder sin JavaScript, la firma se compara con la acción del servidor como `this`, no con la envoltura", () => {
    // React llama envuelta.$$IS_SIGNATURE_EQUAL(...) con la envoltura de `this`, y la de React busca `this` entre las
    // acciones que conoce: con la envoltura lanza "Tried to encode a Server Action from a different instance".
    const accion = Object.assign(async (previo: Estado) => previo, {
      $$FORM_ACTION: () => ({ name: "$ACTION_ID_x" }),
      $$IS_SIGNATURE_EQUAL: vi.fn<(...argumentos: unknown[]) => boolean>(() => true),
      bind: () => undefined,
    });
    const envuelta = conFallas(accion, alFallar) as typeof accion;
    expect(envuelta.$$IS_SIGNATURE_EQUAL.call(envuelta, "1:0", 1)).toBe(true);
    // vitest guarda el `this` de cada llamada en mock.contexts.
    expect(accion.$$IS_SIGNATURE_EQUAL.mock.contexts[0]).toBe(accion);
    expect(accion.$$IS_SIGNATURE_EQUAL).toHaveBeenCalledWith("1:0", 1);
  });

  it("sin marcas, no inventa ninguna", () => {
    const envuelta = conFallas(async (previo: Estado) => previo, alFallar) as unknown as Record<string, unknown>;
    expect(envuelta.$$FORM_ACTION).toBeUndefined();
  });
});
