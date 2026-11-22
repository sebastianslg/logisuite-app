"use client";

import { useEffect, useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

import { senalConPlazo } from "@/lib/abort";

type Conexion = "ok" | "sin-red" | "comprobando" | "sin-servidor";

/** Plazo de /api/health, ventana para no repetir el sondeo en ráfaga y tope del reintento con el servidor caído. */
const ESPERA_MS = 8_000;
const RAFAGA_MS = 1_000;
const REINTENTO_MS = 60_000;

let estado: Conexion = "ok";
/** A qué estado se vuelve si una comprobación con «Reconectando…» se cancela a mitad. */
let respaldo: Conexion = "sin-servidor";
let peticion: AbortController | null = null;
let reintento = 0;
let ultimoSondeo = 0;
const lectores = new Set<() => void>();

function cambiar(nuevo: Conexion) {
  if (estado === nuevo) return;
  estado = nuevo;
  lectores.forEach((fn) => fn());
}

function pararReintento() {
  if (reintento) {
    window.clearTimeout(reintento);
    reintento = 0;
  }
}

function programarReintento() {
  pararReintento();
  if (!lectores.size || estado === "ok" || document.hidden || !navigator.onLine) return;
  // Un solo temporizador y un tope de 60 s: con el servidor caído no se machaca la red
  reintento = window.setTimeout(() => {
    reintento = 0;
    void comprobar();
  }, REINTENTO_MS);
}

function sinRed() {
  peticion?.abort();
  pararReintento();
  cambiar("sin-red");
}

/**
 * Comprueba /api/health. La primera vez y al enfocar la ventana también con la conexión en «ok»,
 * pero nunca con dos peticiones a la vez ni dos seguidas dentro de la ventana de ráfaga.
 */
async function comprobar({ forzar = false, mostrar = false }: { forzar?: boolean; mostrar?: boolean } = {}) {
  if (!navigator.onLine) return sinRed();
  // Una petición cancelada no bloquea a la siguiente (volver «online» o remontar deben comprobar ya)
  if (document.hidden || (peticion && !peticion.signal.aborted)) return;
  const ahora = Date.now();
  if (!forzar && ahora - ultimoSondeo < RAFAGA_MS) return;
  ultimoSondeo = ahora;

  const actual = (peticion = new AbortController());
  if (mostrar && estado !== "comprobando") {
    respaldo = estado;
    cambiar("comprobando");
  }
  const plazo = senalConPlazo(actual.signal, ESPERA_MS);
  try {
    const r = await fetch("/api/health", { cache: "no-store", signal: plazo.signal });
    if (!actual.signal.aborted) cambiar(r.ok ? "ok" : "sin-servidor");
  } catch {
    if (!actual.signal.aborted) cambiar("sin-servidor");
  } finally {
    plazo.liberar();
    if (peticion === actual) {
      peticion = null;
      // Si se canceló (pestaña oculta o desmontaje), «Reconectando…» no puede quedarse para siempre
      if (actual.signal.aborted && estado === "comprobando") cambiar(respaldo);
      programarReintento();
    }
  }
}

function visibilidad() {
  if (document.hidden) {
    peticion?.abort();
    pararReintento();
    return;
  }
  // Al volver a la pestaña se comprueba; «Reconectando…» solo si ya se sabía de un problema
  void comprobar({ mostrar: estado !== "ok" });
}

function alEnfocar() {
  // El foco suele venir detrás de visibilitychange: la ventana de ráfaga evita el sondeo doble
  void comprobar();
}

function alPerderLinea() {
  sinRed();
}

function alVolverLinea() {
  // Volver de «sin conexión» es un cambio real: se comprueba sin esperar
  void comprobar({ forzar: true, mostrar: estado !== "ok" });
}

function subscribe(fn: () => void) {
  lectores.add(fn);
  if (lectores.size === 1) {
    window.addEventListener("offline", alPerderLinea);
    window.addEventListener("online", alVolverLinea);
    window.addEventListener("focus", alEnfocar);
    document.addEventListener("visibilitychange", visibilidad);
    // Arrancar con «ok» no se da por hecho: se pregunta al servidor. Si la pestaña está oculta, lo hará al
    // volver a ella (visibilitychange), así que aquí no se sondea a ciegas.
    if (!document.hidden) void comprobar({ forzar: true });
    programarReintento();
  }
  return () => {
    lectores.delete(fn);
    if (lectores.size) return;
    window.removeEventListener("offline", alPerderLinea);
    window.removeEventListener("online", alVolverLinea);
    window.removeEventListener("focus", alEnfocar);
    document.removeEventListener("visibilitychange", visibilidad);
    pararReintento();
    peticion?.abort();
  };
}

/**
 * Un solo indicador compartido por ambos docks. Comprueba al arrancar, al enfocar y al volver a la pestaña;
 * con el servidor caído reintenta cada 60 s (nunca hay un sondeo continuo mientras todo funciona).
 */
export function ConnectionIndicator() {
  const conexion = useSyncExternalStore(subscribe, () => estado, (): Conexion => "ok");
  if (conexion === "ok") return null;
  return (
    <span role="status" data-conexion className="flex items-center gap-1 px-1 text-xs text-muted-foreground print:hidden">
      <WifiOff aria-hidden className="size-3.5 shrink-0" />
      {conexion === "sin-servidor"
        ? <button type="button" onClick={() => void comprobar({ forzar: true, mostrar: true })} className="min-h-11 underline" title="No responde el servidor">Reintentar</button>
        : conexion === "comprobando" ? "Reconectando…" : "Sin conexión"}
    </span>
  );
}

/** Registro único del respaldo de navegación, también en las pantallas sin dock. */
export function OfflineBanner() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
