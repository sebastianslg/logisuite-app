import { Suspense } from "react";
import { notFound } from "next/navigation";

import { VehicleDetailView } from "@/components/fleet/vehicle-detail";
import { Skeleton } from "@/components/page-header";
import { apiGetOrNull } from "@/lib/api";
import type { VehicleDetail } from "@/lib/types";

export const metadata = { title: "Vehículo" };

export default function VehiculoPage({ params }: PageProps<"/flota/[id]">) {
  return (
    <div className="page">
      <Suspense fallback={<Skeleton className="h-[720px]" />}>
        <Detail params={params} />
      </Suspense>
    </div>
  );
}

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const vehicle = await apiGetOrNull<VehicleDetail>(`/api/fleet/vehicles/${encodeURIComponent(id)}`);
  if (!vehicle) notFound();
  return <VehicleDetailView vehicle={vehicle} />;
}
