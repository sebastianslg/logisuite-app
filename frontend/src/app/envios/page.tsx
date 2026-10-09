import { Suspense } from "react";

import { PageHeader, Skeleton } from "@/components/page-header";
import { ShipmentsTable } from "@/components/shipments/shipments-table";
import { apiGet } from "@/lib/api";
import type { Shipment } from "@/lib/types";

export const metadata = { title: "Envíos" };

export default function EnviosPage() {
  return (
    <div className="px-6 py-8 lg:px-10">
      <PageHeader
        eyebrow="TMS"
        title="Envíos multimodales"
        description="Órdenes con su cadena de modos, transbordos, avance en tiempo real y ETA. Filtra por estado o por modo y ordena cualquier columna."
      />
      <div className="mt-8">
        <Suspense fallback={<Skeleton className="h-[640px]" />}>
          <ShipmentsData />
        </Suspense>
      </div>
    </div>
  );
}

async function ShipmentsData() {
  const { items } = await apiGet<{ count: number; items: Shipment[] }>("/api/shipments");
  return <ShipmentsTable data={items} />;
}
