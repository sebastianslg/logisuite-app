import { Suspense } from "react";
import type { Metadata } from "next";

import { DemoForm } from "@/components/landing/demo-form";
import { NetworkStory, type Closure, type ModeStat } from "@/components/landing/network-story";
import { RouteTry } from "@/components/landing/route-try";
import { DemoSection, Faq, Intro, LandingFooter, LandingHeader, Modules, Trust } from "@/components/landing/sections";
import { apiGet, apiPost } from "@/lib/api";
import type { DashboardSummary, DepartmentsGeo, FleetLive, Mode, NetworkGeo, SimulateResponse } from "@/lib/types";

export const metadata: Metadata = {
  title: { absolute: "Westvane · Gestión de transporte multimodal para Colombia" },
  description:
    "Sistema de gestión de transporte para operadores logísticos en Colombia: rutas por carretera, río, mar, aire y tren sobre la red real, flota, bodegas, cierres de vía, entregas firmadas, costos y huella de carbono.",
};

/**
 * Presentación comercial (pública, sin dock ni bienvenida de la app): la red real de Colombia como página. El titular y
 * las acciones salen sin esperar a la API; el mapa, la ruta en vivo y el formulario llegan cada uno en su Suspense.
 */
export default function LandingPage() {
  return (
    <div data-public-page>
      <LandingHeader />
      <div id="contenido">
        <Suspense fallback={<StoryFallback />}>
          <Story />
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <Route />
        </Suspense>
        <Modules />
        <Trust />
        <Faq />
        <DemoSection>
          <Suspense fallback={<div className="skeleton h-[560px] rounded-3xl" />}>
            <Demo />
          </Suspense>
        </DemoSection>
      </div>
      <LandingFooter />
    </div>
  );
}

interface CorridorsResponse {
  items: { corridor: string; active: boolean; reason: string | null; distance_fmt: string; modes: Mode[] }[];
}

async function Story() {
  const [network, departments, summary, corridors, fleet] = await Promise.all([
    apiGet<NetworkGeo>("/api/network/multimodal"),
    apiGet<DepartmentsGeo>("/api/geo/departments"),
    apiGet<DashboardSummary>("/api/dashboard/summary"),
    apiGet<CorridorsResponse>("/api/corridors"),
    apiGet<FleetLive>("/api/fleet/live").catch(() => null),
  ]);
  const modes: ModeStat[] = summary.network.modes.map((m) => ({ mode: m.mode, links: m.links, km_fmt: m.km_fmt }));
  const closures: Closure[] = corridors.items
    .filter((c) => !c.active)
    .map((c) => ({ corridor: c.corridor, reason: c.reason, distance_fmt: c.distance_fmt, modes: c.modes }));
  return (
    <NetworkStory
      intro={<Intro nodes={summary.network.nodes} links={summary.network.links} />}
      network={network}
      departments={departments}
      fleet={fleet}
      modes={modes}
      closures={closures}
    />
  );
}

function StoryFallback() {
  return (
    <section className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" aria-busy>
      <div className="px-4 pt-10 pb-8 sm:px-8 lg:flex lg:min-h-[calc(100dvh-4rem)] lg:flex-col lg:justify-center lg:py-16 lg:pr-4 lg:pl-14 xl:pl-20">
        <Intro />
      </div>
      <div className="h-[42svh] border-y border-border p-6 lg:h-[calc(100dvh-4rem)] lg:border-y-0 lg:border-l lg:p-10">
        <div className="skeleton h-full w-full rounded-3xl" />
      </div>
    </section>
  );
}

const ROUTE_DEFAULT = { origen: "Bogotá", destino: "Leticia", peso: 10, prioridad: "costo" as const };

async function Route() {
  const [locations, sim] = await Promise.all([
    apiGet<{ cities: { city: string }[] }>("/api/locations"),
    apiPost<SimulateResponse>("/api/routes/simulate", {
      origen: ROUTE_DEFAULT.origen,
      destino: ROUTE_DEFAULT.destino,
      peso_t: ROUTE_DEFAULT.peso,
      prioridad: ROUTE_DEFAULT.prioridad,
    }),
  ]);
  const cities = locations.cities.map((c) => c.city).sort((a, b) => a.localeCompare(b, "es"));
  return <RouteTry cities={cities} initial={sim.ok ? sim.data : null} initialQuery={ROUTE_DEFAULT} />;
}

function SectionFallback() {
  return (
    <div className="border-t border-border bg-card">
      <div className="mx-auto max-w-[1280px] px-4 py-20 sm:px-8 lg:py-28">
        <div className="skeleton h-[520px] rounded-3xl" />
      </div>
    </div>
  );
}

async function Demo() {
  const form = await apiGet<{ consent_text: string; fleet_sizes: string[] }>("/api/demo-requests/form");
  return <DemoForm consentText={form.consent_text} fleetSizes={form.fleet_sizes} />;
}
