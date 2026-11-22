import { LoadingScreen, SkeletonForm, SkeletonPageHeader } from "@/components/skeletons";

/** Carga del formulario de la bodega: identificación, capacidad con sus casillas y la operación. */
export default function Loading() {
  return (
    <LoadingScreen label="Cargando el formulario de la nueva bodega" className="page page-narrow">
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
