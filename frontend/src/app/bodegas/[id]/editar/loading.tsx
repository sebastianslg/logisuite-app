import { LoadingScreen, SkeletonForm, SkeletonPageHeader } from "@/components/skeletons";

/** Carga del formulario de edición de la bodega: mismo alto que el de alta para no saltar al llegar los datos. */
export default function Loading() {
  return (
    <LoadingScreen label="Cargando el formulario para editar la bodega" className="page page-narrow">
      <SkeletonPageHeader actions={0} />
      <SkeletonForm
        sections={[{ fields: 3 }, { fields: 3, columns: 3 }, { fields: 3 }]}
        checks={3}
        textarea
        actions={2}
      />
    </LoadingScreen>
  );
}
