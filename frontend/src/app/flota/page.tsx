import { Suspense } from "react";
import { Plus } from "lucide-react";

import { DriversBoard } from "@/components/fleet/drivers-board";
import { FaultsBoard, type FaultsView } from "@/components/fleet/faults-board";
import { FleetBoard } from "@/components/fleet/fleet-board";
import { FleetTabs, type FleetTab } from "@/components/fleet/fleet-tabs";
import { type FleetFilters, isFleetOrder, isVehicleStatus } from "@/components/fleet/filters";
import { MaintenanceBoard } from "@/components/fleet/maintenance-board";
import { PageHeader, Skeleton } from "@/components/page-header";
import { BurstLink } from "@/components/ui/burst-link";
import { TableIO } from "@/components/ui/table-io";
import { apiGet } from "@/lib/api";
import { MODE_ORDER } from "@/lib/modes";
import type { Driver, Fault, FleetSummary, Maintenance, Mode, Vehicle } from "@/lib/types";
import { PageTransition } from "@/components/page-transition";

export const metadata = { title: "Flota" };

export default function FlotaPage({ searchParams }: PageProps<"/flota">) {
  return (
    <PageTransition>
      <div className="page">
        <PageHeader
          title="Flota de vehículos"
          description="Camiones, aviones de carga, convoyes, buques y trenes de la operación: su estado, cuánto falta para su mantenimiento, sus fallas y los envíos que llevan. Un vehículo con una falla que impide operar se inhabilita solo y sus envíos pasan a otro."
          actions={
            /*
             * Los tres botones suman unos 337 px y en celular no caben al lado del título. El encabezado pone las
             * acciones en su propia línea pero no las deja encoger, así que el grupo se limita al ancho útil de la
             * página: a 320 px los botones bajan a una segunda fila en vez de desbordar a lo ancho.
             */
            <div className="flex max-w-[calc(100dvw_-_2rem)] flex-wrap items-center gap-2">
              <TableIO kind="vehiculos" />
              <BurstLink href="/flota/nuevo"><Plus /> Nuevo vehículo</BurstLink>
            </div>
          }
        />
        <Suspense fallback={<Skeleton className="h-[640px]" />}>
          <Content searchParams={searchParams} />
        </Suspense>
      </div>
    </PageTransition>
  );
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Filtros de la URL (?estado=A,B&modo=terrestre&q=texto&alertas=1&orden=placa); se descartan los valores desconocidos. */
function parseFleetFilters(sp: Record<string, string | string[] | undefined>): FleetFilters {
  const list = (v: string | string[] | undefined) =>
    (first(v) ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  const orden = first(sp.orden) ?? "";
  return {
    q: first(sp.q) ?? "",
    statuses: list(sp.estado).filter(isVehicleStatus),
    modes: list(sp.modo).filter((m): m is Mode => (MODE_ORDER as string[]).includes(m)),
    alerts: first(sp.alertas) === "1",
    order: isFleetOrder(orden) ? orden : "defecto",
  };
}

async function Content({ searchParams }: { searchParams: PageProps<"/flota">["searchParams"] }) {
  const sp = await searchParams;
  const ver = sp.ver;
  const tab: FleetTab = ver === "mantenimiento" || ver === "fallas" || ver === "conductores" ? ver : "vehiculos";
  // Los filtros se leen de la URL en el servidor: la lista se pinta ya filtrada y el enlace se puede compartir
  const filters = parseFleetFilters(sp);
  const vista: FaultsView = first(sp.vista) === "todas" ? "todas" : "abiertas";
  const summary = await apiGet<FleetSummary>("/api/fleet/summary");
  const badges = {
    fallas: summary.open_faults.length,
    mantenimiento: summary.by_status["Mantenimiento vencido"],
  };
  return (
    <>
      <div><FleetTabs current={tab} badges={badges} /></div>
      <div className="mt-6">
        {tab === "vehiculos" && <Vehicles summary={summary} filters={filters} />}
        {tab === "mantenimiento" && <Maintenances summary={summary} />}
        {tab === "fallas" && <Faults vista={vista} />}
        {tab === "conductores" && <Drivers />}
      </div>
    </>
  );
}

async function Vehicles({ summary, filters }: { summary: FleetSummary; filters: FleetFilters }) {
  const v = await apiGet<{ items: Vehicle[] }>("/api/fleet/vehicles");
  return <FleetBoard vehicles={v.items} summary={summary} initial={filters} />;
}

async function Maintenances({ summary }: { summary: FleetSummary }) {
  const m = await apiGet<{ items: Maintenance[] }>("/api/fleet/maintenance?limit=300");
  return <MaintenanceBoard items={m.items} due={summary.maintenance_due} />;
}

async function Faults({ vista }: { vista: FaultsView }) {
  const f = await apiGet<{ items: Fault[] }>("/api/fleet/faults?limit=300");
  return <FaultsBoard key={vista} faults={f.items} view={vista} />;
}

async function Drivers() {
  const d = await apiGet<{ items: Driver[] }>("/api/fleet/drivers");
  return <DriversBoard drivers={d.items} />;
}
