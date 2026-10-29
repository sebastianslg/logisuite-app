import { Suspense } from "react";
import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine, FileWarning, PenLine, TriangleAlert } from "lucide-react";

import { PageHeader, Skeleton } from "@/components/page-header";
import { Reveal } from "@/components/reveal";
import { ModeChain } from "@/components/status-badge";
import { AutoRefresh } from "@/components/tracking/auto-refresh";
import { Badge } from "@/components/ui/badge";
import { StatStrip } from "@/components/ui/stat-strip";
import { apiGet } from "@/lib/api";
import type { Mode, TodayBoard, TodayShipment } from "@/lib/types";

export const metadata = { title: "Hoy" };

export default function HoyPage() {
  return (
    <div className="page">
      <PageHeader
        title="Hoy"
        description="Lo que sale, lo que llega y lo que falta cerrar en las próximas 24 horas, en una sola vista. Se actualiza sola cada minuto."
      />
      <Suspense fallback={<Skeleton className="h-[640px]" />}>
        <Board />
      </Suspense>
    </div>
  );
}

/** «en 3 h», «en 40 min», «hace 2 h»: sale de `in_h`, que calcula la API; aquí no se usa el reloj. */
function relative(h: number) {
  const m = Math.round(Math.abs(h) * 60);
  const txt = m < 60 ? `${m} min` : `${Math.round(Math.abs(h))} h`;
  return h >= 0 ? `en ${txt}` : `hace ${txt}`;
}

function clock(iso: string, nowIso: string) {
  const sameDay = iso.slice(0, 10) === nowIso.slice(0, 10);
  const t = iso.slice(11, 16);
  if (sameDay) return t;
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("es-CO", { weekday: "short", day: "numeric" });
  return `${d} · ${t}`;
}

async function Board() {
  const b = await apiGet<TodayBoard>("/api/today");
  const c = b.counts;
  return (
    <>
      <AutoRefresh seconds={60} />
      <Reveal>
        <StatStrip
          className="mb-8"
          items={[
            { label: "Salen", value: c.departures, hint: "Próximas 24 h", href: "#salen" },
            { label: "Llegan", value: c.arrivals, hint: c.late_arrivals ? `${c.late_arrivals} con retraso` : "Sin retrasos", tone: c.late_arrivals ? "warning" : undefined, href: "#llegan" },
            { label: "Por firmar", value: c.to_sign, hint: "Llegaron sin prueba de entrega", tone: c.to_sign ? "accent" : undefined, href: "#firmar" },
            { label: "Incidencias", value: c.incidents, hint: "Últimas 24 h", tone: c.incidents ? "danger" : undefined, href: "#atencion" },
          ]}
        />
      </Reveal>
      <div className="grid gap-6 lg:grid-cols-2">
        <Column index={1} id="salen" title="Salen" icon={<ArrowUpFromLine className="size-4 text-primary" aria-hidden />} empty="Nada sale en las próximas 24 horas.">
          {b.departures.map((s) => (
            <Row key={s.code} s={s} now={b.now} />
          ))}
        </Column>
        <Column index={2} id="llegan" title="Llegan" icon={<ArrowDownToLine className="size-4 text-success" aria-hidden />} empty="Nada llega en las próximas 24 horas.">
          {b.arrivals.map((s) => (
            <Row key={s.code} s={s} now={b.now} />
          ))}
        </Column>
        <Column index={3} id="firmar" title="Por firmar" icon={<PenLine className="size-4 text-primary" aria-hidden />} empty="Todas las entregas de la última semana tienen su firma.">
          {b.to_sign.map((s) => (
            <Row key={s.code} s={s} now={b.now} action="Registrar entrega" />
          ))}
        </Column>
        <Column
          index={4}
          id="atencion"
          title="Requiere atención"
          icon={<TriangleAlert className="size-4 text-warning" aria-hidden />}
          empty="Sin incidencias en el día ni documentos de flota por vencer."
        >
          {b.incidents.map((i, k) => (
            <li key={`i-${k}`}>
              <Link href={`/envios/${encodeURIComponent(i.code)}`} className="row-link flex items-start gap-3 px-5 py-3 text-sm">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{i.kind_label}</span>
                    <span className="font-mono text-xs text-muted-foreground">{i.code}</span>
                    {i.resolved && <Badge tone="success">Resuelta</Badge>}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{i.body}</span>
                </span>
                <span className="tabular shrink-0 text-xs text-muted-foreground">{i.at.slice(11, 16)}</span>
              </Link>
            </li>
          ))}
          {b.fleet_documents.map((d) => (
            <li key={`d-${d.id}-${d.label}`}>
              <Link href={`/flota/${d.id}`} className="row-link flex items-start gap-3 px-5 py-3 text-sm">
                <FileWarning className={`mt-0.5 size-4 shrink-0 ${d.state === "Vencido" ? "text-destructive" : "text-warning"}`} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{d.label}</span> <span className="font-mono text-xs text-muted-foreground">{d.code}</span>
                  <span className="block text-xs text-muted-foreground">
                    {d.state === "Vencido" ? `Venció hace ${-d.days_left} d: el vehículo no puede circular` : d.days_left === 0 ? "Vence hoy" : `Vence en ${d.days_left} d`}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </Column>
      </div>
    </>
  );
}

function Column({ index, id, title, icon, empty, children }: { index: number; id: string; title: string; icon: React.ReactNode; empty: string; children: React.ReactNode }) {
  const items = Array.isArray(children) ? children.flat().filter(Boolean) : children ? [children] : [];
  return (
    <Reveal index={index}>
      <section id={id} aria-labelledby={`${id}-t`} className="glass scroll-mt-28 overflow-hidden rounded-3xl">
        <h2 id={`${id}-t`} className="flex items-center gap-2 px-5 pt-5 pb-3 text-sm font-semibold">
          {icon}
          {title}
          <span className="tabular ml-auto text-xs font-normal text-muted-foreground">{items.length}</span>
        </h2>
        {items.length ? <ul className="rule-list border-t border-border">{children}</ul> : <p className="px-5 pb-5 text-sm text-muted-foreground">{empty}</p>}
      </section>
    </Reveal>
  );
}

function Row({ s, now, action }: { s: TodayShipment; now: string; action?: string }) {
  return (
    <li>
      <Link href={`/envios/${encodeURIComponent(s.code)}`} className="row-link flex min-w-0 items-center gap-3 px-5 py-3 text-sm sm:gap-4">
        <span className="w-16 shrink-0 sm:w-20">
          <span className="tabular block text-base leading-tight font-semibold tracking-[-0.01em]">{clock(s.at, now)}</span>
          <span className="tabular block text-xs text-muted-foreground">{relative(s.in_h)}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="max-w-full min-w-0 truncate font-medium">
              {s.origin} <span className="text-muted-foreground">→</span> {s.destination}
            </span>
            {s.delay_h > 0 && <Badge tone="warning">+{Math.round(s.delay_h)} h</Badge>}
            {s.no_route && <Badge tone="danger">Sin ruta</Badge>}
          </span>
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span className="font-mono">{s.code}</span>
            <span className="max-w-full min-w-0 truncate">{s.cargo}</span>
            {s.vehicle && <span className="font-mono">· {s.vehicle}{s.outsourced ? " (tercero)" : ""}</span>}
          </span>
        </span>
        {action ? (
          <span className="hidden shrink-0 text-xs font-medium text-primary sm:inline">{action}</span>
        ) : (
          <span className="hidden shrink-0 sm:inline">
            <ModeChain modes={s.modes as Mode[]} />
          </span>
        )}
      </Link>
    </li>
  );
}
