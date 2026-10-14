import { Suspense } from "react";

import { PageHeader, Skeleton } from "@/components/page-header";
import { ShipmentsTable, type ShipmentFilters } from "@/components/shipments/shipments-table";
import { apiGet } from "@/lib/api";
import { MODE_ORDER, STATUS_ORDER } from "@/lib/modes";
import type { Mode, Shipment, ShipmentStatus } from "@/lib/types";

export const metadata = { title: "Envíos" };

type Search = Promise<{ [key: string]: string | string[] | undefined }>;

export default function EnviosPage({ searchParams }: { searchParams: Search }) {
  return (
    <div className="px-4 py-6 md:px-8 md:py-8 lg:px-10">
      <PageHeader
        title="Envíos multimodales"
        description="Órdenes con su cadena de modos, transbordos, avance en tiempo real y ETA. Filtra por estado o por modo, ordena cualquier columna y abre un envío para ver todo su detalle."
      />
      <div className="mt-8">
        <Suspense fallback={<Skeleton className="h-[640px]" />}>
          <ShipmentsData searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Lee los filtros de la URL (?estado=A,B&modo=terrestre,aereo&q=texto) descartando valores desconocidos. */
async function parseFilters(searchParams: Search): Promise<ShipmentFilters> {
  const sp = await searchParams;
  const list = (v: string | string[] | undefined) => (first(v) ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  return {
    status: list(sp.estado).filter((s): s is ShipmentStatus => (STATUS_ORDER as string[]).includes(s)),
    modes: list(sp.modo).filter((m): m is Mode => (MODE_ORDER as string[]).includes(m)),
    q: first(sp.q) ?? "",
  };
}

async function ShipmentsData({ searchParams }: { searchParams: Search }) {
  const [filters, { items }] = await Promise.all([
    parseFilters(searchParams),
    apiGet<{ count: number; items: Shipment[] }>("/api/shipments"),
  ]);
  // key: al cambiar los filtros de la URL (desde un enlace del dashboard) la tabla se reinicia con ellos
  return <ShipmentsTable key={JSON.stringify(filters)} data={items} initial={filters} />;
}
