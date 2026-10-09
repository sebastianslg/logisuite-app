"use client";

import dynamic from "next/dynamic";

/** deck.gl y MapLibre usan WebGL y `window`: el mapa solo se monta en el cliente. */
export const Map3DLazy = dynamic(() => import("@/components/Map3D"), {
  ssr: false,
  loading: () => <MapLoading />,
});

export function MapLoading({ label = "Cargando cartografía 3D" }: { label?: string }) {
  return (
    <div className="bg-grid flex h-full min-h-80 w-full items-center justify-center bg-[#030712]">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-neon-cyan/60" />
          <span className="relative inline-flex size-2 rounded-full bg-neon-cyan" />
        </span>
        {label}
      </div>
    </div>
  );
}
