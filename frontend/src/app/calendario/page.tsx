import { Suspense } from "react";

import { ShipmentCalendar } from "@/components/calendar/shipment-calendar";
import { PageHeader, Skeleton } from "@/components/page-header";
import { apiGet } from "@/lib/api";
import type { Shipment } from "@/lib/types";

export const metadata = { title: "Calendario de envíos" };

export default function CalendarioPage() {
  return (
    <div className="page">
      <PageHeader
        title="Calendario"
        description="Qué sale, qué está en camino y qué llega en los próximos días: cada envío entre su salida y su llegada estimada, con su retraso."
      />
      <Suspense fallback={<Skeleton className="h-[640px]" />}>
        <Data />
      </Suspense>
    </div>
  );
}

async function Data() {
  const data = await apiGet<{ items: Shipment[] }>("/api/shipments?limit=1000");
  return <ShipmentCalendar shipments={data.items} />;
}
