"use client";

import { useCallback, useEffect, useState } from "react";

import { useLive } from "@/lib/use-live";
import type { DepartmentsGeo, FleetLive, NetworkGeo } from "@/lib/types";

const FLEET_REFRESH_MS = 20_000;
const GEO_TTL_MS = 5 * 60_000;
const GEO_TIMEOUT_MS = 15_000;
const GEO_RETRY_MIN_MS = 4_000;
const GEO_RETRY_MAX_MS = 60_000;

export interface MapData {
  network: NetworkGeo | null;
  departments: DepartmentsGeo | null;
  fleet: FleetLive | null;
  error: string | null;
  /**
   * Vuelve a pedir la red y los departamentos ahora mismo (la flota sigue su propio sondeo). Para el botón
   * «Reintentar» de un aviso de error: no hace falta recargar la página.
   */
  retry: () => void;
}

type Geo = { network: NetworkGeo; departments: DepartmentsGeo };

/** Corte de una lectura por pausa/desmontaje: no es un fallo de la API y no se avisa como error. */
class GeoPaused extends Error {
  constructor() {
    super("lectura en pausa");
    this.name = "GeoPaused";
  }
}

const pageVisible = () => typeof document === "undefined" || document.visibilityState === "visible";
const hasNetwork = () => typeof navigator === "undefined" || navigator.onLine !== false;

async function getJson<T>(path: string, signal: AbortSignal): Promise<T> {
  // `no-cache`: el navegador guarda y revalida con If-None-Match; si no cambió, la API responde 304 sin cuerpo.
  const res = await fetch(path, { cache: "no-cache", signal });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

/**
 * Red y departamentos: casi no cambian, así que se piden una vez por visita y se reutilizan al pasar entre
 * páginas (resumen, red, detalle). Varios componentes comparten una sola petición; al cerrar una vía,
 * `invalidateMapData()` la marca vieja y, si hay alguien mirando, la vuelve a pedir.
 */
let geoData: Geo | null = null;
let geoAt = 0;
let geoFailures = 0;
let geoRequest: Promise<Geo> | null = null;
let geoController: AbortController | null = null;
let geoRetry: ReturnType<typeof setTimeout> | null = null;
/** Componentes con el mapa montado: sin ninguno no se reintenta ni se pide nada. */
let consumers = 0;

function stopGeoRetry() {
  if (geoRetry !== null) {
    clearTimeout(geoRetry);
    geoRetry = null;
  }
}

/** Reintento con espera creciente (4 s → 60 s) solo mientras haya un mapa visible. */
function scheduleGeoRetry() {
  if (geoRetry !== null || geoFailures <= 0 || consumers <= 0 || !pageVisible() || !hasNetwork()) return;
  const wait = Math.min(GEO_RETRY_MIN_MS * 2 ** Math.min(geoFailures - 1, 4), GEO_RETRY_MAX_MS);
  geoRetry = setTimeout(() => {
    geoRetry = null;
    if (consumers <= 0 || !pageVisible() || !hasNetwork()) return;
    void loadGeo(true).catch(() => scheduleGeoRetry());
  }, wait);
}

function fetchGeo(): Promise<Geo> {
  const controller = new AbortController();
  geoController = controller;
  const timeout = setTimeout(() => controller.abort("timeout"), GEO_TIMEOUT_MS);
  const request: Promise<Geo> = Promise.all([
    getJson<NetworkGeo>("/api/network/multimodal", controller.signal),
    getJson<DepartmentsGeo>("/api/geo/departments", controller.signal),
  ])
    .then(([network, departments]) => {
      geoData = { network, departments };
      geoAt = Date.now();
      geoFailures = 0;
      return geoData;
    })
    .catch((error: unknown) => {
      const reason = controller.signal.reason;
      // Si una de las dos lecturas falló, se corta la otra: no hay nada que completar en este intento.
      controller.abort("failed");
      if (reason === "pause" || reason === "unmount" || reason === "invalidate") throw new GeoPaused();
      geoFailures = Math.min(geoFailures + 1, 8);
      throw error;
    })
    .finally(() => {
      clearTimeout(timeout);
      if (geoController === controller) geoController = null;
      if (geoRequest === request) geoRequest = null;
    });
  geoRequest = request;
  return request;
}

function loadGeo(force = false): Promise<Geo> {
  if (geoRequest) {
    // Si la petición compartida se estaba cancelando (pausa, desmontaje o invalidación) y ya hay quien la
    // necesita otra vez, se encadena un intento nuevo en lugar de devolver el corte como error.
    return geoRequest.catch((error: unknown) => {
      if (error instanceof GeoPaused && consumers > 0 && pageVisible() && hasNetwork()) return loadGeo(force);
      throw error;
    });
  }
  if (!force && geoData && geoAt > 0 && Date.now() - geoAt <= GEO_TTL_MS) return Promise.resolve(geoData);
  return fetchGeo();
}

export function invalidateMapData() {
  geoAt = 0;
  geoFailures = 0;
  stopGeoRetry();
  const inFlight = geoRequest;
  geoController?.abort("invalidate");
  const refresh = () => {
    if (consumers > 0) void loadGeo(true).catch(() => scheduleGeoRetry());
  };
  // Se espera a que la petición en curso termine (o se corte) antes de pedir la nueva: así una respuesta que
  // venía en camino no se marca como fresca ni compite con la revalidación posterior al cierre de una vía.
  if (inFlight) void inFlight.then(refresh, refresh);
  else refresh();
}

// Ocultar la pestaña corta la lectura en curso (no se cuenta como fallo); al volver, si quedó vieja se pide.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (!pageVisible()) {
      stopGeoRetry();
      geoController?.abort("pause");
      return;
    }
    if (consumers > 0) void loadGeo(geoFailures > 0).catch(() => scheduleGeoRetry());
  });
}

if (typeof window !== "undefined") {
  window.addEventListener("offline", () => {
    stopGeoRetry();
    geoController?.abort("offline");
  });
  window.addEventListener("online", () => {
    if (consumers > 0 && pageVisible()) void loadGeo(geoFailures > 0).catch(() => scheduleGeoRetry());
  });
}

/**
 * Red, departamentos y flota en vivo. La flota se refresca cada 20 s con el sondeo compartido, que se pausa
 * con la pestaña oculta o (con `ref`) con el mapa fuera de pantalla; `fleet: false` no la pide. La red se
 * conserva entre páginas y se reintenta sola si la API falla.
 */
export function useMapData({
  fleet: withFleet = true,
  ref,
}: { fleet?: boolean; ref?: React.RefObject<Element | null> } = {}): MapData {
  const [base, setBase] = useState<Pick<MapData, "network" | "departments" | "error">>({
    network: null,
    departments: null,
    error: null,
  });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const fleet = useLive<FleetLive | null>(withFleet ? "/api/fleet/live" : null, FLEET_REFRESH_MS, null, ref);

  useEffect(() => {
    consumers += 1;
    let alive = true;
    const apply = (geo: Geo) => {
      if (alive) setBase({ network: geo.network, departments: geo.departments, error: null });
    };
    // La última red buena (de esta misma visita) se pinta tras la hidratación, no en el HTML del servidor: se ve
    // algo mientras se revalida y un fallo de la API no deja el mapa en blanco.
    const cached = geoData;
    if (cached) queueMicrotask(() => apply(cached));
    // Un reintento explícito (o un fallo anterior) salta el TTL de 5 min; el montaje normal reutiliza la red de
    // la visita anterior (si ya estaba en memoria, `loadGeo` resuelve en el acto y no hay petición nueva).
    loadGeo(attempt > 0 || geoFailures > 0)
      .then(apply)
      .catch((error: unknown) => {
        if (!alive || error instanceof GeoPaused) return;
        setBase((data) => ({ ...data, error: "No se pudo cargar la red" }));
        scheduleGeoRetry();
      });
    return () => {
      alive = false;
      consumers = Math.max(0, consumers - 1);
      if (consumers === 0) {
        stopGeoRetry();
        geoController?.abort("unmount");
      }
    };
  }, [attempt]);

  return { ...base, fleet: withFleet ? fleet : null, retry };
}
