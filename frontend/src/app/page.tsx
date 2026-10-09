import { Suspense } from "react";
import {
  Activity,
  ArrowRightLeft,
  BarChart3,
  Gauge,
  Navigation,
  Network,
  PieChart,
  Radio,
  Route,
  Weight,
} from "lucide-react";

import { BentoCell, BentoGrid, KpiCard } from "@/components/dashboard/bento";
import { DispatchTrend, ModalSplit, TopCorridors } from "@/components/dashboard/charts";
import { LiveFleet } from "@/components/dashboard/live-fleet";
import { NetworkMapCard } from "@/components/dashboard/network-map-card";
import { StatusBreakdown } from "@/components/dashboard/status-breakdown";
import { PageHeader, Skeleton } from "@/components/page-header";
import { apiGet } from "@/lib/api";
import type { DashboardSummary, FleetLive } from "@/lib/types";

export default function DashboardPage() {
  return (
    <div className="bg-grid min-h-screen px-6 py-8 lg:px-10">
      <PageHeader
        eyebrow="Torre de control"
        title="Operación multimodal"
        description="Carretera, río, mar, aire y ferrocarril en una sola vista: fletes en tránsito, transbordos y reparto modal de la red logística de Colombia."
      />
      <div className="mt-8">
        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardContent />
        </Suspense>
      </div>
    </div>
  );
}

async function DashboardContent() {
  const [summary, fleet] = await Promise.all([
    apiGet<DashboardSummary>("/api/dashboard/summary"),
    apiGet<FleetLive>("/api/fleet/live"),
  ]);
  const k = summary.kpis;

  return (
    <BentoGrid>
      <KpiCard
        className="md:col-span-3 xl:col-span-3"
        label="Envíos en tránsito"
        value={k.active.fmt}
        icon={<Navigation />}
        accent="#10b981"
        footnote={`${k.delayed.fmt} retrasados · ${k.scheduled.fmt} programados`}
      />
      <KpiCard
        className="md:col-span-3 xl:col-span-3"
        label="Transferencia modal"
        value={k.in_transfer.fmt}
        icon={<ArrowRightLeft />}
        accent="#f59e0b"
        footnote="Cargas en transbordo entre modos"
      />
      <KpiCard
        className="md:col-span-3 xl:col-span-3"
        label="Carga en tránsito"
        value={k.tons_in_transit.fmt}
        icon={<Weight />}
        accent="#22d3ee"
        footnote={`Flete comprometido ${k.cost_in_transit.fmt}`}
      />
      <KpiCard
        className="md:col-span-3 xl:col-span-3"
        label="OTIF (30 días)"
        value={k.otif.fmt}
        icon={<Gauge />}
        accent="#a78bfa"
        footnote={`${k.delivered.fmt} entregas cerradas`}
      />

      <BentoCell
        className="min-h-[560px] md:col-span-6 xl:col-span-8 xl:row-span-2"
        title="Red multimodal"
        description={`${summary.network.nodes} nodos · ${summary.network.links} enlaces`}
        icon={<Network />}
      >
        <NetworkMapCard network={summary.network} />
      </BentoCell>

      <BentoCell
        className="md:col-span-6 xl:col-span-4 xl:row-span-2"
        title="Flota en vivo"
        description="Activos en tránsito por modo"
        icon={<Radio />}
      >
        <LiveFleet initial={fleet} />
      </BentoCell>

      <BentoCell
        className="md:col-span-3 xl:col-span-3"
        title="Reparto modal"
        description="Toneladas-kilómetro movidas por modo"
        icon={<PieChart />}
      >
        <ModalSplit data={summary.modal_split} />
      </BentoCell>

      <BentoCell
        className="md:col-span-3 xl:col-span-3"
        title="Corredores más cargados"
        description="Toneladas en los últimos despachos"
        icon={<Route />}
      >
        <TopCorridors data={summary.top_corridors} />
      </BentoCell>

      <BentoCell
        className="md:col-span-3 xl:col-span-3"
        title="Despachos"
        icon={<BarChart3 />}
      >
        <DispatchTrend data={summary.dispatches_14d} />
      </BentoCell>

      <BentoCell
        className="md:col-span-3 xl:col-span-3"
        title="Por estado"
        icon={<Activity />}
      >
        <StatusBreakdown counts={summary.status_counts} />
      </BentoCell>
    </BentoGrid>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-6 xl:grid-cols-12">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-36 md:col-span-3" />
      ))}
      <Skeleton className="h-96 md:col-span-6 xl:col-span-8" />
      <Skeleton className="h-96 md:col-span-6 xl:col-span-4" />
    </div>
  );
}
