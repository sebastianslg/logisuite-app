import { Suspense } from "react";
import { Plus } from "lucide-react";

import { PageHeader, Skeleton } from "@/components/page-header";
import { BurstLink } from "@/components/ui/burst-link";
import { TransfersBoard } from "@/components/warehouses/transfers-board";
import { WarehouseBoard } from "@/components/warehouses/warehouse-board";
import { WarehouseTabs, type WarehouseTab } from "@/components/warehouses/warehouse-tabs";
import { apiGet } from "@/lib/api";
import type { Warehouse, WarehouseRole, WarehouseSummary, WarehouseTransfer } from "@/lib/types";

export const metadata = { title: "Bodegas" };

export default function BodegasPage({ searchParams }: PageProps<"/bodegas">) {
  return (
    <div className="page">
      <PageHeader
        title="Bodegas y centros de distribución"
        description="La red de bodegas por ciudad, cada una con su función: centros nacionales, regionales, última milla, frío, puertos, aduana, peligrosos y devoluciones. Guardan inventario, se trasladan mercancía entre sí y alojan a los vehículos."
        actions={
          <BurstLink href="/bodegas/nueva"><Plus /> Nueva bodega</BurstLink>
        }
      />
      <Suspense fallback={<Skeleton className="h-[640px]" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/bodegas">["searchParams"] }) {
  const ver = (await searchParams).ver;
  const tab: WarehouseTab = ver === "traslados" ? "traslados" : "red";
  const summary = await apiGet<WarehouseSummary>("/api/warehouses/summary");
  return (
    <>
      <div><WarehouseTabs current={tab} transit={summary.in_transit} /></div>
      <div className="mt-6">{tab === "red" ? <Network summary={summary} /> : <Transfers />}</div>
    </>
  );
}

async function Network({ summary }: { summary: WarehouseSummary }) {
  const [w, r] = await Promise.all([
    apiGet<{ items: Warehouse[] }>("/api/warehouses"),
    apiGet<{ items: WarehouseRole[] }>("/api/warehouses/roles"),
  ]);
  return <WarehouseBoard warehouses={w.items} summary={summary} roles={r.items} />;
}

async function Transfers() {
  const t = await apiGet<{ items: WarehouseTransfer[] }>("/api/warehouses/transfers?limit=200");
  return <TransfersBoard transfers={t.items} />;
}
