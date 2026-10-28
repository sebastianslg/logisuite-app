import { Suspense } from "react";

import { FuelView } from "@/components/green/fuel-view";
import { PageHeader, Skeleton } from "@/components/page-header";
import { apiGet } from "@/lib/api";
import type { FuelLive, SustainabilitySummary } from "@/lib/types";

export const metadata = { title: "Combustible" };

export default function CombustiblePage() {
  return (
    <div className="page">
      <PageHeader
        title="Telemetría de combustible"
        description="Consumo estimado por activo, por modo y frente a mover toda la carga por carretera. Se actualiza solo."
      />
      <div>
        <Suspense fallback={<Skeleton className="h-[560px]" />}>
          <FuelData />
        </Suspense>
      </div>
    </div>
  );
}

async function FuelData() {
  const [summary, live] = await Promise.all([
    apiGet<SustainabilitySummary>("/api/sustainability/summary"),
    apiGet<FuelLive>("/api/sustainability/fuel-live"),
  ]);
  return <FuelView summary={summary} initial={live} />;
}
