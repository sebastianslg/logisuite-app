import { Bone, LoadingScreen, SkeletonCard, SkeletonFilters, SkeletonPageHeader, SkeletonRows, SkeletonStatStrip, SkeletonTabs } from "@/components/skeletons";

/** Carga de bodegas: encabezado, pestañas, franja de cifras, la red a la izquierda y el mapa de flujo al costado. */
export default function Loading() {
  return (
    <LoadingScreen label="Cargando las bodegas" className="page">
      <SkeletonPageHeader actions={2} />
      <SkeletonTabs count={2} />
      <div className="mt-6 flex flex-col gap-5">
        <SkeletonStatStrip cells={5} />
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          <div className="flex min-w-0 flex-col gap-4">
            <SkeletonFilters chips={1} actions={0} />
            <div aria-hidden className="flex flex-wrap gap-1.5">
              {Array.from({ length: 7 }, (_, i) => (
                <Bone key={i} className="h-8 w-24 rounded-full" />
              ))}
            </div>
            <SkeletonRows rows={5} />
          </div>
          <SkeletonCard className="h-fit">
            <Bone className="h-3.5 w-full rounded-full" />
            <Bone className="h-3.5 w-4/5 rounded-full" />
            <Bone className="mt-1 h-[300px] w-full rounded-2xl" />
          </SkeletonCard>
        </div>
      </div>
    </LoadingScreen>
  );
}
