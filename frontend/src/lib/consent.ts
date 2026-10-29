"use client";

import { useEffect, useSyncExternalStore } from "react";

import { api } from "@/lib/client";

/**
 * Aceptación de términos y privacidad en este navegador.
 *
 * - Cada navegador tiene un identificador al azar (no dice quién es la persona) que une sus aceptaciones en el
 *   registro del servidor (mm_consents). La prueba vive en el servidor; aquí solo se guarda una copia de lo
 *   aceptado (westvane.consent) para mostrarla en Configuración.
 * - `useConsent()` comparte un solo estado entre la ventana de bienvenida y Configuración.
 */
const K_BROWSER = "westvane.browser-id";
const K_CACHE = "westvane.consent";

export type ConsentDoc = "terminos" | "privacidad" | "autorizacion_terceros";
export type ConsentContext = "primer_uso" | "adjunto" | "importacion" | "configuracion";
export type ConsentItem = { document: ConsentDoc; version?: string; accepted?: boolean; text: string };
export type ConsentRecord = { document: ConsentDoc; version: string; accepted: number; created_at: string; subject: string; context: string };
export type ConsentStatus = {
  browser_id: string;
  documents: Partial<Record<ConsentDoc, ConsentRecord>>;
  pending: ConsentDoc[];
  versions: Record<ConsentDoc, string>;
};

type State = { status: ConsentStatus | null; error: boolean };
/** Lo que pintó el servidor: sin estado todavía. */
const SERVER_STATE: State = { status: null, error: false };
let state: State = SERVER_STATE;
const listeners = new Set<() => void>();
const set = (next: State) => {
  state = next;
  listeners.forEach((l) => l());
};
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export function browserId(): string {
  try {
    let id = localStorage.getItem(K_BROWSER);
    if (!id) {
      id = `nav-${crypto.randomUUID()}`;
      localStorage.setItem(K_BROWSER, id);
    }
    return id;
  } catch {
    // Sin almacenamiento: un identificador por sesión (la aceptación se pedirá en cada visita)
    return (window as Window & { __wvBrowser?: string }).__wvBrowser ??= `nav-${crypto.randomUUID()}`;
  }
}

function saveCache(st: ConsentStatus) {
  const accepted = Object.fromEntries(
    Object.entries(st.documents)
      .filter(([, r]) => r && r.accepted === 1)
      .map(([d, r]) => [d, r!.version]),
  );
  try {
    localStorage.setItem(K_CACHE, JSON.stringify(accepted));
  } catch {
    /* sin almacenamiento */
  }
}

let loading: Promise<void> | null = null;
export function refreshConsent() {
  loading ??= api<ConsentStatus>(`/api/consents?browser_id=${encodeURIComponent(browserId())}`)
    .then((st) => {
      saveCache(st);
      set({ status: st, error: false });
    })
    .catch(() => set({ ...state, error: true }))
    .finally(() => {
      loading = null;
    });
  return loading;
}

/** Registra aceptaciones o revocaciones y actualiza el estado compartido. */
export async function recordConsent(items: ConsentItem[], context: ConsentContext, subject?: string) {
  const st = await api<ConsentStatus>("/api/consents", {
    method: "POST",
    body: { browser_id: browserId(), subject: subject || null, context, items },
  });
  saveCache(st);
  set({ status: st, error: false });
  return st;
}

/**
 * Estado de aceptación de este navegador; `status` es null mientras no se sabe.
 *
 * Al hidratar se usa siempre el estado vacío del servidor, aunque el navegador ya lo tenga: el panel de
 * Configuración llega en un límite de Suspense que se hidrata después del armazón, y para entonces la ventana de
 * aceptación pudo haber traído el estado. Con `() => state` el primer render del panel difería del HTML (React #418).
 */
export function useConsent() {
  const s = useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
  useEffect(() => {
    if (!state.status) void refreshConsent();
  }, []);
  return s;
}

/** Texto de la declaración al subir adjuntos o importar (se guarda tal cual en el registro). */
export const CHECK_THIRD_PARTY =
  "Declaro que tengo autorización de las personas cuyos datos personales aparecen en estos archivos para cargarlos en Westvane.";
