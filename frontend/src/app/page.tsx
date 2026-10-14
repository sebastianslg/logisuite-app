import { Suspense } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  ArrowRightLeft,
  Gauge,
  Navigation,
  Network,
  Radio,
  Weight,
} from "lucide-react";

import { Attention } from "@/components/dashboard/attention";
import { BentoCell, BentoGrid, KpiCard } from "@/components/dashboard/bento";
import { CorridorsCell, DispatchCell, ModalSplitCell } from "@/components/dashboard/chart-cells";
import { LiveFleet } from "@/components/dashboard/live-fleet";
import { NetworkMapCard } from "@/components/dashboard/network-map-card";
import { StatusBreakdown } from "@/components/dashboard/status-breakdown";
import { PageHeader, Skeleton } from "@/components/page-header";
import { Money } from "@/components/money";
import { apiGet } from "@/lib/api";
import type { DashboardSummary, FleetLive, SustainabilitySummary } from "@/lib/types";

export default function DashboardPage() {
  return (
    <div className="min-h-screen px-4 py-6 md:px-8 md:py-8 lg:px-10">
      <PageHeader
        title="Torre de control"
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
  const [summary, fleet, green] = await Promise.all([
    apiGet<DashboardSummary>("/api/dashboard/summary"),
    apiGet<FleetLive>("/api/fleet/live"),
    apiGet<SustainabilitySummary>("/api/sustainability/summary"),
  ]);
  const k = summary.kpis;

  return (
    <>
      <Attention alerts={summary.alerts} />
      <BentoGrid>
      <KpiCard
        className="md:col-span-3 xl:col-span-3"
        href="/envios?estado=En Ruta,Transferencia Modal,Retrasado"
        label="Envíos en tránsito"
        value={k.active.fmt}
        icon={<Navigation />}
        accent="var(--color-success)"
        footnote={`${k.delayed.fmt} retrasados · ${k.scheduled.fmt} programados`}
      />
      <KpiCard
        className="md:col-span-3 xl:col-span-3"
        href="/envios?estado=Transferencia Modal"
        label="Transferencia modal"
        value={k.in_transfer.fmt}
        icon={<ArrowRightLeft />}
        accent="var(--color-warning)"
        footnote="Cargas en transbordo entre modos"
      />
      <KpiCard
        className="md:col-span-3 xl:col-span-3"
        href="/envios?estado=En Ruta,Transferencia Modal,Retrasado"
        label="Carga en tránsito"
        value={k.tons_in_transit.fmt}
        icon={<Weight />}
        footnote={
          <>
            Flete comprometido <Money usd={k.cost_in_transit.value ?? 0} compact />
          </>
        }
      />
      <KpiCard
        className="md:col-span-3 xl:col-span-3"
        href="/envios?estado=Entregado"
        label="OTIF (30 días)"
        value={k.otif.fmt}
        icon={<Gauge />}
        footnote={`${k.delivered.fmt} entregas cerradas`}
      />

      <BentoCell
        className="min-h-[560px] md:col-span-6 xl:col-span-8 xl:row-span-2"
        title="Red multimodal"
        description={`${summary.network.nodes} nodos · ${summary.network.links} enlaces`}
        icon={<Network />}
        action={
          <Link
            href="/red"
            className="press -mr-1 flex h-8 shrink-0 items-center gap-1 rounded-xl px-2.5 text-sm font-medium text-primary outline-none hover:bg-fill focus-visible:ring-[3px] focus-visible:ring-ring/80"
          >
            Abrir mapa <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        }
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

      <ModalSplitCell className="md:col-span-3 xl:col-span-3" data={summary.modal_split} footprint={green.by_mode} />
      <CorridorsCell className="md:col-span-3 xl:col-span-3" top={summary.top_corridors} all={summary.all_corridors} />
      <DispatchCell className="md:col-span-3 xl:col-span-3" data={summary.dispatches_14d} />

      <BentoCell
        className="md:col-span-3 xl:col-span-3"
        title="Por estado"
        icon={<Activity />}
      >
        <StatusBreakdown counts={summary.status_counts} />
      </BentoCell>
      </BentoGrid>
    </>
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
