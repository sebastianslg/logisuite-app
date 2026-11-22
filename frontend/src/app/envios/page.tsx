import { Suspense } from "react";
import { Plus } from "lucide-react";

import { PageHeader, Skeleton } from "@/components/page-header";
import { ShipmentsTable, type ShipmentFilters } from "@/components/shipments/shipments-table";
import { BurstLink } from "@/components/ui/burst-link";
import { apiGet } from "@/lib/api";
import { MODE_ORDER, STATUS_ORDER } from "@/lib/modes";
import type { Mode, Shipment, ShipmentStatus } from "@/lib/types";

export const metadata = { title: "Envíos" };

/** Envíos por página: la lista los pide a la API de a tandas, con los filtros aplicados en el servidor. */
const PAGE_SIZE = 25;

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
    page: Math.max(1, Number(first(sp.pagina)) || 1),
  };
}

async function ShipmentsData({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = await parseFilters(searchParams);
  // Una página a la vez: los filtros y la búsqueda los resuelve la API sobre TODOS los envíos, no sobre lo cargado
  const query = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String((filters.page! - 1) * PAGE_SIZE) });
  if (filters.status?.length) query.set("status", filters.status.join(","));
  if (filters.modes?.length) query.set("modes", filters.modes.join(","));
  if (filters.q) query.set("q", filters.q);
  if (filters.unsigned) query.set("firmar", "true");
  const data = await apiGet<{
    total: number;
    counts: { status: Record<string, number>; modes: Record<string, number> };
    items: Shipment[];
  }>(`/api/shipments?${query.toString()}`);
  // key: al cambiar filtros o página, la tabla se reinicia con los datos nuevos
  return (
    <ShipmentsTable
      key={JSON.stringify(filters)}
      data={data.items}
      total={data.total}
      initial={filters}
      servidor={{ total: data.total, page: filters.page!, pageSize: PAGE_SIZE, counts: data.counts }}
    />
  );
}
