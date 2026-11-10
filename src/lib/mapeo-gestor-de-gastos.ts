/**
 * Qué es cada cosa de la exportación de Gestor de Gastos en esta app (spec 012): lo decidió el desarrollador el
 * 2026-11-09. Las categorías que no cambian de nombre van a la que se llame igual, o se crean con su aspecto.
 */
import { categoriasBase } from "./categorias";
import type { Mapeo } from "./importacion";

export const mapeoGestorDeGastos: Mapeo = {
  cuentas: {
    Binance: "Binance",
    // Era su forma de separar dinero en Binance, porque la app vieja no tenía sobres.
    "Ahorro Earn": "Binance",
    Zelle: "Cuenta prima",
    "Banco de Venezuela": "Bolívares",
    Zinli: "Zinli",
  },
  cuentasNuevas: [{ nombre: "Zinli", moneda: "USD", tipo: "billetera" }],
  categorias: {
    gasto: {
      "Comida en la calle": "Comida fuera",
      Casa: "Hogar",
      Dispositivos: "Tecnología",
      Carro: "Transporte",
      Otros: "Otros gastos",
      // Fue Claude Code: no una inversión, y aquí Inversión es un sobre.
      Inversion: "Suscripción",
    },
    ingreso: {
      Salario: "Sueldo remoto",
      Pago: "Proyecto local",
      Sueldo: "Otros ingresos",
      Carrerita: "Otros ingresos",
    },
  },
  aspecto: {
    ...Object.fromEntries(categoriasBase.map((c) => [c.nombre, { icono: c.icono, color: c.color }])),
    "Comida fuera": { icono: "cubiertos", color: "coral" },
    Salidas: { icono: "cerveza", color: "ambar" },
    Aporte: { icono: "aporte", color: "verde" },
    Daniela: { icono: "corazon", color: "rosa" },
    Zapatos: { icono: "zapatos", color: "indigo" },
    Mobiliario: { icono: "sofa", color: "naranja" },
    Viaje: { icono: "avion", color: "azul" },
    Suscripción: { icono: "suscripcion", color: "turquesa" },
    Rutina: { icono: "pesas", color: "pino" },
    Deporte: { icono: "trofeo", color: "oliva" },
    Juego: { icono: "mando", color: "lavanda" },
  },
  omitir: [
    {
      hoja: "gastos",
      fecha: "2026-10-04",
      centavosUsd: 12_500,
      motivo: "Ya es un préstamo en la app: Dani debe el boleto",
    },
  ],
};
