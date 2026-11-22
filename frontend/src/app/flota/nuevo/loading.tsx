import { LoadingScreen, SkeletonForm, SkeletonPageHeader } from "@/components/skeletons";

/** Carga del formulario del vehículo: identificación, capacidad, mantenimiento, documentos y notas. */
export default function Loading() {
  return (
    <LoadingScreen label="Cargando el formulario del nuevo vehículo" className="page page-narrow">
      <SkeletonPageHeader actions={0} />
      <SkeletonForm
        sections={[{ fields: 6 }, { fields: 4 }, { fields: 4 }, { fields: 2 }]}
        textarea
        actions={2}
      />
    </LoadingScreen>
  );
}
