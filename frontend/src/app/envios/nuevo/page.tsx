import { Suspense } from "react";

import { PageHeader, Skeleton } from "@/components/page-header";
import { ShipmentForm, type ShipmentDraft } from "@/components/shipments/shipment-form";
import type { Priority } from "@/lib/types";

export const metadata = { title: "Nuevo envío" };

export default function NuevoEnvioPage({ searchParams }: PageProps<"/envios/nuevo">) {
  return (
    <div className="px-6 py-8 lg:px-10">
      <PageHeader
        eyebrow="Envíos"
        title="Nuevo envío"
        description="La ruta multimodal se calcula al guardar con la red vigente: las vías cerradas quedan fuera. Puedes forzar modos o vías específicas."
      />
      <div className="mt-8">
        <Suspense fallback={<Skeleton className="h-[520px]" />}>
          <NewForm searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

/** Prefill desde el simulador: ?origin=&destination=&priority=&weight= */
async function NewForm({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const prefill: Partial<ShipmentDraft> = {};
  if (one("origin")) prefill.origin = one("origin");
  if (one("destination")) prefill.destination = one("destination");
  if (one("weight")) prefill.weight_t = one("weight");
  const p = one("priority");
  if (p === "tiempo" || p === "costo" || p === "balanceado") prefill.priority = p as Priority;
  return <ShipmentForm prefill={prefill} />;
}
