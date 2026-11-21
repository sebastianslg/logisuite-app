import { Suspense } from "react";
import Link from "next/link";
import { ArrowUpRight, FileText } from "lucide-react";

import { Attention } from "@/components/dashboard/attention";
import { BentoCell, BentoGrid } from "@/components/dashboard/bento";
import { HeroFigures } from "@/components/dashboard/hero-figures";
import { PresentButton } from "@/components/dashboard/presentation";
import { Button } from "@/components/ui/button";
import { CorridorsCell, DispatchCell, ModalSplitCell } from "@/components/dashboard/chart-cells";
import { LiveFleet } from "@/components/dashboard/live-fleet";
import { NetworkMapCard } from "@/components/dashboard/network-map-card";
import { StatusBreakdown } from "@/components/dashboard/status-breakdown";
import { PageHeader, Skeleton } from "@/components/page-header";
import { apiGet } from "@/lib/api";
import type { DashboardSummary, FleetLive, SustainabilitySummary } from "@/lib/types";

export default function DashboardPage() {
  return (
    <div className="page">
      <PageHeader
        title="Torre de control"
        description="Carretera, río, mar, aire y ferrocarril en una sola vista: fletes en tránsito, transbordos y reparto modal de la red logística de Colombia."
        actions={
          <>
            <Button variant="secondary" asChild className="print:hidden">
              <a href="/api/reports/operations?days=7" target="_blank" rel="noopener">
                <FileText />
                Reporte semanal
              </a>
            </Button>
            <PresentButton />
          </>
        }
      />
      <div>
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
      <HeroFigures
        inTransit={k.active.value ?? 0}
        delayed={k.delayed.value ?? 0}
        cost={k.cost_in_transit.value ?? 0}
        trends={summary.trends}
        secondary={[
          { label: "En transbordo", value: k.in_transfer.fmt, href: "/envios?estado=Transferencia Modal" },
          { label: "Carga en tránsito", value: k.tons_in_transit.fmt, hint: `${k.scheduled.fmt} programados`, href: "/envios?estado=En Ruta,Transferencia Modal,Retrasado" },
          { label: "OTIF 30 días", value: k.otif.fmt, hint: `${k.delivered.fmt} entregas`, href: "/envios?estado=Entregado" },
        ]}
      />
      <Attention alerts={summary.alerts} />
      <BentoGrid>
      <BentoCell
        className="min-h-[560px] md:col-span-6 xl:col-span-8 xl:row-span-2"
        title="Red multimodal"
        description={`${summary.network.nodes} nodos · ${summary.network.links} enlaces`}
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
      >
        <LiveFleet initial={fleet} />
      </BentoCell>

      <ModalSplitCell className="md:col-span-3 xl:col-span-3" data={summary.modal_split} footprint={green.by_mode} />
      <CorridorsCell className="md:col-span-3 xl:col-span-3" top={summary.top_corridors} all={summary.all_corridors} />
      <DispatchCell className="md:col-span-3 xl:col-span-3" data={summary.dispatches_14d} />

      <BentoCell
        className="md:col-span-3 xl:col-span-3"
        title="Por estado"
      >
        <StatusBreakdown counts={summary.status_counts} />
      </BentoCell>
      </BentoGrid>
    </>
  );
}

/** Misma forma que la página (cifras, avisos, mapa y flota, cuatro paneles): al cargar nada salta de lugar. */
function DashboardSkeleton() {
  return (
    <div aria-hidden>
      <Skeleton className="mb-6 h-[214px] rounded-3xl md:h-[246px]" />
      <Skeleton className="mb-6 h-36 rounded-3xl" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-6 xl:grid-cols-12">
        <Skeleton className="h-[560px] rounded-3xl md:col-span-6 xl:col-span-8" />
        <Skeleton className="h-[560px] rounded-3xl md:col-span-6 xl:col-span-4" />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-80 rounded-3xl md:col-span-3" />
        ))}
      </div>
    </div>
  );
}
