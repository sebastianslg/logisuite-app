import { Suspense } from "react";
import { notFound } from "next/navigation";

import { Skeleton } from "@/components/page-header";
import { WarehouseDetailView } from "@/components/warehouses/warehouse-detail";
import { apiGetOrNull } from "@/lib/api";
import type { WarehouseDetail } from "@/lib/types";

export const metadata = { title: "Bodega" };

export default function BodegaPage({ params }: PageProps<"/bodegas/[id]">) {
  return (
    <div className="px-6 py-8 lg:px-10">
      <Suspense fallback={<Skeleton className="h-[720px]" />}>
        <Detail params={params} />
      </Suspense>
    </div>
  );
}

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const warehouse = await apiGetOrNull<WarehouseDetail>(`/api/warehouses/${encodeURIComponent(id)}`);
  if (!warehouse) notFound();
  return <WarehouseDetailView warehouse={warehouse} />;
}
