import { Suspense } from "react";
import Link from "next/link";

import { CorridorBoard } from "@/components/corridors/corridor-board";
import { NodeBoard } from "@/components/corridors/node-board";
import { PageHeader, Skeleton } from "@/components/page-header";
import { apiGet } from "@/lib/api";
import type { AuditEntry, Corridor, NodeStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata = { title: "Vías" };

export default async function ViasPage({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const nodos = (await searchParams).ver === "nodos";
  return (
    <div className="px-6 py-8 lg:px-10">
      <PageHeader
        title="Vías y cierres"
        description="Cierra una vía, un aeropuerto o un puerto con su motivo y el motor recalcula todas las rutas: los envíos en curso que pasan por allí se redirigen por la mejor alternativa o quedan marcados sin ruta. Al reabrirlo se restablecen."
      />
      <nav aria-label="Qué cerrar" className="mt-6 inline-flex rounded-full bg-fill p-1 text-sm">
        {[["Vías", "/vias", !nodos], ["Aeropuertos y puertos", "/vias?ver=nodos", nodos]].map(([label, href, on]) => (
          <Link key={href as string} href={href as string} aria-current={on ? "page" : undefined}
            className={cn("press rounded-full px-4 py-1.5 transition-colors", on ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            {label as string}
          </Link>
        ))}
      </nav>
      <div className="mt-6">
        <Suspense fallback={<Skeleton className="h-[640px]" />}>
          {nodos ? <Nodes /> : <Board />}
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

async function Nodes() {
  const nodes = await apiGet<{ items: NodeStatus[] }>("/api/nodes/status");
  return <NodeBoard nodes={nodes.items} />;
}
