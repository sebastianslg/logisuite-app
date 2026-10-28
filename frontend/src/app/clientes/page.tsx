import { Suspense } from "react";

import { ClientsView } from "@/components/clients/clients-view";
import { PageHeader, Skeleton } from "@/components/page-header";
import { apiGet } from "@/lib/api";
import type { ClientSummary } from "@/lib/types";

export const metadata = { title: "Clientes" };

export default function ClientesPage() {
  return (
    <div className="page">
      <PageHeader
        title="Clientes"
        description="Quién mueve más carga, cuánto paga en flete, qué tan puntuales han sido sus entregas y por qué modos viaja."
      />
      <Suspense fallback={<Skeleton className="h-[640px]" />}>
        <Data />
      </Suspense>
    </div>
  );
}

async function Data() {
  const data = await apiGet<{ items: ClientSummary[] }>("/api/clients");
  return <ClientsView items={data.items} />;
}
