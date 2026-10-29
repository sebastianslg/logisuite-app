import Link from "next/link";
import { ChevronRight, CircleCheck, CircleOff, Clock, FileWarning, PackageX, PenLine, Route, TrafficCone, TriangleAlert, Truck, Wrench } from "lucide-react";

import type { DashboardSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

export type AlertItem = {
  key: string;
  href: string;
  icon: React.ReactNode;
  title: string;
  detail: React.ReactNode;
  tone: "danger" | "warning";
  /** Nuevo desde la última vez que se abrieron los avisos (solo en el panel del dock). */
  fresh?: boolean;
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

/** Lo que requiere una decisión ahora, en orden: primero lo que impide operar (rojo), luego los avisos. */
export function buildAlertItems(alerts: DashboardSummary["alerts"]): AlertItem[] {
  const { closed_corridors: corridors, closed_nodes: nodes, no_route: noRoute, rerouted, delayed } = alerts;
  const items: AlertItem[] = [];
  const fleet = alerts.fleet;
  const wh = alerts.warehouses;
  if (fleet && fleet.disabled + fleet.in_shop > 0)
    items.push({
      key: "flota-fuera", href: "/flota?ver=fallas", tone: "danger", icon: <Truck />,
      title: plural(fleet.disabled + fleet.in_shop, "vehículo fuera de servicio", "vehículos fuera de servicio"),
      detail: [fleet.disabled && plural(fleet.disabled, "inhabilitado", "inhabilitados"), fleet.in_shop && `${fleet.in_shop} en taller`].filter(Boolean).join(" · "),
    });
  const docs = alerts.documents;
  if (docs && docs.expired > 0)
    items.push({
      key: "docs-vencidos", href: "/hoy#atencion", tone: "danger", icon: <FileWarning />,
      title: plural(docs.expired, "documento de flota vencido", "documentos de flota vencidos"),
      detail: "SOAT o técnico-mecánica: esos vehículos no pueden circular",
    });
  if (docs && docs.due > 0)
    items.push({
      key: "docs-por-vencer", href: "/hoy#atencion", tone: "warning", icon: <FileWarning />,
      title: plural(docs.due, "documento de flota por vencer", "documentos de flota por vencer"),
      detail: "SOAT o técnico-mecánica en los próximos 30 días",
    });
  if (alerts.to_sign && alerts.to_sign > 0)
    items.push({
      key: "por-firmar", href: "/hoy#firmar", tone: "warning", icon: <PenLine />,
      title: plural(alerts.to_sign, "entrega por firmar", "entregas por firmar"),
      detail: "Llegaron en las últimas 48 h sin prueba de entrega",
    });
  if (fleet && fleet.overdue > 0)
    items.push({
      key: "flota-mant", href: "/flota?ver=mantenimiento", tone: "warning", icon: <Wrench />,
      title: plural(fleet.overdue, "mantenimiento vencido", "mantenimientos vencidos"),
      detail: "Programa el servicio antes de que se inhabiliten",
    });
  if (wh && (wh.low_stock > 0 || wh.full.length > 0))
    items.push({
      key: "bodegas", href: "/bodegas", tone: "warning", icon: <PackageX />,
      title: [wh.low_stock && plural(wh.low_stock, "producto bajo el mínimo", "productos bajo el mínimo"), wh.full.length && plural(wh.full.length, "bodega llena", "bodegas llenas")].filter(Boolean).join(" · "),
      detail: wh.full.slice(0, 2).join(", ") || "Reabastece desde otra bodega",
    });
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

  return [...items.filter((i) => i.tone === "danger"), ...items.filter((i) => i.tone === "warning")];
}

/** Columnas en escritorio según cuántos avisos hay: 4 caben en una fila; desde 5, de a 3. */
const XL_COLS = ["", "xl:grid-cols-1", "xl:grid-cols-2", "xl:grid-cols-3", "xl:grid-cols-4"];
const XL_SPAN = ["", "xl:col-span-1", "xl:col-span-2", "xl:col-span-3"];

/**
 * El último aviso ocupa lo que queda de su fila, así la superficie nunca termina con celdas vacías
 * (antes, 4 avisos en 3 columnas dejaban dos huecos).
 */
function lastSpan(n: number) {
  const xl = n <= 4 ? n : 3;
  const rest = n % xl;
  return cn(n > 1 && n % 2 === 1 && "md:col-span-2", rest ? XL_SPAN[xl - rest + 1] : "xl:col-span-1");
}

/** Filas de alertas (resumen y panel de avisos del dock): ícono del color del estado, título, detalle y destino. */
export function AlertRows({ items, columns = false, onNavigate }: { items: AlertItem[]; columns?: boolean; onNavigate?: () => void }) {
  const n = items.length;
  return (
    <ul className={cn("-mt-px -ml-px grid grid-cols-[minmax(0,1fr)]", columns && n > 1 && "md:grid-cols-2", columns && XL_COLS[n <= 4 ? n : 3])}>
      {items.map((it, i) => (
        <li key={it.key} className={cn("min-w-0 border-t border-l border-border", columns && i === n - 1 && lastSpan(n))}>
          <Link
            href={it.href}
            onClick={onNavigate}
            data-ripple
            className="group/alert flex min-h-16 items-center gap-3.5 px-5 py-3.5 outline-none transition-colors duration-200 hover:bg-[color-mix(in_srgb,var(--card)_96%,var(--foreground))] focus-visible:ring-[3px] focus-visible:ring-ring/80 focus-visible:ring-inset"
          >
            {/* Severidad en el color del ícono (rojo = impide operar, naranja = aviso); sin círculos ni franjas */}
            <span
              className={cn("flex shrink-0 [&_svg]:size-[18px]", it.tone === "danger" ? "text-destructive" : "text-warning")}
              aria-hidden
            >
              {it.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{it.title}</span>
              <span className="block truncate text-[13px] text-muted-foreground">{it.detail}</span>
            </span>
            {it.fresh && (
              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">Nuevo</span>
            )}
            <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover/alert:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Bloque del resumen: lo que requiere una decisión ahora, cada cosa con su destino. */
export function Attention({ alerts }: { alerts: DashboardSummary["alerts"] }) {
  const items = buildAlertItems(alerts);
  if (items.length === 0)
    return (
      <p role="status" className="glass mb-6 flex items-center gap-2.5 rounded-3xl px-5 py-4 text-sm text-muted-foreground">
        <CircleCheck className="size-4 shrink-0 text-success" aria-hidden />
        Todo en orden: sin cierres, envíos sin ruta ni retrasos.
      </p>
    );
  const urgent = items.filter((i) => i.tone === "danger").length;
  return (
    <section aria-labelledby="atencion" className="mb-6">
      <div className="mb-3 flex items-baseline gap-2 px-1">
        <h2 id="atencion" className="text-[0.9375rem] font-semibold">
          Requiere atención
        </h2>
        <span className="tabular text-[13px] text-muted-foreground">
          {urgent > 0 ? `${urgent} ${urgent === 1 ? "urgente" : "urgentes"} · ` : ""}
          {items.length} en total
        </span>
      </div>
      <div className="glass overflow-hidden rounded-3xl">
        <AlertRows items={items} columns />
      </div>
    </section>
  );
}
