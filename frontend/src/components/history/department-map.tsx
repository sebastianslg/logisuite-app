"use client";

import { useEffect, useMemo, useState } from "react";

import { api } from "@/lib/client";
import type { DepartmentsGeo, HistoryDepartment } from "@/lib/types";
import { cn } from "@/lib/utils";

type Ring = number[][];
const W = 520;
const H = 620;

/** Cinco pasos de un solo tono (claro → oscuro); sin movimiento, gris neutro. */
const STEPS = [14, 30, 48, 68, 90];
const fill = (step: number) => (step < 0 ? "var(--fill)" : `color-mix(in srgb, var(--accent-solid) ${STEPS[step]}%, var(--card))`);

/**
 * Mapa coroplético por departamento: toneladas que salen y llegan en la ventana del historial. Proyección
 * equirectangular corregida por la latitud media (suficiente para un país cerca del ecuador), en SVG: no usa el
 * motor del mapa 3D ni corre nada por cuadro. Cortes por cuantiles para que la escala no la domine el granel.
 */
export function DepartmentMap({ departments }: { departments: HistoryDepartment[] }) {
  const [geo, setGeo] = useState<DepartmentsGeo | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  useEffect(() => {
    api<DepartmentsGeo>("/api/geo/departments").then(setGeo).catch(() => undefined);
  }, []);

  const byCode = useMemo(() => new Map(departments.map((d) => [d.code, d])), [departments]);
  const tons = (code: string) => {
    const d = byCode.get(code);
    return d ? d.tons_out + d.tons_in : 0;
  };

  const breaks = useMemo(() => {
    const vals = departments.map((d) => d.tons_out + d.tons_in).filter((v) => v > 0).sort((a, b) => a - b);
    if (!vals.length) return [];
    return [0.2, 0.4, 0.6, 0.8].map((q) => vals[Math.min(vals.length - 1, Math.floor(q * vals.length))]);
  }, [departments]);
  const step = (v: number) => (v <= 0 ? -1 : breaks.filter((b) => v > b).length);

  const shapes = useMemo(() => {
    if (!geo) return [];
    const rings: { code: string; name: string; rings: Ring[] }[] = geo.features.map((f) => {
      const g = f.geometry as { type: string; coordinates: unknown };
      const polys = (g.type === "Polygon" ? [g.coordinates] : g.coordinates) as Ring[][];
      return { code: f.properties.code, name: f.properties.name, rings: polys.flat() };
    });
    let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const s of rings) for (const r of s.rings) for (const [x, y] of r) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    const k = Math.cos((((y0 + y1) / 2) * Math.PI) / 180);
    const scale = Math.min((W - 8) / ((x1 - x0) * k), (H - 8) / (y1 - y0));
    const px = (x: number) => 4 + (x - x0) * k * scale;
    const py = (y: number) => 4 + (y1 - y) * scale;
    return rings.map((s) => ({
      code: s.code,
      name: s.name,
      d: s.rings.map((r) => `M${r.map(([x, y]) => `${px(x).toFixed(1)},${py(y).toFixed(1)}`).join("L")}Z`).join(""),
    }));
  }, [geo]);

  const ranking = [...departments].sort((a, b) => b.tons_out + b.tons_in - (a.tons_out + a.tons_in));
  const active = hover ? byCode.get(hover) : null;
  const activeName = hover ? shapes.find((s) => s.code === hover)?.name : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <figure className="glass relative rounded-3xl p-5">
        {!geo ? (
          <div className="skeleton mx-auto aspect-[52/62] max-h-[620px] rounded-2xl" aria-hidden />
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block h-auto max-h-[620px] w-full" role="img" aria-label="Toneladas por departamento en el período">
            {shapes.map((s) => {
              const v = tons(s.code);
              return (
                <path
                  key={s.code}
                  d={s.d}
                  fill={fill(step(v))}
                  stroke={hover === s.code ? "var(--foreground)" : "var(--card)"}
                  strokeWidth={hover === s.code ? 1.6 : 0.8}
                  strokeLinejoin="round"
                  onPointerEnter={() => setHover(s.code)}
                  onPointerLeave={() => setHover((h) => (h === s.code ? null : h))}
                  className="choro cursor-default transition-[stroke] duration-150"
                  style={{ "--q": step(v) + 1 } as React.CSSProperties}
                >
                  <title>{`${s.name}: ${v.toLocaleString("es-CO", { maximumFractionDigits: 0 })} t`}</title>
                </path>
              );
            })}
          </svg>
        )}
        {/* Detalle del departamento bajo el puntero */}
        <div className={cn("pointer-events-none absolute top-5 left-5 rounded-xl bg-card/95 px-3 py-2 text-sm shadow-sm ring-1 ring-border transition-opacity duration-150", hover ? "opacity-100" : "opacity-0")} aria-live="polite">
          {activeName && (
            <>
              <div className="font-medium">{activeName}</div>
              <div className="tabular text-xs text-muted-foreground">
                {active ? `${active.tons_fmt} · salen ${active.out} · llegan ${active.in}` : "Sin movimiento en el período"}
              </div>
            </>
          )}
        </div>
        <figcaption className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Toneladas (salen + llegan)</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-sm" style={{ background: fill(-1) }} aria-hidden /> Sin movimiento
          </span>
          {STEPS.map((_, i) => (
            <span key={i} className="tabular inline-flex items-center gap-1.5">
              <span className="size-3 rounded-sm" style={{ background: fill(i) }} aria-hidden />
              {i === 0 ? `hasta ${Math.round(breaks[0] ?? 0).toLocaleString("es-CO")}` : i === STEPS.length - 1 ? `más de ${Math.round(breaks[3] ?? 0).toLocaleString("es-CO")}` : `${Math.round(breaks[i - 1] ?? 0).toLocaleString("es-CO")}–${Math.round(breaks[i] ?? 0).toLocaleString("es-CO")}`}
            </span>
          ))}
        </figcaption>
      </figure>

      <section aria-labelledby="dep-rank" className="rows h-fit overflow-hidden rounded-3xl">
        <h2 id="dep-rank" className="px-5 py-3 text-sm font-semibold">
          Departamentos con más carga
        </h2>
        <ol>
          {ranking.slice(0, 12).map((d, i) => (
            <li
              key={d.code}
              onPointerEnter={() => setHover(d.code)}
              onPointerLeave={() => setHover(null)}
              className={cn("flex items-center gap-3 border-t border-border px-5 py-2.5 text-sm", hover === d.code && "bg-[color-mix(in_srgb,var(--card)_95%,var(--foreground))]")}
            >
              <span className="tabular w-5 text-right text-xs text-muted-foreground">{i + 1}</span>
              <span className="size-2.5 shrink-0 rounded-sm" style={{ background: fill(step(d.tons_out + d.tons_in)) }} aria-hidden />
              <span className="min-w-0 flex-1 truncate">{d.name}</span>
              <span className="tabular font-medium">{d.tons_fmt}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
