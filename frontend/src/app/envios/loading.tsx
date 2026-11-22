import { LoadingScreen, SkeletonFilters, SkeletonPageHeader, SkeletonTable } from "@/components/skeletons";

/** Carga de la lista: encabezado, filtros en una fila y la tabla dentro de su superficie. */
export default function Loading() {
  return (
    <LoadingScreen label="Cargando los envíos" className="page">
      <SkeletonPageHeader actions={1} />
      <div className="flex flex-col gap-4">
        <SkeletonFilters chips={9} actions={2} />
        <SkeletonTable rows={10} />
      </div>
    </LoadingScreen>
  );
}
