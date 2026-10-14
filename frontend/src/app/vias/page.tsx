import { Suspense } from "react";
import Link from "next/link";

import { CorridorBoard } from "@/components/corridors/corridor-board";
import { NodeBoard } from "@/components/corridors/node-board";
import { PageHeader, Skeleton } from "@/components/page-header";
import { apiGet } from "@/lib/api";
import type { AuditEntry, Corridor, NodeStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata = { title: "Vías y nodos" };

export default function ViasPage({ searchParams }: PageProps<"/vias">) {
  return (
    <div className="px-6 py-8 lg:px-10">
      <PageHeader
        title="Vías y cierres"
        description="Cierra una vía, un aeropuerto o un puerto con su motivo y el motor recalcula todas las rutas: los envíos en curso que pasan por allí se redirigen por la mejor alternativa o quedan marcados sin ruta. Al reabrirlo se restablecen."
      />
      <Suspense fallback={<Skeleton className="mt-8 h-[640px]" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const TABS = [
  { label: "Vías", href: "/vias", key: "vias" },
  { label: "Aeropuertos y puertos", href: "/vias?ver=nodos", key: "nodos" },
] as const;

async function Content({ searchParams }: { searchParams: PageProps<"/vias">["searchParams"] }) {
  const ver = (await searchParams).ver;
  const current = ver === "nodos" ? "nodos" : "vias";
  return (
    <>
      <nav aria-label="Qué cerrar" className="mt-6 inline-flex rounded-full bg-fill p-1 text-sm">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            aria-current={t.key === current ? "page" : undefined}
            className={cn(
              "press rounded-full px-4 py-1.5 transition-colors",
              t.key === current ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <div className="mt-6">{current === "nodos" ? <Nodes /> : <Corridors />}</div>
    </>
  );
}

async function Corridors() {
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
