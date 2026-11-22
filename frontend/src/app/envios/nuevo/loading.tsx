import { LoadingScreen, SkeletonForm, SkeletonPageHeader } from "@/components/skeletons";

/** Carga del formulario de envío: encabezado, los campos de la carga y la vista previa de la ruta al costado. */
export default function Loading() {
  return (
    <LoadingScreen label="Cargando el formulario del nuevo envío" className="page page-narrow">
      <SkeletonPageHeader actions={0} />
      <SkeletonForm sections={[{ fields: 8 }]} chips={5} actions={3} aside />
    </LoadingScreen>
  );
}
