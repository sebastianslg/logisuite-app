import type { Mode, Trip } from "@/lib/types";

export type Position3 = [number, number, number];

const R = 6371;

export function haversineKm([lon1, lat1]: number[], [lon2, lat2]: number[]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Altura máxima (m) del arco de un vuelo según su distancia. */
export function flightApex(km: number): number {
  return Math.min(220_000, km * 1000 * 0.16);
}

/** Puntos de un vuelo con altura parabólica (para que el avión vaya por el aire). */
export function flightArc(a: number[], b: number[], steps = 32): Position3[] {
  const apex = flightApex(haversineKm(a, b));
  return Array.from({ length: steps + 1 }, (_, i) => {
    const f = i / steps;
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, 4 * apex * f * (1 - f)];
  });
}

export interface TripSegment {
  mode: Mode;
  path: Position3[];
  timestamps: number[];
}

/**
 * Parte un recorrido en tramos por modo (descarta los transbordos, que son
 * puntos quietos) y eleva los tramos aéreos sobre su arco.
 */
export function splitTrip(trip: Trip): TripSegment[] {
  const segments: TripSegment[] = [];
  let current: TripSegment | null = null;
  for (let i = 1; i < trip.path.length; i++) {
    const mode = trip.modes[i];
    if (mode === "transbordo") {
      current = null;
      continue;
    }
    if (!current || current.mode !== mode) {
      current = { mode: mode as Mode, path: [[...trip.path[i - 1], 0] as Position3], timestamps: [trip.timestamps[i - 1]] };
      segments.push(current);
    }
    current.path.push([...trip.path[i], 0] as Position3);
    current.timestamps.push(trip.timestamps[i]);
  }
  // Vuelos: se densifican con altura e interpolación lineal del tiempo
  return segments.map((s) => {
    if (s.mode !== "aereo" || s.path.length < 2) return s;
    const a = s.path[0];
    const b = s.path[s.path.length - 1];
    const t0 = s.timestamps[0];
    const t1 = s.timestamps[s.timestamps.length - 1];
    const arc = flightArc(a, b);
    return {
      mode: s.mode,
      path: arc,
      timestamps: arc.map((_, i) => t0 + ((t1 - t0) * i) / (arc.length - 1)),
    };
  });
}

/** Posición interpolada de un tramo en el instante t (o null si no está activo). */
export function positionAt(seg: TripSegment, t: number): Position3 | null {
  const ts = seg.timestamps;
  if (t < ts[0] || t > ts[ts.length - 1]) return null;
  for (let i = 1; i < ts.length; i++) {
    if (t <= ts[i]) {
      const span = ts[i] - ts[i - 1];
      const f = span > 0 ? (t - ts[i - 1]) / span : 0;
      const a = seg.path[i - 1];
      const b = seg.path[i];
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
    }
  }
  return seg.path[seg.path.length - 1];
}

export function boundsOf(points: number[][]): [[number, number], [number, number]] {
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return [
    [minX, minY],
    [maxX, maxY],
  ];
}
