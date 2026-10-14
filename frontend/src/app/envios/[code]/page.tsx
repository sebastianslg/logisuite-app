import { Suspense } from "react";
import { notFound } from "next/navigation";

import { Skeleton } from "@/components/page-header";
import { ShipmentDetail } from "@/components/shipments/shipment-detail";
import { apiGet, apiGetOrNull } from "@/lib/api";
import type { AuditEntry, Shipment } from "@/lib/types";

export const metadata = { title: "Detalle de envío" };

export default function EnvioPage({ params }: PageProps<"/envios/[code]">) {
  return (
    <div className="px-6 py-8 lg:px-10">
      <Suspense fallback={<Skeleton className="h-[720px]" />}>
        <Detail params={params} />
      </Suspense>
    </div>
  );
}

async function Detail({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [shipment, audit] = await Promise.all([
    apiGetOrNull<Shipment>(`/api/shipments/${encodeURIComponent(code)}`),
    apiGet<{ items: AuditEntry[] }>(`/api/audit?table=mm_shipments&record=${encodeURIComponent(code)}`),
  ]);
  if (!shipment) notFound();
  return <ShipmentDetail shipment={shipment} history={audit.items} />;
}
