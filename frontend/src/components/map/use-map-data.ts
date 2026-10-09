"use client";

import { useEffect, useState } from "react";

import type { DepartmentsGeo, FleetLive, NetworkGeo } from "@/lib/types";

const FLEET_REFRESH_MS = 20_000;

export interface MapData {
  network: NetworkGeo | null;
  departments: DepartmentsGeo | null;
  fleet: FleetLive | null;
  error: string | null;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

/** Red, departamentos y flota en vivo (la flota se refresca cada 20 s). */
export function useMapData(): MapData {
  const [data, setData] = useState<MapData>({
    network: null,
    departments: null,
    fleet: null,
    error: null,
  });

  useEffect(() => {
    let alive = true;
    Promise.all([
      getJson<NetworkGeo>("/api/network/multimodal"),
      getJson<DepartmentsGeo>("/api/geo/departments"),
      getJson<FleetLive>("/api/fleet/live"),
    ])
      .then(([network, departments, fleet]) => {
        if (alive) setData({ network, departments, fleet, error: null });
      })
      .catch(() => alive && setData((d) => ({ ...d, error: "No se pudo cargar la red" })));

    const id = setInterval(() => {
      getJson<FleetLive>("/api/fleet/live")
        .then((fleet) => alive && setData((d) => ({ ...d, fleet })))
        .catch(() => undefined);
    }, FLEET_REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return data;
}
