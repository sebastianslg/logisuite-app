"use client";

import { useSyncExternalStore } from "react";

const KEY = "westvane:map-anim";
const listeners = new Set<() => void>();
let software: boolean | null = null;

/** El navegador dibuja con la CPU (sin tarjeta gráfica): aceleración desactivada, escritorio remoto, máquina virtual. */
export function usesSoftwareGL(): boolean {
  if (software !== null) return software;
  try {
    const gl = document.createElement("canvas").getContext("webgl") as WebGLRenderingContext | null;
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    const renderer = gl && ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "";
    software = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer);
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    software = false;
  }
  return software;
}

// Respaldo en memoria si el navegador bloquea localStorage (modo privado estricto): la elección vale en esta
// visita y el interruptor responde igual; al recargar vuelve el valor por defecto.
const memoryPrefs = new Map<string, string>();
function readPref(key: string): string | null {
  try {
    return window.localStorage.getItem(key) ?? memoryPrefs.get(key) ?? null;
  } catch {
    return memoryPrefs.get(key) ?? null;
  }
}
function writePref(key: string, value: string | null) {
  if (value === null) memoryPrefs.delete(key);
  else memoryPrefs.set(key, value);
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* sin almacenamiento: la elección queda en memoria esta visita */
  }
}

function stored(): "on" | "off" | null {
  const v = readPref(KEY);
  return v === "on" || v === "off" ? v : null;
}

/** Pantalla pequeña (celular): el mapa animado es lo que más consume, así que arranca apagado. */
const narrowScreen = () =>
  typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;

/** La animación del mapa: lo que eligió la persona; por defecto, apagada en celulares y en equipos sin GPU. */
const snapshot = () => {
  const pref = stored();
  return pref ? pref === "on" : !usesSoftwareGL() && !narrowScreen();
};

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
};

export function setMapAnimation(on: boolean) {
  writePref(KEY, on ? "on" : "off");
  listeners.forEach((l) => l());
}

/** Compartido entre el mapa, el panel de capas y el botón de pausa: todos ven el mismo estado. */
export function useMapAnimation() {
  const animate = useSyncExternalStore(subscribe, snapshot, () => true);
  return { animate, setAnimate: setMapAnimation };
}

// ---- Calidad del mapa ------------------------------------------------------
// Liviana: plano (sin inclinación ni relieve), resolución 1x y sin rotar. Automática elige liviana en equipos que
// dibujan sin tarjeta gráfica o con poca memoria; Alta fuerza el mapa completo.
export type MapQuality = "auto" | "alta" | "liviana";
const QKEY = "westvane:map-quality";

function storedQuality(): MapQuality {
  const v = readPref(QKEY);
  return v === "alta" || v === "liviana" ? v : "auto";
}

/** Equipo modesto: sin aceleración gráfica o con 4 GB de memoria o menos (cuando el navegador lo informa). */
export function lowEndDevice(): boolean {
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return usesSoftwareGL() || (memory !== undefined && memory <= 4);
}

const liteSnapshot = () => {
  const q = storedQuality();
  return q === "liviana" || (q === "auto" && lowEndDevice());
};

export function setMapQuality(q: MapQuality) {
  writePref(QKEY, q === "auto" ? null : q);
  listeners.forEach((l) => l());
}

export function useMapQuality() {
  const quality = useSyncExternalStore(subscribe, storedQuality, () => "auto" as MapQuality);
  const lite = useSyncExternalStore(subscribe, liteSnapshot, () => false);
  return { quality, lite, setQuality: setMapQuality };
}

// ---- Mapa base -------------------------------------------------------------
// El mapa base (MapLibre) es opcional: con el estilo local solo pinta el mar y la atribución, porque la silueta,
// la máscara y los datos los dibuja deck.gl. Arranca APAGADO en todos los equipos: con el mapa base montado,
// MapLibre y deck.gl mantenían trabajo continuo (4 s de CPU cada 5 s en la Red); sin él, el mapa queda en reposo.
// El interruptor sigue disponible para cuando haya teselas locales (PMTiles) y la elección se recuerda.
const BKEY = "westvane:map-base";

/** Compatibilidad con llamadas existentes: el mapa base ya no se enciende solo en equipos grandes. */
export function mapBaseByDefault(): boolean {
  return false;
}

function storedBase(): "on" | "off" | null {
  const v = readPref(BKEY);
  return v === "on" || v === "off" ? v : null;
}

const baseSnapshot = () => {
  const pref = storedBase();
  return pref ? pref === "on" : mapBaseByDefault();
};

export function setMapBase(on: boolean) {
  writePref(BKEY, on ? "on" : "off");
  listeners.forEach((l) => l());
}

/** El interruptor «Mapa base» del mapa: compartido entre mapas y persistente. */
export function useMapBase() {
  const base = useSyncExternalStore(subscribe, baseSnapshot, () => false);
  return { base, setBase: setMapBase };
}

/** Nombre de la tarjeta gráfica que usa el navegador (para el diagnóstico); vacío si no lo informa. */
export function glRenderer(): string {
  try {
    const gl = document.createElement("canvas").getContext("webgl") as WebGLRenderingContext | null;
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    const name = gl && ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "";
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return name;
  } catch {
    return "";
  }
}
