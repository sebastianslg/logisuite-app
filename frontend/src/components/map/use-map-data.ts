"use client";

import { useEffect, useState } from "react";

import { useLive } from "@/lib/use-live";
import type { DepartmentsGeo, FleetLive, NetworkGeo } from "@/lib/types";

const FLEET_REFRESH_MS = 20_000;

export interface MapData {
  network: NetworkGeo | null;
  departments: DepartmentsGeo | null;
  fleet: FleetLive | null;
  error: string | null;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

/**
 * Red y departamentos: casi no cambian, así que se piden una vez por visita y se reutilizan al pasar
 * entre páginas (resumen, red, detalle). Si cambia una vía (cierre), `invalidateMapData()` los renueva.
 */
let geo: Promise<[NetworkGeo, DepartmentsGeo]> | null = null;
let geoAt = 0;
const GEO_TTL_MS = 5 * 60_000;

function loadGeo() {
  if (!geo || Date.now() - geoAt > GEO_TTL_MS) {
    geoAt = Date.now();
    geo = Promise.all([getJson<NetworkGeo>("/api/network/multimodal"), getJson<DepartmentsGeo>("/api/geo/departments")]);
    geo.catch(() => {
      geo = null;
    });
  }
  return geo;
}

export function invalidateMapData() {
  geo = null;
}

/**
 * Red, departamentos y flota en vivo. La flota se refresca cada 20 s con un sondeo compartido que se
 * pausa con la pestaña oculta o (con `ref`) con el mapa fuera de pantalla; `fleet: false` no la pide.
 */
export function useMapData({ fleet: withFleet = true, ref }: { fleet?: boolean; ref?: React.RefObject<Element | null> } = {}): MapData {
  const [base, setBase] = useState<Pick<MapData, "network" | "departments" | "error">>({
    network: null,
    departments: null,
    error: null,
  });
  const fleet = useLive<FleetLive | null>(withFleet ? "/api/fleet/live" : null, FLEET_REFRESH_MS, null, ref);

  useEffect(() => {
    let alive = true;
    loadGeo()
      .then(([network, departments]) => alive && setBase({ network, departments, error: null }))
      .catch(() => alive && setBase((d) => ({ ...d, error: "No se pudo cargar la red" })));
    return () => {
      alive = false;
    };
  }, []);

  return { ...base, fleet: withFleet ? fleet : null };
}
