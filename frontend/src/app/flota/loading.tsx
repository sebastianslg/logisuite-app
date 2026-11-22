import { LoadingScreen, SkeletonFilters, SkeletonPageHeader, SkeletonRows, SkeletonStatStrip, SkeletonTabs } from "@/components/skeletons";

/** Carga de la flota: encabezado, pestañas, franja de cifras, filtros y la lista de vehículos. */
export default function Loading() {
  return (
    <LoadingScreen label="Cargando la flota" className="page">
      <SkeletonPageHeader actions={2} />
      <SkeletonTabs count={4} />
      <div className="mt-6 flex flex-col gap-5">
        <SkeletonStatStrip cells={6} />
        <SkeletonFilters chips={5} actions={0} />
        <SkeletonRows rows={8} />
      </div>
    </LoadingScreen>
  );
}
