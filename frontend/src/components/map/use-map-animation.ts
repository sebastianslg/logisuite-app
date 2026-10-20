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

function stored(): "on" | "off" | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "on" || v === "off" ? v : null;
  } catch {
    return null;
  }
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
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* sin almacenamiento: el cambio vale solo hasta recargar */
  }
  listeners.forEach((l) => l());
}

/** Compartido entre el mapa, el panel de capas y el botón de pausa: todos ven el mismo estado. */
export function useMapAnimation() {
  const animate = useSyncExternalStore(subscribe, snapshot, () => true);
  return { animate, setAnimate: setMapAnimation };
}
