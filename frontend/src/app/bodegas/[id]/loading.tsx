import { LoadingScreen, SkeletonCard, SkeletonDetailHeader, SkeletonStatStrip } from "@/components/skeletons";

/** Carga de la ficha de la bodega: encabezado, cifras, inventario y movimientos, y el costado con lo que hace. */
export default function Loading() {
  return (
    <LoadingScreen label="Cargando la ficha de la bodega" className="page">
      <div aria-hidden className="flex flex-col gap-6">
        <SkeletonDetailHeader actions={3} />
        <SkeletonStatStrip cells={4} />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex min-w-0 flex-col gap-6">
            <SkeletonCard lines={7} />
            <SkeletonCard lines={4} />
          </div>
          <div className="flex flex-col gap-6">
            <SkeletonCard lines={4} />
            <SkeletonCard lines={3} />
            <SkeletonCard lines={3} />
          </div>
        </div>
      </div>
    </LoadingScreen>
  );
}
