import { Suspense } from "react";

import { RouteCompare } from "@/components/compare/route-compare";
import { DEFAULT_SCENARIOS } from "@/lib/compare";
import { PageHeader, Skeleton } from "@/components/page-header";
import { apiPost } from "@/lib/api";
import type { SimulateResponse } from "@/lib/types";

export const metadata = { title: "Comparar rutas" };

export default function CompararPage({ searchParams }: PageProps<"/comparar">) {
  return (
    <div className="page">
      <PageHeader
        title="Comparar rutas"
        description="El mismo envío con distintas prioridades y modos, lado a lado: tiempo, costo, huella y transbordos. Muestra qué aporta combinar modos frente a ir solo por carretera."
      />
      <Suspense fallback={<Skeleton className="h-[560px]" />}>
        <Compare searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Compare({ searchParams }: { searchParams: PageProps<"/comparar">["searchParams"] }) {
  const q = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const origin = one(q.origen) ?? "Bogotá";
  const destination = one(q.destino) ?? "Cartagena";
  const weight = Number(one(q.peso)) || 20;
  // Los escenarios por defecto se calculan aquí: la página llega ya con la comparación
  const initialResults = await Promise.all(
    DEFAULT_SCENARIOS.map((s) =>
      apiPost<SimulateResponse>("/api/routes/simulate", { origen: origin, destino: destination, peso_t: weight, prioridad: s.priority, modos: s.modes }),
    ),
  );
  return <RouteCompare initial={{ origin, destination, weight }} initialResults={initialResults} />;
}
