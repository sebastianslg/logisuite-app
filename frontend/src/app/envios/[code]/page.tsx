import { Suspense } from "react";
import { notFound } from "next/navigation";

import { Skeleton } from "@/components/page-header";
import { ShipmentDetail } from "@/components/shipments/shipment-detail";
import { apiGet, apiGetOrNull } from "@/lib/api";
import type { Attachment, AuditEntry, Shipment, ShipmentEvent } from "@/lib/types";

export const metadata = { title: "Detalle de envío" };

export default function EnvioPage({ params }: PageProps<"/envios/[code]">) {
  return (
    // Ancho máximo centrado: el detalle se lee mejor y el mapa no crece sin límite en pantallas anchas
    <div className="page page-narrow">
      <Suspense fallback={<Skeleton className="h-[720px]" />}>
        <Detail params={params} />
      </Suspense>
    </div>
  );
}

async function Detail({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const c = encodeURIComponent(code);
  // Historial por registro (no solo por tabla): incluye notas, incidencias y adjuntos del envío
  const [shipment, audit, events, attachments] = await Promise.all([
    apiGetOrNull<Shipment>(`/api/shipments/${c}`),
    apiGet<{ items: AuditEntry[] }>(`/api/audit?record=${c}`),
    apiGetOrNull<{ items: ShipmentEvent[] }>(`/api/shipments/${c}/events`),
    apiGetOrNull<{ items: Attachment[] }>(`/api/shipments/${c}/attachments`),
  ]);
  if (!shipment) notFound();
  return (
    <ShipmentDetail
      shipment={shipment}
      history={audit.items}
      events={events?.items ?? []}
      attachments={attachments?.items ?? []}
    />
  );
}
