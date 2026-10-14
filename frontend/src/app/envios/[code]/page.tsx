import { Suspense } from "react";
import { notFound } from "next/navigation";

import { Skeleton } from "@/components/page-header";
import { ShipmentDetail } from "@/components/shipments/shipment-detail";
import { ApiError, apiGet } from "@/lib/api";
import type { Shipment } from "@/lib/types";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return { title: `Envío ${code}` };
}

export default function ShipmentPage({ params }: { params: Promise<{ code: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="px-4 py-6 md:px-8 md:py-8 lg:px-10">
          <Skeleton className="h-[640px]" />
        </div>
      }
    >
      <Detail params={params} />
    </Suspense>
  );
}

async function Detail({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  let shipment: Shipment;
  try {
    shipment = await apiGet<Shipment>(`/api/shipments/${encodeURIComponent(code)}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  return <ShipmentDetail shipment={shipment} />;
}
