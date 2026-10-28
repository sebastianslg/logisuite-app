import { Suspense } from "react";
import { notFound } from "next/navigation";

import { VehicleForm } from "@/components/fleet/vehicle-form";
import { PageHeader, Skeleton } from "@/components/page-header";
import { apiGetOrNull } from "@/lib/api";
import type { VehicleDetail } from "@/lib/types";

export const metadata = { title: "Editar vehículo" };

export default function EditarVehiculoPage({ params }: PageProps<"/flota/[id]/editar">) {
  return (
    <div className="page page-narrow">
      <Suspense fallback={<Skeleton className="h-[600px]" />}>
        <EditForm params={params} />
      </Suspense>
    </div>
  );
}

async function EditForm({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const vehicle = await apiGetOrNull<VehicleDetail>(`/api/fleet/vehicles/${encodeURIComponent(id)}`);
  if (!vehicle) notFound();
  return (
    <>
      <PageHeader title={`Editar ${vehicle.code}`} description="Los cambios quedan en el historial con tu nombre de operador." />
      <div>
        <VehicleForm vehicle={vehicle} />
      </div>
    </>
  );
}
