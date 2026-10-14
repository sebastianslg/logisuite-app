import Link from "next/link";
import { ChevronRight, CircleCheck, CircleOff, Clock, Route, TrafficCone, TriangleAlert } from "lucide-react";

import type { DashboardSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

type Item = {
  key: string;
  href: string;
  icon: React.ReactNode;
  title: string;
  detail: React.ReactNode;
  tone: "danger" | "warning";
};

const codes = (list: string[], max = 4) => (
  <>
    {list.slice(0, max).map((c, i) => (
      <span key={c}>
        {i > 0 && ", "}
        <span className="font-mono text-xs">{c}</span>
      </span>
    ))}
    {list.length > max && ` y ${list.length - max} más`}
  </>
);

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Lo que requiere una decisión ahora: cierres, envíos sin ruta, redirigidos y retrasados, cada uno con su destino. */
export function Attention({ alerts }: { alerts: DashboardSummary["alerts"] }) {
  const { closed_corridors: corridors, closed_nodes: nodes, no_route: noRoute, rerouted, delayed } = alerts;
  const items: Item[] = [];
  if (noRoute.length)
    items.push({
      key: "sin-ruta", href: "/envios", tone: "danger", icon: <CircleOff />,
      title: plural(noRoute.length, "envío sin ruta", "envíos sin ruta"),
      detail: codes(noRoute),
    });
  if (corridors.length)
    items.push({
      key: "vias", href: "/vias", tone: "danger", icon: <TrafficCone />,
      title: plural(corridors.length, "vía cerrada", "vías cerradas"),
      detail: corridors.slice(0, 2).join(", ") + (corridors.length > 2 ? ` y ${corridors.length - 2} más` : ""),
    });
  if (nodes.length)
    items.push({
      key: "nodos", href: "/vias?ver=nodos", tone: "danger", icon: <TriangleAlert />,
      title: plural(nodes.length, "nodo cerrado", "nodos cerrados"),
      detail: nodes.slice(0, 2).map((n) => n.name).join(", ") + (nodes.length > 2 ? ` y ${nodes.length - 2} más` : ""),
    });
  if (rerouted.length)
    items.push({
      key: "redirigidos", href: "/envios", tone: "warning", icon: <Route />,
      title: plural(rerouted.length, "envío redirigido", "envíos redirigidos"),
      detail: codes(rerouted),
    });
  if (delayed.length)
    items.push({
      key: "retrasados", href: "/envios?estado=Retrasado", tone: "warning", icon: <Clock />,
      title: plural(delayed.length, "envío retrasado", "envíos retrasados"),
      detail: delayed.slice(0, 2).map((d) => `${d.origin} → ${d.destination} (+${d.delay_fmt})`).join(" · "),
    });

  if (items.length === 0)
    return (
      <p role="status" className="mb-4 flex items-center gap-2 rounded-2xl bg-fill px-4 py-3 text-sm text-muted-foreground">
        <CircleCheck className="size-4 shrink-0 text-success" aria-hidden />
        Todo en orden: sin cierres, envíos sin ruta ni retrasos.
      </p>
    );

  return (
    <section aria-labelledby="atencion" className="mb-4">
      <h2 id="atencion" className="mb-2 px-1 text-sm font-semibold text-muted-foreground">
        Requiere atención
      </h2>
      <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {items.map((it) => (
          <li key={it.key}>
            <Link
              href={it.href}
              className={cn(
                "press flex min-h-14 items-center gap-3 rounded-2xl px-4 py-3 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/80",
                it.tone === "danger" ? "bg-destructive/12 hover:bg-destructive/16" : "bg-warning/12 hover:bg-warning/16",
              )}
            >
              <span className={cn("shrink-0 [&_svg]:size-5", it.tone === "danger" ? "text-destructive" : "text-warning")} aria-hidden>
                {it.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{it.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{it.detail}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
