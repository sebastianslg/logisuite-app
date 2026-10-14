"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { api } from "@/lib/client";
import type { WarehouseSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

import { tierOf } from "./status";

type Poly = number[][][];
type Dept = { geometry: { type: string; coordinates: unknown } };

const LON0 = -79.6;
const LON1 = -66.6;
const LAT0 = -4.4;
const LAT1 = 13.6;
const K = 44; // píxeles por grado
const COS = Math.cos((4.5 * Math.PI) / 180);
const W = Math.round((LON1 - LON0) * COS * K);
const H = Math.round((LAT1 - LAT0) * K);
const px = (lon: number) => (lon - LON0) * COS * K;
const py = (lat: number) => (LAT1 - lat) * K;

/**
 * Esquema de la red: cada bodega en su lugar, unida a su centro padre (nacional o regional).
 * Es SVG liviano (sin WebGL). El tamaño marca el nivel de la red; los filtros atenúan el resto.
 */
export function WarehouseNetworkMap({
  network,
  highlight,
  className,
}: {
  network: WarehouseSummary["network"];
  highlight?: (n: WarehouseSummary["network"][number]) => boolean;
  className?: string;
}) {
  const router = useRouter();
  const [paths, setPaths] = useState<string[]>([]);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    api<{ features: Dept[] }>("/api/geo/departments")
      .then((d) => {
        const out: string[] = [];
        for (const f of d.features) {
          const polys: Poly[] = f.geometry.type === "Polygon" ? [f.geometry.coordinates as Poly] : (f.geometry.coordinates as Poly[]);
          for (const poly of polys) {
            for (const ring of poly) {
              out.push("M" + ring.map(([lon, lat]) => `${px(lon).toFixed(1)},${py(lat).toFixed(1)}`).join("L") + "Z");
            }
          }
        }
        setPaths(out);
      })
      .catch(() => undefined);
  }, []);

  const byCode = useMemo(() => new Map(network.map((n) => [n.code, n])), [network]);
  const active = (n: WarehouseSummary["network"][number]) => !highlight || highlight(n);
  const shown = hover ? byCode.get(hover) : null;

  return (
    <div className={cn("relative", className)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Esquema de la red de bodegas de Colombia" className="h-auto w-full">
        <path d={paths.join("")} fill="var(--fill)" stroke="var(--separator-strong)" strokeWidth={0.6} />
        {network.map((n) =>
          n.parent && byCode.get(n.parent) && n.lat !== null && n.lon !== null ? (
            <line
              key={`l-${n.code}`}
              x1={px(n.lon)}
              y1={py(n.lat)}
              x2={px(byCode.get(n.parent)!.lon!)}
              y2={py(byCode.get(n.parent)!.lat!)}
              stroke="var(--muted-foreground)"
              strokeWidth={tierOf(n.role) === 1 ? 1.1 : 0.7}
              strokeOpacity={active(n) ? 0.45 : 0.1}
              strokeDasharray={tierOf(n.role) === 1 ? undefined : "3 3"}
            />
          ) : null,
        )}
        {network
          .filter((n) => n.lat !== null && n.lon !== null)
          .sort((a, b) => tierOf(b.role) - tierOf(a.role))
          .map((n) => {
            const t = tierOf(n.role);
            const r = t === 0 ? 9 : t === 1 ? 6.5 : 4.5;
            const on = active(n);
            return (
              <a
                key={n.code}
                href={`/bodegas/${n.id}`}
                aria-label={`${n.name}, ${n.city}`}
                onClick={(e) => {
                  e.preventDefault();
                  router.push(`/bodegas/${n.id}`);
                }}
                onMouseEnter={() => setHover(n.code)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(n.code)}
                onBlur={() => setHover(null)}
                className="outline-none [&:focus-visible>circle:last-child]:stroke-[var(--accent)] [&:focus-visible>circle:last-child]:stroke-[2.5]"
              >
                <circle cx={px(n.lon!)} cy={py(n.lat!)} r={r + 8} fill="transparent" />
                <circle
                  cx={px(n.lon!)}
                  cy={py(n.lat!)}
                  r={r}
                  fill={t === 2 ? "var(--card)" : "var(--accent-solid)"}
                  stroke={t === 2 ? "var(--accent)" : "var(--card)"}
                  strokeWidth={t === 2 ? 1.6 : 1.4}
                  opacity={on ? 1 : 0.22}
                />
              </a>
            );
          })}
      </svg>
      <div className="pointer-events-none absolute bottom-2 left-2 hidden gap-3 rounded-xl bg-card/80 px-3 py-2 text-xs text-muted-foreground backdrop-blur-md sm:flex" aria-hidden>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-[var(--accent-solid)]" />Centro nacional</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[var(--accent-solid)]" />Regional</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full border-2 border-[var(--accent)] bg-card" />Especializada o urbana</span>
      </div>
      {shown && shown.lat !== null && (
        <div
          role="status"
          className="pointer-events-none absolute z-10 max-w-52 -translate-x-1/2 -translate-y-[calc(100%+14px)] rounded-lg border border-border-strong bg-card px-3 py-2 text-xs shadow-xl"
          style={{ left: `${(px(shown.lon!) / W) * 100}%`, top: `${(py(shown.lat) / H) * 100}%` }}
        >
          <div className="font-medium">{shown.name}</div>
          <div className="text-muted-foreground">{shown.city}</div>
        </div>
      )}
    </div>
  );
}
