import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { PageHeader, Skeleton } from "@/components/page-header";
import { ShipmentsTable } from "@/components/shipments/shipments-table";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/api";
import { STATUS_ORDER } from "@/lib/modes";
import type { Shipment, ShipmentStatus } from "@/lib/types";

export const metadata = { title: "Envíos" };

export default function EnviosPage({ searchParams }: PageProps<"/envios">) {
  return (
    <div className="px-6 py-8 lg:px-10">
      <PageHeader
        eyebrow="TMS"
        title="Envíos multimodales"
        description="Órdenes con su cadena de modos, transbordos, avance en tiempo real y ETA. Crea, edita o borra envíos, selecciona varios para exportarlos a PDF o compartirlos."
        actions={
          <Button asChild>
            <Link href="/envios/nuevo">
              <Plus />
              Nuevo envío
            </Link>
          </Button>
        }
      />
      <div className="mt-8">
        <Suspense fallback={<Skeleton className="h-[640px]" />}>
          <ShipmentsData searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function ShipmentsData({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ items }, sp] = await Promise.all([
    apiGet<{ count: number; items: Shipment[] }>("/api/shipments"),
    searchParams,
  ]);
  // ?estado=En Ruta,Retrasado (enlaces del dashboard)
  const raw = typeof sp.estado === "string" ? sp.estado : "";
  const initialStatus = raw.split(",").filter((s): s is ShipmentStatus => STATUS_ORDER.includes(s as ShipmentStatus));
  return <ShipmentsTable data={items} initialStatus={initialStatus} />;
}
