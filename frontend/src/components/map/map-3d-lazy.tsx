"use client";

import dynamic from "next/dynamic";

/** deck.gl y MapLibre usan WebGL y `window`: el mapa solo se monta en el cliente. */
export const Map3DLazy = dynamic(() => import("@/components/Map3D"), {
  ssr: false,
  loading: () => <MapLoading />,
});

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
