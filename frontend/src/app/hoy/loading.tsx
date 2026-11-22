import { LoadingScreen, SkeletonPageHeader, SkeletonRows, SkeletonStatStrip } from "@/components/skeletons";

/** Carga de «Hoy»: encabezado, franja de cifras y las cuatro columnas de la hoja del día. */
export default function Loading() {
  return (
    <LoadingScreen label="Cargando la hoja del día" className="page">
      <SkeletonPageHeader actions={1} />
      <SkeletonStatStrip cells={4} className="mb-8" />
      <div className="grid gap-6 lg:grid-cols-2">
        <SkeletonRows rows={4} header />
        <SkeletonRows rows={4} header />
        <SkeletonRows rows={4} header />
        <SkeletonRows rows={4} header />
      </div>
    </LoadingScreen>
  );
}
