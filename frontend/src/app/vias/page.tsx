import { Suspense } from "react";

import { CorridorBoard } from "@/components/corridors/corridor-board";
import { PageHeader, Skeleton } from "@/components/page-header";
import { apiGet } from "@/lib/api";
import type { AuditEntry, Corridor } from "@/lib/types";

export const metadata = { title: "Vías" };

export default function ViasPage() {
  return (
    <div className="px-6 py-8 lg:px-10">
      <PageHeader
        eyebrow="Red"
        title="Vías y cierres"
        description="Cierra una vía con su motivo y el motor recalcula todas las rutas: los envíos en curso que la usan se redirigen por la mejor alternativa o quedan marcados sin ruta. Al reabrirla se restablecen."
      />
      <div className="mt-8">
        <Suspense fallback={<Skeleton className="h-[640px]" />}>
          <Board />
        </Suspense>
      </div>
    </div>
  );
}

async function Board() {
  const [corridors, audit] = await Promise.all([
    apiGet<{ items: Corridor[] }>("/api/corridors"),
    apiGet<{ items: AuditEntry[] }>("/api/audit?table=mm_corridor_status&limit=50"),
  ]);
  return <CorridorBoard corridors={corridors.items} history={audit.items} />;
}
