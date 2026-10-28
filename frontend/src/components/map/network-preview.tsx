"use client";

import { useMemo } from "react";

import { MODES } from "@/lib/modes";
import type { DepartmentsGeo, FleetLive, NetworkGeo } from "@/lib/types";
import { cn } from "@/lib/utils";

type Ring = number[][];

/**
 * Vista previa de la red en SVG: departamentos, enlaces por modo, nodos y la flota en su posición actual. Es
 * plana, sin WebGL ni reloj de animación: se dibuja una vez y solo cambia cuando llega la flota (cada 20 s).
 * Entrar y salir del resumen deja de crear y destruir un mapa 3D (contexto gráfico, sombreadores, teselas),
 * que era lo que trababa la pestaña. Proyección equirectangular corregida por la latitud media.
 */
export function NetworkPreview({
  network,
  departments,
  fleet,
  className,
}: {
  network: NetworkGeo;
  departments: DepartmentsGeo;
  fleet?: FleetLive | null;
  className?: string;
}) {
  const geo = useMemo(() => {
    const deptRings: { code: string; rings: Ring[] }[] = departments.features.map((f) => {
      const g = f.geometry as { type: string; coordinates: unknown };
      const polys = (g.type === "Polygon" ? [g.coordinates] : g.coordinates) as Ring[][];
      return { code: f.properties.code, rings: polys.flat() };
    });
    // El encuadre cubre la red completa (incluye puertos y aeropuertos fuera del país)
    let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
    const grow = ([x, y]: number[]) => {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    };
    for (const d of deptRings) for (const r of d.rings) r.forEach(grow);
    for (const n of network.nodes.features) grow(n.geometry.coordinates);
    const k = Math.cos((((y0 + y1) / 2) * Math.PI) / 180);
    const W = 1000;
    const scale = W / ((x1 - x0) * k);
    const H = (y1 - y0) * scale;
    const px = (x: number) => (x - x0) * k * scale;
    const py = (y: number) => (y1 - y) * scale;
    const pt = ([x, y]: number[]) => `${px(x).toFixed(1)},${py(y).toFixed(1)}`;

    const depts = deptRings.map((d) => ({ code: d.code, d: d.rings.map((r) => `M${r.map(pt).join("L")}Z`).join("") }));
    const links = network.links.features.map((f) => {
      const c = f.geometry.coordinates;
      const { mode, closed, id, origin_name, destination_name } = f.properties;
      let d: string;
      if (mode === "aereo" && c.length >= 2) {
        // Vuelo: un arco (curva cuadrática hacia el norte del tramo), como en el mapa 3D
        const [a, b] = [c[0], c[c.length - 1]];
        const [ax, ay, bx, by] = [px(a[0]), py(a[1]), px(b[0]), py(b[1])];
        const len = Math.hypot(bx - ax, by - ay);
        d = `M${ax.toFixed(1)},${ay.toFixed(1)}Q${((ax + bx) / 2).toFixed(1)},${(Math.min(ay, by) - len * 0.18).toFixed(1)} ${bx.toFixed(1)},${by.toFixed(1)}`;
      } else {
        d = `M${c.map(pt).join("L")}`;
      }
      return { id, mode, closed, d, label: `${MODES[mode].label}: ${origin_name} → ${destination_name}${closed ? " (cerrado)" : ""}` };
    });
    const nodes = network.nodes.features.map((f) => ({
      code: f.properties.code,
      x: px(f.geometry.coordinates[0]),
      y: py(f.geometry.coordinates[1]),
      mode: f.properties.modes[0],
      name: f.properties.name,
    }));
    return { W, H, depts, links, nodes, px, py };
  }, [network, departments]);

  const assets = fleet?.assets ?? [];
  // Los vuelos van encima: se dibujan al final
  const order = (m: string) => (m === "aereo" ? 1 : 0);
  const links = [...geo.links].sort((a, b) => order(a.mode) - order(b.mode));

  return (
    <svg
      viewBox={`-12 -12 ${geo.W + 24} ${geo.H + 24}`}
      preserveAspectRatio="xMidYMid meet"
      className={cn("preview-in block h-full w-full", className)}
      role="img"
      aria-label={`Red multimodal: ${network.nodes.features.length} nodos y ${network.links.features.length} enlaces; ${assets.length} activos en tránsito`}
    >
      <g>
        {geo.depts.map((d) => (
          <path key={d.code} d={d.d} fill="var(--fill)" stroke="var(--separator-strong)" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
        ))}
      </g>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {links.map((l) => (
          <path
            key={l.id}
            d={l.d}
            stroke={l.closed ? "var(--danger)" : MODES[l.mode].color}
            strokeWidth={l.mode === "aereo" ? 1 : 1.6}
            strokeOpacity={l.mode === "aereo" ? 0.55 : 0.9}
            strokeDasharray={l.closed ? "2 3" : l.mode === "ferreo" ? "5 3" : undefined}
            vectorEffect="non-scaling-stroke"
          >
            <title>{l.label}</title>
          </path>
        ))}
      </g>
      {/* Puntos de tamaño fijo en pantalla: un trazo de largo cero con extremo redondo y grosor que no escala */}
      <g strokeLinecap="round">
        {geo.nodes.map((n) => (
          <g key={n.code}>
            <path d={`M${n.x.toFixed(1)},${n.y.toFixed(1)}h0`} stroke="var(--card)" strokeWidth={7} vectorEffect="non-scaling-stroke" />
            <path d={`M${n.x.toFixed(1)},${n.y.toFixed(1)}h0`} stroke={MODES[n.mode]?.color ?? "var(--muted-foreground)"} strokeWidth={4.5} vectorEffect="non-scaling-stroke">
              <title>{n.name}</title>
            </path>
          </g>
        ))}
      </g>
      {/* Flota: un punto con halo por activo, en su posición del último sondeo */}
      <g strokeLinecap="round">
        {assets.map((a) => {
          const d = `M${geo.px(a.lon).toFixed(1)},${geo.py(a.lat).toFixed(1)}h0`;
          return (
            <g key={a.id}>
              <path d={d} stroke={MODES[a.mode].color} strokeOpacity={0.22} strokeWidth={16} vectorEffect="non-scaling-stroke" />
              <path d={d} stroke="var(--card)" strokeWidth={9} vectorEffect="non-scaling-stroke" />
              <path d={d} stroke={MODES[a.mode].color} strokeWidth={6.5} vectorEffect="non-scaling-stroke">
                <title>{`${a.id}: ${a.origin} → ${a.destination} (${Math.round(a.progress_pct)} %)`}</title>
              </path>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
