"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";

import type { Map3DProps } from "@/components/Map3D";
import { NetworkPreview } from "@/components/map/network-preview";
import { onQuiet } from "@/lib/idle";

/**
 * El mapa se crea cuando su contenedor está en pantalla (o a 200 px), la página ya cargó, la pestaña está visible y
 * el navegador lleva un rato sin entradas: crear el contexto WebGL y compilar sombreadores es lo más caro de la app y
 * cae entero en una sola tarea, así que no puede empezar encima de un toque, de la paleta Ctrl K o de un diálogo
 * abierto. Mientras espera —y mientras baja el trozo de deck.gl/MapLibre— se ve la red dibujada en plano, que ya es el
 * marcador de posición. Una vez creado, se conserva.
 */
export function Map3DLazy(props: Map3DProps) {
  const [ready, setReady] = useState(false);
  // Se cambia al mapa solo cuando el trozo ya resolvió: así el marcador nunca es un spinner y el montaje no suspende.
  const [Map3D, setMap3D] = useState<ComponentType<Map3DProps> | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ready) return;
    const el = ref.current;
    if (!el) return;
    let cancelQuiet = () => {};
    const io = new IntersectionObserver(
      ([e]) => {
        cancelQuiet();
        if (e.isIntersecting) {
          cancelQuiet = onQuiet(() => setReady(true), {
            // La paleta de búsqueda y los menús son modales: nada de compilar WebGL debajo de lo que se escribe
            when: () => !document.querySelector('[aria-modal="true"]'),
          });
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelQuiet();
    };
  }, [ready]);

  useEffect(() => {
    if (!ready || Map3D) return;
    let alive = true;
    void import("@/components/Map3D").then(
      (m) => {
        if (alive) setMap3D(() => m.default);
      },
      () => {
        /* Si el trozo no llega, queda la red plana (y su aviso): no se inventa un reintento en cada render. */
      },
    );
    return () => {
      alive = false;
    };
  }, [ready, Map3D]);

  if (Map3D) return <Map3D {...props} />;
  // Mientras llega el mapa 3D se ve la red dibujada en plano (la silueta del país con sus rutas), no un bloque gris
  return (
    <div ref={ref} className="relative h-full min-h-80 w-full bg-fill/40">
      <div className="absolute inset-0 p-8 opacity-50">
        <NetworkPreview network={props.network} departments={props.departments} fleet={props.fleet} />
      </div>
      <span className="absolute inset-x-0 bottom-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <span className="size-2 animate-pulse rounded-full bg-primary motion-reduce:animate-none" aria-hidden />
        Cargando cartografía 3D
      </span>
    </div>
  );
}

export function MapLoading({ label = "Cargando cartografía 3D" }: { label?: string }) {
  return (
    <div className="flex h-full min-h-80 w-full items-center justify-center bg-fill/50">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="size-2 animate-pulse rounded-full bg-primary motion-reduce:animate-none" aria-hidden />
        {label}
      </div>
    </div>
  );
}
