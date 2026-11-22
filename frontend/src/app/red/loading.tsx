import { Bone, LoadingScreen } from "@/components/skeletons";

/**
 * Carga de la red: el mapa llena la ventana y solo se esbozan los paneles que flotan encima.
 * El lienzo va quieto (sin brillo): es el fondo del mapa, no una tarjeta.
 */
export default function Loading() {
  return (
    <LoadingScreen
      label="Cargando la red multimodal"
      className="relative h-[calc(100dvh-6rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-full overflow-hidden md:-mt-20 md:h-dvh"
    >
      <div aria-hidden className="absolute inset-0 bg-fill/40" />

      {/* Título y selector de vista, arriba a la izquierda */}
      <div aria-hidden className="absolute top-0 right-0 left-0 z-20 flex flex-wrap items-start gap-3 p-3 md:gap-4 md:p-6 md:pt-[6.5rem]">
        <Bone className="h-10 w-44 rounded-2xl" />
        <Bone className="h-10 w-36 rounded-full" />
      </div>

      {/* Simulador de rutas: mismo panel flotante del costado izquierdo */}
      <div
        aria-hidden
        className="glass-float absolute inset-x-3 bottom-3 z-10 flex flex-col gap-3 rounded-3xl p-4 md:inset-x-auto md:top-44 md:bottom-6 md:left-6 md:w-[400px] md:p-5"
      >
        <div className="flex items-center justify-between gap-3">
          <Bone className="h-4 w-40 rounded-full" />
          <div className="flex gap-1.5">
            <Bone className="size-8 rounded-md" />
            <Bone className="size-8 rounded-md" />
            <Bone className="size-8 rounded-md" />
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 3 }, (_, i) => (
            <Bone key={i} className="h-6 w-20 rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
          <div className="flex flex-col gap-2">
            <Bone className="h-11 w-full rounded-lg" />
            <Bone className="h-11 w-full rounded-lg" />
          </div>
          <Bone className="size-9 rounded-md" />
        </div>
        <Bone className="h-10 w-full rounded-md" />
      </div>

      {/* Controles del mapa y leyenda: en celular el panel los tapa, así que solo se esbozan en pantallas anchas */}
      <div aria-hidden className="absolute top-24 left-6 z-10 hidden md:block">
        <Bone className="h-11 w-40 rounded-2xl" />
      </div>
      <div aria-hidden className="absolute right-6 bottom-6 z-10 hidden w-72 md:block">
        <Bone className="h-14 w-full rounded-2xl" />
      </div>
    </LoadingScreen>
  );
}
