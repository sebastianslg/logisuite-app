import { Suspense } from "react";
import { Plus } from "lucide-react";

import { DriversBoard } from "@/components/fleet/drivers-board";
import { FaultsBoard } from "@/components/fleet/faults-board";
import { FleetBoard } from "@/components/fleet/fleet-board";
import { FleetTabs, type FleetTab } from "@/components/fleet/fleet-tabs";
import { MaintenanceBoard } from "@/components/fleet/maintenance-board";
import { PageHeader, Skeleton } from "@/components/page-header";
import { BurstLink } from "@/components/ui/burst-link";
import { apiGet } from "@/lib/api";
import type { Driver, Fault, FleetSummary, Maintenance, Vehicle } from "@/lib/types";

export const metadata = { title: "Flota" };

export default function FlotaPage({ searchParams }: PageProps<"/flota">) {
  return (
    <div className="px-6 py-8 lg:px-10">
      <PageHeader
        title="Flota de vehículos"
        description="Camiones, aviones de carga, convoyes, buques y trenes de la operación: su estado, cuánto falta para su mantenimiento, sus fallas y los envíos que llevan. Un vehículo con una falla que impide operar se inhabilita solo y sus envíos pasan a otro."
        actions={
          <BurstLink href="/flota/nuevo"><Plus /> Nuevo vehículo</BurstLink>
        }
      />
      <Suspense fallback={<Skeleton className="mt-8 h-[640px]" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/flota">["searchParams"] }) {
  const ver = (await searchParams).ver;
  const tab: FleetTab = ver === "mantenimiento" || ver === "fallas" || ver === "conductores" ? ver : "vehiculos";
  const summary = await apiGet<FleetSummary>("/api/fleet/summary");
  const badges = {
    fallas: summary.open_faults.length,
    mantenimiento: summary.by_status["Mantenimiento vencido"],
  };
  return (
    <>
      <div className="mt-6"><FleetTabs current={tab} badges={badges} /></div>
      <div className="mt-6">
        {tab === "vehiculos" && <Vehicles summary={summary} />}
        {tab === "mantenimiento" && <Maintenances summary={summary} />}
        {tab === "fallas" && <Faults />}
        {tab === "conductores" && <Drivers />}
      </div>
    </>
  );
}

async function Vehicles({ summary }: { summary: FleetSummary }) {
  const v = await apiGet<{ items: Vehicle[] }>("/api/fleet/vehicles");
  return <FleetBoard vehicles={v.items} summary={summary} />;
}

async function Maintenances({ summary }: { summary: FleetSummary }) {
  const m = await apiGet<{ items: Maintenance[] }>("/api/fleet/maintenance?limit=300");
  return <MaintenanceBoard items={m.items} due={summary.maintenance_due} />;
}

async function Faults() {
  const f = await apiGet<{ items: Fault[] }>("/api/fleet/faults?limit=300");
  return <FaultsBoard faults={f.items} />;
}

async function Drivers() {
  const d = await apiGet<{ items: Driver[] }>("/api/fleet/drivers");
  return <DriversBoard drivers={d.items} />;
}
