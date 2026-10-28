"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import dynamic from "next/dynamic";

import { NetworkPreview } from "@/components/map/network-preview";
import { onIdle } from "@/lib/idle";

/** deck.gl y MapLibre usan WebGL y `window`: el mapa solo se monta en el cliente. */
const Map3DDynamic = dynamic(() => import("@/components/Map3D"), {
  ssr: false,
  loading: () => <MapLoading />,
});

/**
 * El mapa se crea cuando su contenedor está en pantalla (o a 200 px) y el navegador quedó libre tras pintar
 * la página: crear el contexto WebGL y compilar sombreadores es lo más caro de la app. Así la navegación y
 * los primeros toques no esperan, y un mapa que no se ve (el del resumen en celular, bajo el pliegue) no
 * gasta nada hasta que se baja hasta él. Una vez creado, se conserva.
 */
export function Map3DLazy(props: ComponentProps<typeof Map3DDynamic>) {
  const [ready, setReady] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ready) return;
    const el = ref.current;
    if (!el) return;
    let cancelIdle = () => {};
    const io = new IntersectionObserver(
      ([e]) => {
        cancelIdle();
        if (e.isIntersecting) cancelIdle = onIdle(() => setReady(true), 600);
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelIdle();
    };
  }, [ready]);
  if (ready) return <Map3DDynamic {...props} />;
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
