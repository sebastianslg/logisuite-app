import { Suspense } from "react";
import { Plus } from "lucide-react";

import { PageHeader, Skeleton } from "@/components/page-header";
import { ShipmentsTable, type ShipmentFilters } from "@/components/shipments/shipments-table";
import { BurstLink } from "@/components/ui/burst-link";
import { apiGet } from "@/lib/api";
import { MODE_ORDER, STATUS_ORDER } from "@/lib/modes";
import type { Mode, Shipment, ShipmentStatus } from "@/lib/types";

export const metadata = { title: "Envíos" };

export default function EnviosPage({ searchParams }: PageProps<"/envios">) {
  return (
    <div className="page">
      <PageHeader
        title="Envíos multimodales"
        description="Órdenes con su cadena de modos, transbordos, avance en tiempo real y ETA. Crea, edita o borra envíos, selecciona varios para exportarlos a PDF o compartirlos."
        actions={
          <BurstLink href="/envios/nuevo">
            <Plus />
            Nuevo envío
          </BurstLink>
        }
      />
      <div>
        <Suspense fallback={<Skeleton className="h-[640px]" />}>
          <ShipmentsData searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Filtros de la URL (?estado=A,B&modo=terrestre,aereo&q=texto); se descartan los valores desconocidos. */
async function parseFilters(searchParams: Promise<Record<string, string | string[] | undefined>>): Promise<ShipmentFilters> {
  const sp = await searchParams;
  const list = (v: string | string[] | undefined) => (first(v) ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  return {
    status: list(sp.estado).filter((s): s is ShipmentStatus => (STATUS_ORDER as string[]).includes(s)),
    modes: list(sp.modo).filter((m): m is Mode => (MODE_ORDER as string[]).includes(m)),
    q: first(sp.q) ?? "",
    unsigned: first(sp.firmar) === "1",
  };
}

async function ShipmentsData({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [filters, { items }] = await Promise.all([
    parseFilters(searchParams),
    apiGet<{ count: number; items: Shipment[] }>("/api/shipments"),
  ]);
  // key: al cambiar los filtros de la URL (enlaces del dashboard) la tabla se reinicia con ellos
  return <ShipmentsTable key={JSON.stringify(filters)} data={items} initial={filters} />;
}
