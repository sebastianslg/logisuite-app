"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRightLeft, CircleOff, CopyPlus, Leaf, FileCheck2, FileSignature, History, ListTree, LoaderCircle, Maximize2, PackageCheck, Paperclip, Pencil, Printer, Trash2 } from "lucide-react";

import { LayoutGroup, motion, useInView, useReducedMotion } from "framer-motion";

import { Map3DLazy, MapLoading } from "@/components/map/map-3d-lazy";
import { MapFrame } from "@/components/map/map-frame";
import { useMapData } from "@/components/map/use-map-data";
import { useApp } from "@/components/providers";
import { ActualCost } from "@/components/shipments/actual-cost";
import { DeliveryProof } from "@/components/shipments/delivery-proof";
import { LegVehicle } from "@/components/shipments/leg-vehicle";
import { TrackingLinks } from "@/components/shipments/tracking-links";
import { ExportActions } from "@/components/shipments/export-actions";
import { SharedCode } from "@/components/shipments/shared-code";
import { ShipmentAttachments } from "@/components/shipments/shipment-attachments";
import { ShipmentJournal } from "@/components/shipments/shipment-journal";
import { RouteChain } from "@/components/shipments/route-chain";
import { ModeChain, ModeIcon, StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatStrip } from "@/components/ui/stat-strip";
import { CollapsiblePanel } from "@/components/ui/collapsible-panel";
import { CountUp } from "@/components/ui/count-up";
import { Dial } from "@/components/ui/dial";
import { api } from "@/lib/client";
import { requiredDocuments } from "@/lib/documents";
import { MODES, PRIORITIES } from "@/lib/modes";
import { EASE } from "@/lib/motion";
import type { Attachment, AuditEntry, DeliveryInfo, Mode, RouteResult, Shipment, ShipmentEvent } from "@/lib/types";

const SOURCE: Record<Shipment["source"], string> = {
  seed: "Carga inicial",
  auto: "Reposición automática",
  manual: "Creado por usuario",
};

function dt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }).replace(/\s/g, " ");
}

export function ShipmentDetail({
  shipment: s,
  history,
  events,
  attachments,
  delivery,
}: {
  shipment: Shipment;
  history: AuditEntry[];
  events: ShipmentEvent[];
  attachments: Attachment[];
  delivery: DeliveryInfo | null;
}) {
  const router = useRouter();
  const { money, operator } = useApp();
  const { network, departments } = useMapData({ fleet: false });
  // El mapa 3D se monta después de que el detalle ya se pintó: así la página responde y la transición del guardado termina.
  const [mapReady, setMapReady] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setMapReady(true), 300);
    return () => window.clearTimeout(id);
  }, []);
  const [deleting, setDeleting] = useState(false);
  const [mapFull, setMapFull] = useState(false);
  const exitMapFull = useCallback(() => setMapFull(false), []);
  const [error, setError] = useState<string | null>(null);
  const legs = s.legs ?? [];
  const transfers = s.transfers ?? [];
  const legsCost = legs.reduce((a, l) => a + l.cost, 0);
  const transfersCost = transfers.reduce((a, t) => a + t.cost, 0);
  const fletes = legs.reduce((a, l) => a + l.base_cost, 0);
  const peajes = legs.reduce((a, l) => a + l.toll_cost, 0);
  const manipulacion = transfers.reduce((a, t) => a + t.base_cost, 0);
  const impuestos = legs.reduce((a, l) => a + l.tax_cost, 0) + transfers.reduce((a, t) => a + t.tax_cost, 0);
  const docs = requiredDocuments(legs.map((l) => l.mode));
  const fp = s.footprint;

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
              <SharedCode code={s.code} className="font-mono text-[1.75rem] leading-tight font-semibold tracking-[-0.02em] md:text-[2.25rem]" />
              <StatusBadge status={s.status} />
              {s.route_status === "sin_ruta" && (
                <Badge tone="danger">
                  <CircleOff />
                  Sin ruta
                </Badge>
              )}
              <Badge tone="neutral">{SOURCE[s.source]}</Badge>
            </div>
            <p className="mt-2 text-[1.0625rem] font-medium tracking-[-0.01em]">
              {s.origin} <span className="text-muted-foreground">→</span> {s.destination}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {s.cargo} · {s.client}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              <Printer />
              Imprimir
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <a href={`/api/shipments/${encodeURIComponent(s.code)}/remesa`} target="_blank" rel="noopener" title="Remesa de carga para imprimir y firmar en el cargue">
                <FileSignature />
                Remesa
              </a>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link
                href={`/envios/nuevo?origin=${encodeURIComponent(s.origin)}&destination=${encodeURIComponent(s.destination)}&priority=${s.priority}&weight=${s.weight_t}`}
              >
                <CopyPlus />
                Duplicar
              </Link>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link href={`/envios/${s.code}/editar`}>
                <Pencil />
                Editar
              </Link>
            </Button>
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={remove} disabled={deleting}>
              {deleting ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
              Borrar
            </Button>
          </div>
        </div>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        {s.route_note && (
          <p
            className={`mt-3 rounded-md border px-3 py-2 text-sm ${
              s.route_status === "sin_ruta"
                ? "border-destructive/25 bg-destructive/10 text-destructive"
                : "border-warning/25 bg-warning/10 text-warning"
            }`}
          >
            {s.route_note}
          </p>
        )}
      </div>

      <StatStrip
        items={[
          { label: "Tiempo de ruta", value: s.time_fmt, hint: `ETA ${s.eta_fmt}${s.delay_fmt ? ` · +${s.delay_fmt}` : ""}`, tone: s.delay_fmt ? "danger" : undefined },
          { label: "Costo total", value: money(s.cost), hint: `${money(s.cost / s.weight_t)} por t` },
          { label: "Distancia", value: s.distance_fmt, hint: `${Math.round(s.progress_pct)} % recorrido` },
          { label: "Carga", value: s.weight_fmt, hint: `Prioridad: ${PRIORITIES[s.priority].toLowerCase()}` },
        ]}
      />

      <section aria-label="Ruta del envío" className="glass rounded-3xl p-5">
        <RouteChain legs={legs} transfers={transfers} progressPct={s.progress_pct} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="flex flex-col gap-6">
          <div className="relative h-[400px]" data-print="hide">
            <MapFrame full={mapFull} onExit={exitMapFull} radius={28} className="relative h-full border border-border">
              {network && departments && mapReady ? (
                <Map3DLazy network={network} departments={departments} route={route} showFleet={false} live={mapFull} />
              ) : (
                <MapLoading />
              )}
              {!mapFull && (
                <Button
                  variant="secondary"
                  size="icon"
                  className="floating absolute top-3 right-3 z-10"
                  aria-label="Mapa a pantalla completa"
                  title="Pantalla completa"
                  onClick={() => setMapFull(true)}
                >
                  <Maximize2 />
                </Button>
              )}
            </MapFrame>
          </div>

          <Card title="Tramos y transbordos" icon={<ModeChain modes={s.modes} />} collapsible>
            <ol className="rule-list -mx-5 -mb-5 border-t border-border">
              {legs.map((l, i) => (
                <li key={i} className="flex flex-col gap-1.5 px-5 py-4">
                  <div className="flex gap-3">
                    <ModeIcon mode={l.mode} />
                    <div className="min-w-0 flex-1 text-xs">
                      <div className="flex flex-wrap items-center gap-2 font-medium">
                        {l.from.name} → {l.to.name}
                        {l.interrupted && <Badge tone="danger">Interrumpido</Badge>}
                        {l.detour && <Badge tone="warning">Retorno</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">{l.corridors.join(" · ")}</div>
                      <div className="tabular mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground/80">
                        <span>{l.distance_fmt}</span>
                        <span>{l.time_fmt}</span>
                        <span>{money(l.cost)}</span>
                        {fp?.per_leg[i] && <span>{fp.per_leg[i].co2e_kg.toLocaleString("es-CO")} kg CO₂e</span>}
                        {fp?.per_leg[i] && <span>{fp.per_leg[i].fuel_l.toLocaleString("es-CO")} L</span>}
                        {l.asset && (
                          <span className="text-muted-foreground">
                            {l.asset.own && l.asset.vehicle_ids?.length ? (
                              <>
                                {l.asset.type}{" "}
                                {l.asset.vehicle_ids.map((vid, k) => (
                                  <span key={vid}>
                                    {k > 0 && ", "}
                                    <Link href={`/flota/${vid}`} className="font-mono text-foreground hover:text-primary">
                                      {l.asset?.plates?.[k] ?? vid}
                                    </Link>
                                  </span>
                                ))}{" "}
                                · {l.asset.carrier}
                              </>
                            ) : (
                              <>{l.asset.type} {l.asset.id} · {l.asset.carrier}{l.asset.outsourced ? " (tercero)" : ""}</>
                            )}
                          </span>
                        )}
                        {s.status !== "Entregado" && s.route_status !== "sin_ruta" && (
                          <LegVehicle code={s.code} legIndex={i} pinned={l.asset?.pinned} />
                        )}
                      </div>
                    </div>
                  </div>
                  {transfers
                    .filter((t) => t.start_h >= l.end_h - 1e-6 && (i + 1 >= legs.length || t.start_h < legs[i + 1].start_h))
                    .map((t, k) => (
                      <div key={k} className="flex items-center gap-2 py-0.5 pl-3 text-xs text-warning">
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

          <Card title="Bitácora" icon={<ListTree className="size-3.5 text-muted-foreground" aria-hidden />}>
            <ShipmentJournal shipment={s} initial={events} />
          </Card>
        </section>

        <LayoutGroup id="detail-aside">
        <aside className="flex flex-col gap-6">
          <div className="print:hidden">
            <Card title="Exportar">
              <ExportActions codes={[s.code]} />
            </Card>
          </div>

          <Card title="Prueba de entrega" icon={<PackageCheck className="size-3.5 text-muted-foreground" aria-hidden />}>
            <DeliveryProof code={s.code} initial={delivery} />
          </Card>

          <Card title="Documentos adjuntos" icon={<Paperclip className="size-3.5 text-muted-foreground" aria-hidden />}>
            <ShipmentAttachments code={s.code} initial={attachments} />
          </Card>

          <Card title="Costos" collapsible>
            <CostBars
              money={(n) => money(n)}
              total={legsCost + transfersCost}
              parts={[
                { k: "Fletes por tramo", v: fletes },
                { k: "Peajes", v: peajes },
                { k: "Manipulación en transbordos", v: manipulacion },
                { k: "Impuestos (IVA e ICA)", v: impuestos },
              ]}
            />
          </Card>

          <Card title="Seguimiento para el cliente" collapsible>
            <TrackingLinks code={s.code} />
          </Card>

          <Card title="Costo real">
            <ActualCost shipment={s} />
          </Card>

          {fp && (
            <Card title="Huella" icon={<Leaf className="size-3.5 text-success" aria-hidden />}>
              <div className="flex items-center gap-4">
                <Dial
                  value={Math.max(fp.saved_vs_road_pct, 0)}
                  color="var(--sys-green)"
                  label="Reducción de CO₂e frente a mover esta carga por carretera"
                  sublabel="menos que por carretera"
                  size={112}
                  stroke={10}
                />
                <dl className="tabular flex flex-1 flex-col gap-1.5 text-xs">
                  <Row k="CO₂e" v={`${fp.co2e_kg.toLocaleString("es-CO")} kg`} strong />
                  <Row k="Combustible" v={`${fp.fuel_l.toLocaleString("es-CO")} L`} />
                  <Row k="Por carretera" v={`${fp.baseline_co2e_kg.toLocaleString("es-CO")} kg`} />
                  <Row k="Intensidad" v={`${fp.intensity_g_tkm.toLocaleString("es-CO")} g/t-km`} />
                </dl>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Estimación por factores por modo; no es un inventario certificado.</p>
            </Card>
          )}

          <Card title="Datos del envío" collapsible>
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

          <Card title="Documentos requeridos" icon={<FileCheck2 className="size-3.5 text-muted-foreground" />} collapsible>
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
            <p className="mt-2 text-xs text-muted-foreground">Referencia según los modos de la ruta. Westvane no los emite.</p>
          </Card>

          <Card title="Historial" icon={<History className="size-3.5 text-muted-foreground" />} collapsible>
            {history.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin cambios registrados.</p>
            ) : (
              <ol className="flex flex-col text-xs">
                {history.map((h, i) => (
                  <li key={h.audit_id} className="relative pb-4 pl-5 last:pb-0">
                    {i < history.length - 1 && (
                      // Trazo de la línea de tiempo: se dibuja de arriba hacia abajo al entrar en pantalla (scaleY)
                      <motion.span
                        aria-hidden
                        className="absolute top-3 bottom-0 left-[5px] w-px origin-top bg-border-strong"
                        initial={{ scaleY: 0 }}
                        whileInView={{ scaleY: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, ease: EASE, delay: Math.min(i * 0.08, 0.4) }}
                      />
                    )}
                    <span
                      aria-hidden
                      className={`absolute top-1 left-0 size-[11px] rounded-full ${ACTION_DOT[h.action] ?? "bg-muted-foreground"}`}
                    />
                    <div className="text-muted-foreground">
                      {dt(h.timestamp)} · <span className="text-foreground">{h.username}</span>
                      <span className="ml-1.5 rounded-full bg-muted px-1.5 py-px text-[10px] uppercase tracking-wide">
                        {ACTION_LABEL[h.action] ?? h.action}
                      </span>
                    </div>
                    <div className="mt-0.5">{h.detail}</div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </aside>
        </LayoutGroup>
      </div>
    </div>
  );
}

const ACTION_DOT: Record<string, string> = {
  INSERT: "bg-success",
  CREATE: "bg-success",
  UPDATE: "bg-primary",
  DELETE: "bg-destructive",
  CLOSE: "bg-warning",
  REOPEN: "bg-success",
  EXPORT: "bg-muted-foreground",
  REVOKE: "bg-destructive",
  IMPORT: "bg-primary",
};

const ACTION_LABEL: Record<string, string> = {
  INSERT: "Creado",
  CREATE: "Creado",
  UPDATE: "Editado",
  DELETE: "Borrado",
  CLOSE: "Cerrado",
  REOPEN: "Abierto",
  EXPORT: "Exportado",
  REVOKE: "Revocado",
  IMPORT: "Importado",
};

function Card({
  title,
  icon,
  collapsible = false,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  collapsible?: boolean;
  children: React.ReactNode;
}) {
  return (
    <CollapsiblePanel title={title} icon={icon} collapsible={collapsible}>
      {children}
    </CollapsiblePanel>
  );
}

/**
 * Desglose de costos: una barra por componente, proporcional al total, que crece con `scaleX` al entrar en
 * pantalla (no al cargar fuera de vista) y una cifra que cuenta a la derecha.
 */
function CostBars({ parts, total, money }: { parts: { k: string; v: number }[]; total: number; money: (usd: number) => string }) {
  const ref = useRef<HTMLDivElement>(null);
  // Crecen al entrar en pantalla, no al cargar fuera de vista (con "reducir movimiento", ya llenas)
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduced = useReducedMotion();
  const grown = inView || !!reduced;
  return (
    <div ref={ref} className="flex flex-col gap-3 text-xs">
      {parts.map(({ k, v }, i) => {
        const pct = total > 0 ? Math.max(0, Math.min(1, v / total)) : 0;
        return (
          <div key={k}>
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-muted-foreground">{k}</span>
              {grown ? (
                <CountUp value={v} format={money} delay={i * 0.08} duration={0.6} className="tabular font-medium" />
              ) : (
                <span className="tabular font-medium">{money(v)}</span>
              )}
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-fill" aria-hidden>
              <motion.div
                className="h-full w-full origin-left rounded-full bg-primary"
                initial={false}
                animate={{ scaleX: grown ? pct : 0 }}
                transition={{ duration: 0.6, ease: EASE, delay: i * 0.08 }}
              />
            </div>
          </div>
        );
      })}
      <div className="tabular flex items-baseline justify-between gap-4 border-t border-border pt-3 text-sm">
        <span className="font-medium">Total</span>
        <span className="font-semibold">{money(total)}</span>
      </div>
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
