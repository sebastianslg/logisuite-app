import { Suspense } from "react";

import { HistoryView } from "@/components/history/history-view";
import { PageHeader, Skeleton } from "@/components/page-header";
import { apiGet } from "@/lib/api";
import type { History } from "@/lib/types";

export const metadata = { title: "Historial de trayectos" };

export default function HistorialPage({ searchParams }: PageProps<"/historial">) {
  return (
    <div className="page">
      <PageHeader
        title="Historial de trayectos"
        description="Qué se movió y por dónde: envíos y toneladas por ciudad y departamento, y por corredor con flete, peajes, combustible y huella."
      />
      <Suspense fallback={<Skeleton className="h-[560px]" />}>
        <HistoryData searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function HistoryData({ searchParams }: { searchParams: PageProps<"/historial">["searchParams"] }) {
  const raw = Number((await searchParams).dias);
  const days = [7, 30, 90].includes(raw) ? raw : 30;
  const data = await apiGet<History>(`/api/history?days=${days}`);
  return <HistoryView data={data} />;
}
