import { Suspense } from "react";
import { notFound } from "next/navigation";

import { PageHeader, Skeleton } from "@/components/page-header";
import { ShipmentForm } from "@/components/shipments/shipment-form";
import { apiGetOrNull } from "@/lib/api";
import type { Shipment } from "@/lib/types";

export const metadata = { title: "Editar envío" };

export default function EditarEnvioPage({ params }: PageProps<"/envios/[code]/editar">) {
  return (
    <div className="page page-narrow">
      <Suspense fallback={<Skeleton className="h-[600px]" />}>
        <EditForm params={params} />
      </Suspense>
    </div>
  );
}

async function EditForm({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const shipment = await apiGetOrNull<Shipment>(`/api/shipments/${encodeURIComponent(code)}`);
  if (!shipment) notFound();
  return (
    <>
      <PageHeader
        title="Editar envío"
        description="Al guardar se recalcula la ruta y el cambio queda en el historial con tu nombre de operador."
      />
      <div>
        <ShipmentForm shipment={shipment} />
      </div>
    </>
  );
}
