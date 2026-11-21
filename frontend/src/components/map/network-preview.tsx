"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { MODES } from "@/lib/modes";
import type { DepartmentsGeo, FleetLive, Mode, NetworkGeo } from "@/lib/types";
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
  focus = null,
  closureLabels = false,
  className,
}: {
  network: NetworkGeo;
  departments: DepartmentsGeo;
  fleet?: FleetLive | null;
  /** Modo resaltado: sus enlaces y nodos quedan plenos y el resto se atenúa (solo opacidad). Lo usa la presentación. */
  focus?: Mode | null;
  /** Rotula cada corredor cerrado en su punto medio (solo en pantallas anchas, donde el texto se lee). */
  closureLabels?: boolean;
  className?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  // Escala real del dibujo (px por unidad del viewBox), para que los rótulos se lean a 13 px a cualquier tamaño del mapa.
  // Se mide solo al cambiar de tamaño: nada corre por cuadro.
  const [scale, setScale] = useState(1);
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
    // Los arcos aéreos suben por encima de sus extremos: el encuadre tiene que incluir su cima o salen recortados arriba
    const links = network.links.features.map((f) => {
      const c = f.geometry.coordinates;
      const { mode, closed, id, origin_name, destination_name, corridor } = f.properties;
      let d: string;
      let apex = 0;
      if (mode === "aereo" && c.length >= 2) {
        // Vuelo: un arco (curva cuadrática hacia el norte del tramo), como en el mapa 3D
        const [a, b] = [c[0], c[c.length - 1]];
        const [ax, ay, bx, by] = [px(a[0]), py(a[1]), px(b[0]), py(b[1])];
        const len = Math.hypot(bx - ax, by - ay);
        const cy = Math.min(ay, by) - len * 0.18;
        // Punto más alto de la curva: y(t) = (1-t)²·ay + 2t(1-t)·cy + t²·by tiene su mínimo en t = (ay-cy)/(ay-2cy+by)
        const den = ay - 2 * cy + by;
        const t = den !== 0 ? Math.min(1, Math.max(0, (ay - cy) / den)) : 0.5;
        apex = (1 - t) ** 2 * ay + 2 * t * (1 - t) * cy + t ** 2 * by;
        d = `M${ax.toFixed(1)},${ay.toFixed(1)}Q${((ax + bx) / 2).toFixed(1)},${cy.toFixed(1)} ${bx.toFixed(1)},${by.toFixed(1)}`;
      } else {
        d = `M${c.map(pt).join("L")}`;
      }
      const mid = c[Math.floor(c.length / 2)];
      return {
        id, mode, closed, d, corridor, apex, mx: px(mid[0]), my: py(mid[1]),
        label: `${MODES[mode].label}: ${origin_name} → ${destination_name}${closed ? " (cerrado)" : ""}`,
      };
    });
    // Un rótulo por corredor cerrado, en el tramo del medio
    const closedBy = new Map<string, typeof links>();
    for (const l of links) if (l.closed) closedBy.set(l.corridor, [...(closedBy.get(l.corridor) ?? []), l]);
    const closures = [...closedBy.entries()].map(([name, ls]) => {
      const l = ls[Math.floor(ls.length / 2)];
      return { name, x: l.mx, y: l.my };
    });
    const nodes = network.nodes.features.map((f) => ({
      code: f.properties.code,
      x: px(f.geometry.coordinates[0]),
      y: py(f.geometry.coordinates[1]),
      mode: f.properties.modes[0],
      modes: f.properties.modes,
      name: f.properties.name,
    }));
    const top = Math.min(0, ...links.map((l) => l.apex));
    return { W, H, depts, links, nodes, closures, top, px, py };
  }, [network, departments]);

  const vbTop = geo.top - 12;
  const vbW = geo.W + 24;
  const vbH = geo.H + 24 - geo.top;
  useEffect(() => {
    const el = svgRef.current;
    if (!closureLabels || !el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width && height) setScale(Math.min(width / vbW, height / vbH)); // preserveAspectRatio «meet»
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [closureLabels, vbW, vbH]);
  const px = (n: number) => n / scale;

  const assets = fleet?.assets ?? [];
  // Los vuelos van encima: se dibujan al final
  const order = (m: string) => (m === "aereo" ? 1 : 0);
  const links = [...geo.links].sort((a, b) => order(a.mode) - order(b.mode));
  // Con un modo resaltado, lo demás baja a un 12 %: se sigue leyendo la red, pero el ojo va al modo
  const dim = (on: boolean) => ({ opacity: focus && !on ? 0.12 : 1 });
  const fade = "transition-opacity duration-500 ease-[var(--ease-apple)] motion-reduce:transition-none";

  return (
    <svg
      ref={svgRef}
      viewBox={`-12 ${vbTop.toFixed(1)} ${vbW} ${vbH.toFixed(1)}`}
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
            className={fade}
            style={dim(l.mode === focus)}
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
          <g key={n.code} className={fade} style={dim(!!focus && n.modes.includes(focus))}>
            <path d={`M${n.x.toFixed(1)},${n.y.toFixed(1)}h0`} stroke="var(--card)" strokeWidth={7} vectorEffect="non-scaling-stroke" />
            <path d={`M${n.x.toFixed(1)},${n.y.toFixed(1)}h0`} stroke={MODES[n.mode]?.color ?? "var(--muted-foreground)"} strokeWidth={4.5} vectorEffect="non-scaling-stroke">
              <title>{n.name}</title>
            </path>
          </g>
        ))}
      </g>
      {closureLabels && geo.closures.length > 0 && (
        <g className="max-lg:hidden" pointerEvents="none" aria-hidden>
          {geo.closures.map((c) => (
            <g key={c.name}>
              <path d={`M${c.x.toFixed(1)},${c.y.toFixed(1)}h0`} stroke="var(--card)" strokeWidth={12} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              <path d={`M${c.x.toFixed(1)},${c.y.toFixed(1)}h0`} stroke="var(--danger)" strokeWidth={8} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              <text
                x={c.x + px(9)}
                y={c.y + px(4.5)}
                fontSize={px(13)}
                fontWeight={600}
                fill="var(--danger)"
                stroke="var(--background)"
                strokeWidth={px(5)}
                paintOrder="stroke"
                strokeLinejoin="round"
              >
                {c.name} · cerrado
              </text>
            </g>
          ))}
        </g>
      )}
      {/* Flota: un punto con halo por activo, en su posición del último sondeo */}
      <g strokeLinecap="round">
        {assets.map((a) => {
          const d = `M${geo.px(a.lon).toFixed(1)},${geo.py(a.lat).toFixed(1)}h0`;
          return (
            <g key={`${a.id}-${a.shipment_code}`} className={fade} style={dim(a.mode === focus)}>
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
