import { Bone, LoadingScreen, SkeletonPageHeader, SkeletonRows } from "@/components/skeletons";
import { cn } from "@/lib/utils";

/** Carga de la auditoría: encabezado, formulario de filtros y la lista de cambios. */
export default function Loading() {
  return (
    <LoadingScreen label="Cargando la auditoría" className="page">
      <SkeletonPageHeader actions={0} />
      <div className="flex flex-col gap-4">
        <div aria-hidden className="glass flex flex-wrap items-end gap-3 rounded-3xl p-4">
          <div className="flex min-w-40 flex-1 flex-col gap-1">
            <Bone className="h-3 w-28 rounded-full" />
            <Bone className="h-10 w-full rounded-lg" />
          </div>
          {["w-36", "w-36", "w-32", "w-32", "w-32"].map((width, i) => (
            <div key={i} className="flex flex-col gap-1">
              <Bone className="h-3 w-16 rounded-full" />
              <Bone className={cn("h-10 rounded-lg", width)} />
            </div>
          ))}
          <Bone className="h-10 w-24 rounded-md" />
          <Bone className="h-10 w-14 rounded-md" />
        </div>
        <div aria-hidden className="flex flex-wrap items-center justify-between gap-3">
          <Bone className="h-3 w-28 rounded-full" />
          <Bone className="h-8 w-32 rounded-md" />
        </div>
        <SkeletonRows rows={9} />
      </div>
    </LoadingScreen>
  );
}
