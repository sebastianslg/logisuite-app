import { Suspense } from "react";

import { CarbonView } from "@/components/green/carbon-view";
import { PageHeader, Skeleton } from "@/components/page-header";
import { apiGet } from "@/lib/api";
import type { SustainabilitySummary } from "@/lib/types";

export const metadata = { title: "Huella de carbono" };

export default function HuellaPage() {
  return (
    <div className="page">
      <PageHeader
        title="Huella de carbono"
        description="Emisiones de CO₂e de la operación, su intensidad por modo y cuánto evita la multimodalidad frente a la carretera."
      />
      <div>
        <Suspense fallback={<Skeleton className="h-[560px]" />}>
          <CarbonData />
        </Suspense>
      </div>
    </div>
  );
}

async function CarbonData() {
  const summary = await apiGet<SustainabilitySummary>("/api/sustainability/summary");
  return <CarbonView summary={summary} />;
}
