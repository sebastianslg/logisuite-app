import { Bone, LoadingScreen, SkeletonCard, SkeletonDetailHeader } from "@/components/skeletons";

/** Carga de la ficha del vehículo: encabezado, mantenimiento, documentos y fallas, y el costado con sus datos. */
export default function Loading() {
  return (
    <LoadingScreen label="Cargando la ficha del vehículo" className="page">
      <div aria-hidden className="flex flex-col gap-6">
        <SkeletonDetailHeader actions={4} />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex min-w-0 flex-col gap-6">
            {/* Próximo mantenimiento: medidor y la explicación de cuándo vence */}
            <SkeletonCard>
              <Bone className="h-2 w-full rounded-full" />
              <Bone className="h-3.5 w-full rounded-full" />
              <Bone className="h-3.5 w-2/3 rounded-full" />
            </SkeletonCard>
            <SkeletonCard lines={2} />
            <SkeletonCard lines={4} />
            <SkeletonCard lines={3} />
          </div>
          <div className="flex flex-col gap-6">
            <SkeletonCard lines={5} />
            <SkeletonCard lines={3} />
          </div>
        </div>
      </div>
    </LoadingScreen>
  );
}
