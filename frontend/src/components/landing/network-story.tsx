"use client";

import { useEffect, useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";

import { NetworkPreview } from "@/components/map/network-preview";
import { MODES } from "@/lib/modes";
import type { DepartmentsGeo, FleetLive, Mode, NetworkGeo } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface ModeStat {
  mode: Mode;
  links: number;
  km_fmt: string;
}

export interface Closure {
  corridor: string;
  reason: string | null;
  distance_fmt: string;
  modes: Mode[];
}

/** Orden de lectura de los capítulos: de lo que más mueve a lo que menos, y el tren al final con sus cierres. */
const STORY: Mode[] = ["terrestre", "fluvial", "maritimo", "aereo", "ferreo"];

const CHAPTERS: Record<Mode, { title: string; body: string; facts: string[] }> = {
  terrestre: {
    title: "Carretera, con peajes, flota propia y terceros.",
    body: "Cada tramo lleva su distancia, sus peajes y el vehículo que lo cubre. Si un camión tiene el SOAT o la revisión técnico-mecánica vencidos, sale de la asignación y sus envíos pasan a otro vehículo.",
    facts: ["Vehículo por tramo, propio o tercerizado", "Vencimientos de SOAT, revisión y licencias", "Mantenimientos y órdenes de trabajo en PDF"],
  },
  fluvial: {
    title: "El río como parte de la ruta, no como excepción.",
    body: "El Magdalena, el Meta, el Orinoco, el Atrato y el Amazonas-Putumayo entran en la misma cadena que el camión, con el transbordo en puerto y el tiempo real de cada tramo.",
    facts: ["Puertos de Barrancabermeja, La Dorada, Leticia y Puerto Asís", "Canal del Dique hasta Cartagena", "Barcazas y convoyes con su capacidad"],
  },
  maritimo: {
    title: "Cabotaje entre el Caribe, el Pacífico y San Andrés.",
    body: "Cartagena, Barranquilla, Santa Marta, Buenaventura, Tumaco y Turbo conectados por mar, incluido el paso entre océanos por el Canal de Panamá, con el costo y la huella de cada trayecto.",
    facts: ["Ocho puertos marítimos", "Ruta Cartagena - San Andrés", "Huella de carbono por tramo"],
  },
  aereo: {
    title: "Carga aérea a donde no llega la carretera.",
    body: "Veintiún aeropuertos y rutas desde Bogotá hasta Mitú, Inírida, Puerto Carreño o San Andrés. La ruta elige el avión solo cuando el tiempo lo justifica, y usted ve cuánto cuesta esa prisa.",
    facts: ["Rutas con conexión terrestre al aeropuerto", "Comparación por tiempo, costo o huella", "Seguimiento del envío para su cliente"],
  },
  ferreo: {
    title: "Tren, con el estado real de cada corredor.",
    body: "Fenoco, el Cerrejón y el Ferrocarril Central forman parte de la red. Los corredores sin operación regular de carga figuran cerrados, con la razón, y ninguna ruta los usa.",
    facts: ["Cinco corredores férreos", "Cierres con fuente y fecha", "Transbordo a camión o a barcaza"],
  },
};

/**
 * Presentación: la red real de Colombia queda fija mientras se baja, y cada capítulo enciende su modo. La franja de
 * modos hace lo mismo a mano. Nada corre por cuadro: el mapa solo cambia de opacidad cuando cambia el capítulo.
 */
export function NetworkStory({
  intro,
  network,
  departments,
  fleet,
  modes,
  closures,
}: {
  intro: React.ReactNode;
  network: NetworkGeo;
  departments: DepartmentsGeo;
  fleet: FleetLive | null;
  modes: ModeStat[];
  closures: Closure[];
}) {
  const [focus, setFocus] = useState<Mode | null>(null);
  const root = useRef<HTMLElement>(null);
  const byMode = new Map(modes.map((m) => [m.mode, m]));

  useEffect(() => {
    // El capítulo que cruza la franja central de lo que se lee es el que manda; la introducción y el cierre no resaltan nada.
    // En el celular el mapa ocupa la parte de arriba: la franja baja al centro del espacio que queda debajo de él.
    const wide = window.matchMedia("(min-width: 1024px)").matches;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const key = (e.target as HTMLElement).dataset.chapter;
          setFocus(key && key in MODES ? (key as Mode) : null);
        }
      },
      { rootMargin: wide ? "-45% 0px -45% 0px" : "-68% 0px -27% 0px" },
    );
    root.current?.querySelectorAll<HTMLElement>("[data-chapter]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const goTo = (mode: Mode) => {
    setFocus(mode);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wide = window.matchMedia("(min-width: 1024px)").matches;
    document.getElementById(`modo-${mode}`)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: wide ? "center" : "start" });
  };

  const inTransit = fleet?.assets.length ?? 0;

  return (
    <section ref={root} id="red" aria-label="La red multimodal de Colombia" className="relative grid scroll-mt-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div data-chapter="intro" className="px-4 pt-10 pb-8 sm:px-8 lg:flex lg:min-h-[calc(100dvh-4rem)] lg:flex-col lg:justify-center lg:py-16 lg:pr-4 lg:pl-14 xl:pl-20">
        {intro}
      </div>

      {/* El mapa: fijo a la derecha en escritorio; en el celular queda arriba, fijo bajo la barra, mientras pasan los capítulos */}
      <div className="sticky top-16 z-10 h-[42svh] border-y border-border bg-background lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:h-[calc(100dvh-4rem)] lg:self-start lg:border-y-0 lg:border-l">
        <div className="relative flex h-full flex-col">
          <div className="relative min-h-0 flex-1 px-3 pt-3 lg:px-8 lg:pt-8">
            <NetworkPreview network={network} departments={departments} fleet={fleet} focus={focus} />
            <div className="pointer-events-none absolute top-3 right-3 hidden max-w-64 rounded-2xl border border-border bg-card px-4 py-3 text-sm lg:top-8 lg:right-8 lg:block">
              <p className="flex items-center gap-2 font-medium">
                <span className="size-2 rounded-full bg-success" aria-hidden />
                Red en vivo
              </p>
              <p className="tabular mt-1 text-muted-foreground">
                {network.nodes.features.length} nodos · {network.links.features.length} enlaces
                {inTransit > 0 && ` · ${inTransit} vehículos en tránsito`}
              </p>
              {closures.length > 0 && (
                <p className="mt-2 flex items-start gap-1.5 text-destructive">
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  {closures.length === 1 ? "1 tramo cerrado" : `${closures.length} tramos cerrados`} hoy
                </p>
              )}
            </div>
          </div>
          <div role="group" aria-label="Resaltar un modo en el mapa" className="grid grid-cols-5 border-t border-border bg-card">
            {STORY.map((m) => {
              const { label, icon: Icon, color } = MODES[m];
              const on = focus === m;
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={on}
                  onClick={() => goTo(m)}
                  className={cn(
                    "group relative flex min-h-14 flex-col items-start justify-center gap-0.5 border-l border-border px-2 py-2 text-left outline-none transition-colors first:border-l-0 focus-visible:ring-[3px] focus-visible:ring-ring/60 focus-visible:ring-inset sm:px-4 lg:py-3",
                    on ? "bg-raised" : "hover:bg-fill",
                  )}
                >
                  <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground sm:text-[0.8125rem]">
                    <Icon className="size-3.5 shrink-0" style={{ color }} aria-hidden />
                    <span className="truncate">{label}</span>
                  </span>
                  <span className="tabular hidden text-lg font-semibold tracking-tight sm:block lg:text-xl">{byMode.get(m)?.km_fmt ?? "—"}</span>
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-x-0 bottom-0 h-0.5 origin-left transition-transform duration-300 ease-[var(--ease-apple)] motion-reduce:transition-none",
                      on ? "scale-x-100" : "scale-x-0",
                    )}
                    style={{ backgroundColor: color }}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="px-4 pb-16 sm:px-8 lg:pr-4 lg:pl-14 xl:pl-20">
        {STORY.map((m) => {
          const { label, icon: Icon, color } = MODES[m];
          const c = CHAPTERS[m];
          const stat = byMode.get(m);
          return (
            <article
              key={m}
              id={`modo-${m}`}
              data-chapter={m}
              aria-labelledby={`modo-${m}-titulo`}
              className="flex min-h-[70svh] scroll-mt-[calc(42svh+4rem)] flex-col justify-center border-t border-border py-14 first:border-t-0 lg:min-h-[80dvh] lg:scroll-mt-16"
            >
              <h2 id={`modo-${m}-titulo`} className="max-w-[18ch] text-[2rem] leading-[1.05] font-semibold tracking-[-0.035em] sm:text-[2.5rem]">
                {c.title}
              </h2>
              <p className="mt-4 max-w-[52ch] text-[1.0625rem] leading-relaxed text-muted-foreground">{c.body}</p>
              <ul className="mt-6 max-w-[52ch] rule-list border-y border-border text-[0.9375rem]">
                <li className="flex items-center gap-3 py-2.5 font-medium">
                  <Icon className="size-4 shrink-0" style={{ color }} aria-hidden />
                  {label}
                  {stat && <span className="tabular font-normal text-muted-foreground">{stat.km_fmt} en {stat.links} enlaces de la red</span>}
                </li>
                {c.facts.map((f) => (
                  <li key={f} className="flex items-center gap-3 py-2.5">
                    <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
            </article>
          );
        })}

        <article
          id="cierres"
          data-chapter="cierres"
          aria-labelledby="cierres-titulo"
          className="flex min-h-[70svh] flex-col justify-center border-t border-border py-14 lg:min-h-[80dvh]"
        >
          <h2 id="cierres-titulo" className="max-w-[18ch] text-[2rem] leading-[1.05] font-semibold tracking-[-0.035em] sm:text-[2.5rem]">
            Cuando una vía se cierra, sus envíos ya tienen otra ruta.
          </h2>
          <p className="mt-4 max-w-[52ch] text-[1.0625rem] leading-relaxed text-muted-foreground">
            Cierre una vía, un puerto o un aeropuerto por un derrumbe, un paro o el clima, y Westvane recalcula los envíos que pasaban por
            ahí: muestra cuáles se redirigieron, cuánto cambió su llegada y cuáles quedaron sin ruta para decidir a mano.
          </p>
          {closures.length > 0 && (
            <div className="mt-6 max-w-[52ch]">
              <p className="text-[0.8125rem] font-medium text-muted-foreground">Cerrados hoy en la red</p>
              <ul className="mt-2 rule-list border-y border-border text-[0.9375rem]">
                {closures.map((c) => (
                  <li key={c.corridor} className="py-2.5">
                    <span className="flex items-center gap-2 font-medium">
                      <TriangleAlert className="size-4 shrink-0 text-destructive" aria-hidden />
                      {c.corridor}
                      <span className="tabular font-normal text-muted-foreground">· {c.distance_fmt}</span>
                    </span>
                    {c.reason && <span className="mt-0.5 block pl-6 text-sm text-muted-foreground">{c.reason}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
