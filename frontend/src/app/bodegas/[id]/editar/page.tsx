import { Suspense } from "react";
import { notFound } from "next/navigation";

import { PageHeader, Skeleton } from "@/components/page-header";
import { WarehouseForm } from "@/components/warehouses/warehouse-form";
import { apiGetOrNull } from "@/lib/api";
import type { WarehouseDetail } from "@/lib/types";

export const metadata = { title: "Editar bodega" };

export default function EditarBodegaPage({ params }: PageProps<"/bodegas/[id]/editar">) {
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
  const warehouse = await apiGetOrNull<WarehouseDetail>(`/api/warehouses/${encodeURIComponent(id)}`);
  if (!warehouse) notFound();
  return (
    <>
      <PageHeader title={`Editar ${warehouse.name}`} description="Los cambios quedan en el historial con tu nombre de operador." />
      <div>
        <WarehouseForm warehouse={warehouse} />
      </div>
    </>
  );
}
