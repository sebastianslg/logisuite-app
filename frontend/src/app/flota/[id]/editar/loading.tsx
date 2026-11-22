import { LoadingScreen, SkeletonForm, SkeletonPageHeader } from "@/components/skeletons";

/** Carga del formulario de edición del vehículo: mismo alto que el de alta para no saltar al llegar los datos. */
export default function Loading() {
  return (
    <LoadingScreen label="Cargando el formulario para editar el vehículo" className="page page-narrow">
      <SkeletonPageHeader actions={0} />
      <SkeletonForm
        sections={[{ fields: 6 }, { fields: 4 }, { fields: 4 }, { fields: 2 }]}
        textarea
        actions={2}
      />
    </LoadingScreen>
  );
}
