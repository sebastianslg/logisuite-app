"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRightLeft,
  CircleOff,
  Clock,
  CircleDollarSign,
  FileCheck2,
  History,
  LoaderCircle,
  Pencil,
  Route,
  Trash2,
  Weight,
} from "lucide-react";

import { Map3DLazy, MapLoading } from "@/components/map/map-3d-lazy";
import { useMapData } from "@/components/map/use-map-data";
import { useApp } from "@/components/providers";
import { ExportActions } from "@/components/shipments/export-actions";
import { ModeChain, ModeIcon, StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client";
import { requiredDocuments } from "@/lib/documents";
import { MODES, PRIORITIES } from "@/lib/modes";
import type { AuditEntry, Mode, RouteResult, Shipment } from "@/lib/types";

const SOURCE: Record<Shipment["source"], string> = {
  seed: "Carga inicial",
  auto: "Reposición automática",
  manual: "Creado por usuario",
};

function dt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
}

export function ShipmentDetail({ shipment: s, history }: { shipment: Shipment; history: AuditEntry[] }) {
  const router = useRouter();
  const { money, operator } = useApp();
  const { network, departments } = useMapData();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const legs = s.legs ?? [];
  const transfers = s.transfers ?? [];
  const legsCost = legs.reduce((a, l) => a + l.cost, 0);
  const transfersCost = transfers.reduce((a, t) => a + t.cost, 0);
  const docs = requiredDocuments(legs.map((l) => l.mode));

  // El mapa dibuja la ruta del envío con el mismo formato del simulador
  const route = s.trip ? ({ ...s, legs, transfers, trip: s.trip } as unknown as RouteResult) : null;

  async function remove() {
    if (!window.confirm(`¿Borrar el envío ${s.code}? Queda registrado en el historial y no se puede deshacer.`)) return;
    setDeleting(true);
    setError(null);
    try {
      await api(`/api/shipments/${encodeURIComponent(s.code)}?usuario=${encodeURIComponent(operator)}`, {
        method: "DELETE",
      });
      router.push("/envios");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/envios" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Envíos
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-2xl font-semibold tracking-tight">{s.code}</h1>
              <StatusBadge status={s.status} />
              {s.route_status === "sin_ruta" && (
                <Badge tone="rose">
                  <CircleOff />
                  Sin ruta
                </Badge>
              )}
              <Badge tone="neutral">{SOURCE[s.source]}</Badge>
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {s.origin} → {s.destination} · {s.cargo} · {s.client}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" asChild>
              <Link href={`/envios/${s.code}/editar`}>
                <Pencil />
                Editar
              </Link>
            </Button>
            <Button variant="ghost" size="sm" className="text-neon-rose hover:text-neon-rose" onClick={remove} disabled={deleting}>
              {deleting ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
              Borrar
            </Button>
          </div>
        </div>
        {error && <p className="mt-2 text-sm text-neon-rose">{error}</p>}
        {s.route_note && (
          <p
            className={`mt-3 rounded-md border px-3 py-2 text-sm ${
              s.route_status === "sin_ruta"
                ? "border-neon-rose/25 bg-neon-rose/10 text-neon-rose"
                : "border-neon-amber/25 bg-neon-amber/10 text-neon-amber"
            }`}
          >
            {s.route_note}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi icon={<Clock />} label="Tiempo de ruta" value={s.time_fmt} hint={`ETA ${s.eta_fmt}${s.delay_fmt ? ` · +${s.delay_fmt}` : ""}`} />
        <Kpi icon={<CircleDollarSign />} label="Costo total" value={money(s.cost)} hint={`${money(s.cost / s.weight_t)} por t`} />
        <Kpi icon={<Route />} label="Distancia" value={s.distance_fmt} hint={`${Math.round(s.progress_pct)} % recorrido`} />
        <Kpi icon={<Weight />} label="Carga" value={s.weight_fmt} hint={PRIORITIES[s.priority]} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="flex flex-col gap-6">
          <div className="relative h-[380px] overflow-hidden rounded-lg border border-border">
            {network && departments ? (
              <Map3DLazy network={network} departments={departments} route={route} showFleet={false} />
            ) : (
              <MapLoading />
            )}
          </div>

          <Card title="Tramos y transbordos" icon={<ModeChain modes={s.modes} />}>
            <ol className="flex flex-col gap-1.5">
              {legs.map((l, i) => (
                <li key={i} className="flex flex-col gap-1.5">
                  <div className="flex gap-3 rounded-md border border-white/[0.05] bg-white/[0.02] p-3">
                    <ModeIcon mode={l.mode} />
                    <div className="min-w-0 flex-1 text-xs">
                      <div className="flex flex-wrap items-center gap-2 font-medium">
                        {l.from.name} → {l.to.name}
                        {l.interrupted && <Badge tone="rose">Interrumpido</Badge>}
                        {l.detour && <Badge tone="amber">Retorno</Badge>}
                      </div>
                      <div className="text-[11px] text-muted-foreground">{l.corridors.join(" · ")}</div>
                      <div className="tabular mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-300">
                        <span>{l.distance_fmt}</span>
                        <span>{l.time_fmt}</span>
                        <span>{money(l.cost)}</span>
                        {l.asset && (
                          <span className="text-muted-foreground">
                            {l.asset.type} {l.asset.id} · {l.asset.carrier}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {transfers
                    .filter((t) => t.start_h >= l.end_h - 1e-6 && (i + 1 >= legs.length || t.start_h < legs[i + 1].start_h))
                    .map((t, k) => (
                      <div key={k} className="flex items-center gap-2 py-0.5 pl-3 text-[11px] text-neon-amber">
                        <ArrowRightLeft className="size-3.5" />
                        <span className="font-medium">{t.label}</span>
                        <span className="text-muted-foreground">
                          {t.node.name} · {t.time_fmt} · {money(t.cost)}
                        </span>
                      </div>
                    ))}
                </li>
              ))}
            </ol>
          </Card>
        </section>

        <aside className="flex flex-col gap-6">
          <Card title="Exportar">
            <ExportActions codes={[s.code]} />
          </Card>

          <Card title="Costos">
            <dl className="tabular flex flex-col gap-1.5 text-xs">
              <Row k="Fletes por tramo" v={money(legsCost)} />
              <Row k="Manipulación en transbordos" v={money(transfersCost)} />
              <Row k="Total" v={money(legsCost + transfersCost)} strong />
            </dl>
          </Card>

          <Card title="Datos del envío">
            <dl className="flex flex-col gap-1.5 text-xs">
              <Row k="Salida" v={dt(s.departure_at)} />
              <Row k="ETA planeado" v={dt(s.eta_at)} />
              <Row k="Retraso" v={s.delay_fmt ?? "Sin retraso"} />
              <Row k="Transbordos" v={String(s.n_transfers)} />
              <Row k="Modos forzados" v={s.forced_modes.length ? s.forced_modes.map((m: Mode) => MODES[m].label).join(", ") : "Ninguno"} />
              <Row k="Vías forzadas" v={s.forced_corridors.length ? s.forced_corridors.join(", ") : "Ninguna"} />
              <Row k="Creado por" v={s.created_by ?? (s.source === "manual" ? "—" : "Sistema")} />
              {s.updated_by && <Row k="Última edición" v={`${s.updated_by} · ${dt(s.updated_at)}`} />}
            </dl>
          </Card>

          <Card title="Documentos requeridos" icon={<FileCheck2 className="size-3.5 text-muted-foreground" />}>
            <ul className="flex flex-col gap-1 text-xs">
              {docs.map((d) => (
                <li key={d.doc} className="flex justify-between gap-3">
                  <span>{d.doc}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {d.scope in MODES ? MODES[d.scope as Mode].label : d.scope}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-muted-foreground">Referencia según los modos de la ruta. LogiSuite no los emite.</p>
          </Card>

          <Card title="Historial" icon={<History className="size-3.5 text-muted-foreground" />}>
            {history.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin cambios registrados.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-xs">
                {history.map((h) => (
                  <li key={h.audit_id} className="border-l border-white/10 pl-3">
                    <div className="text-muted-foreground">
                      {dt(h.timestamp)} · <span className="text-foreground">{h.username}</span>
                    </div>
                    <div>{h.detail}</div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">{title}</h2>
        {icon}
      </header>
      {children}
    </section>
  );
}

function Kpi({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5">
        {icon}
        {label}
      </div>
      <div className="tabular mt-2 text-xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className={strong ? "font-semibold" : "text-right"}>{v}</dd>
    </div>
  );
}
