import { LoadingScreen, SkeletonForm, SkeletonPageHeader } from "@/components/skeletons";

/** Carga del formulario de edición: encabezado, la carga ya guardada y la vista previa de la ruta al costado. */
export default function Loading() {
  return (
    <LoadingScreen label="Cargando el formulario para editar el envío" className="page page-narrow">
      <SkeletonPageHeader actions={0} />
      <SkeletonForm sections={[{ fields: 8 }]} chips={5} actions={3} aside />
    </LoadingScreen>
  );
}
