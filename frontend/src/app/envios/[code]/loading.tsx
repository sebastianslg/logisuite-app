import { Skeleton } from "@/components/page-header";
import { Bone, LoadingScreen, SkeletonCard, SkeletonStatStrip } from "@/components/skeletons";

/** Carga de la ficha: volver, código y estado, cifras, cadena de modos, mapa y tarjetas del costado. */
export default function Loading() {
  return (
    <LoadingScreen label="Cargando la ficha del envío" className="page page-narrow">
      <div className="flex flex-col gap-6">
        <div aria-hidden>
          <Bone className="h-3 w-16 rounded-full" />
          <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Bone className="h-9 w-40 rounded-lg md:h-10 md:w-52" />
                <Bone className="h-6 w-24 rounded-full" />
                <Bone className="h-6 w-32 rounded-full" />
              </div>
              <Bone className="mt-3 h-4 w-52 rounded-full" />
              <Bone className="mt-2 h-3.5 w-40 rounded-full" />
            </div>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 4 }, (_, i) => (
                <Bone key={i} className="h-8 w-24 rounded-md" />
              ))}
            </div>
          </div>
        </div>

        <SkeletonStatStrip cells={4} />

        {/* Cadena de modos: tramos de distinto largo sobre una sola superficie */}
        <div aria-hidden className="glass rounded-3xl p-5">
          <div className="flex items-center justify-between gap-3">
            <Bone className="h-3.5 w-32 rounded-full" />
            <Bone className="h-3 w-20 rounded-full" />
          </div>
          <div className="mt-4 flex items-end gap-1.5">
            <Bone className="h-3 flex-[3] rounded-full" />
            <Bone className="h-3 flex-[2] rounded-full" />
            <Bone className="h-3 flex-[1.5] rounded-full" />
            <Bone className="h-3 flex-[2.5] rounded-full" />
          </div>
          <div className="mt-3 flex justify-between gap-4">
            <Bone className="h-3 w-16 rounded-full" />
            <Bone className="h-3 w-16 rounded-full" />
            <Bone className="h-3 w-16 rounded-full" />
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="flex min-w-0 flex-col gap-6">
            <Skeleton className="h-[400px]" />
            <SkeletonCard lines={5} />
            <SkeletonCard lines={4} />
          </div>
          <div className="flex flex-col gap-6">
            <SkeletonCard lines={2} />
            <SkeletonCard lines={3} />
            <SkeletonCard lines={2} />
            <SkeletonCard lines={3} />
          </div>
        </div>
      </div>
    </LoadingScreen>
  );
}
