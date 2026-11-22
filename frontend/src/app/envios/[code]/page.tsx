import { Suspense } from "react";
import { notFound } from "next/navigation";

import { Skeleton } from "@/components/page-header";
import { ShipmentDetail, type SectionLoad } from "@/components/shipments/shipment-detail";
import { apiGetOrNull } from "@/lib/api";
import type { Attachment, AuditEntry, DeliveryInfo, Shipment, ShipmentEvent } from "@/lib/types";

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

/** Lo que trajo una sección: `ok` con el dato (null = no existe) o el aviso de que su lectura falló. */
function section<T>(result: PromiseSettledResult<T | null>): SectionLoad<T> {
  return result.status === "fulfilled" ? { ok: true, value: result.value } : { ok: false };
}

async function Detail({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const c = encodeURIComponent(code);
  // Historial por registro (no solo por tabla): incluye notas, incidencias y adjuntos del envío.
  // Cada sección se resuelve aparte: si una lectura falla, su tarjeta lo dice y las demás cargan igual.
  const [shipment, audit, events, attachments, delivery] = await Promise.allSettled([
    apiGetOrNull<Shipment>(`/api/shipments/${c}`),
    apiGetOrNull<{ items: AuditEntry[] }>(`/api/audit?record=${c}`),
    apiGetOrNull<{ items: ShipmentEvent[] }>(`/api/shipments/${c}/events`),
    apiGetOrNull<{ items: Attachment[] }>(`/api/shipments/${c}/attachments`),
    apiGetOrNull<DeliveryInfo>(`/api/shipments/${c}/delivery`),
  ]);
  // La ficha es el envío: sin él no hay página (404 con la marca). Si su lectura revienta, la vista
  // muestra su error como antes; las secciones nunca lanzan, solo se marcan como fallidas.
  if (shipment.status === "rejected") throw shipment.reason;
  const found = shipment.value;
  if (!found) notFound();
  return (
    <ShipmentDetail
      shipment={found}
      history={section(audit)}
      events={section(events)}
      attachments={section(attachments)}
      delivery={section(delivery)}
    />
  );
}
