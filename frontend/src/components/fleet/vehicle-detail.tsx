"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Archive,
  CalendarPlus,
  CircleCheck,
  LoaderCircle,
  OctagonAlert,
  Pencil,
  Play,
  RotateCcw,
  Trash2,
  TriangleAlert,
  UserRound,
  Warehouse as WarehouseIcon,
  Wrench,
  X,
} from "lucide-react";

import { useApp } from "@/components/providers";
import { Money } from "@/components/money";
import { ModeIcon } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { api } from "@/lib/client";
import type { Fault, FleetCatalog, Maintenance, MaintenanceKind, VehicleDetail } from "@/lib/types";
import { cn } from "@/lib/utils";

import { ErrorBanner, Field, inputClass, textareaClass } from "./form-bits";
import { dateOnly, dt, km, SeverityBadge, ServiceMeter, VehicleStatusBadge } from "./status";

type Reassigned = NonNullable<VehicleDetail["reassigned"]>;

function localInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="glass rounded-3xl p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-2 text-sm last:border-0">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  );
}

type SheetKind = null | "fault" | "maint" | "retire" | "complete" | "resolve";

export function VehicleDetailView({ vehicle: v }: { vehicle: VehicleDetail }) {
  const router = useRouter();
  const { operator } = useApp();
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [maint, setMaint] = useState<Maintenance | null>(null);
  const [fault, setFault] = useState<Fault | null>(null);
  const [fromFault, setFromFault] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Reassigned | null>(null);
  const [catalog, setCatalog] = useState<FleetCatalog | null>(null);

  useEffect(() => {
    api<FleetCatalog>("/api/fleet/catalog").then(setCatalog).catch(() => undefined);
  }, []);

  const close = () => {
    setSheet(null);
    setMaint(null);
    setFault(null);
    setFromFault(null);
    setError(null);
  };

  /** Ejecuta una acción de la API, muestra a qué envíos afectó y refresca la ficha. */
  async function run(key: string, path: string, body: unknown, method: "POST" | "PUT" | "DELETE" = "POST") {
    setBusy(key);
    setError(null);
    try {
      const res = await api<VehicleDetail | { deleted: string }>(path, { method, body: body === undefined ? undefined : body });
      if ("deleted" in res) {
        router.push("/flota");
        router.refresh();
        return true;
      }
      const moved = res.reassigned;
      setNotice(moved && (moved.replaced.length || moved.outsourced.length) ? moved : null);
      close();
      router.refresh();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(null);
    }
  }

  const me = operator || null;
  const openFaults = v.faults.filter((f) => f.status !== "Resuelta");
  const closedFaults = v.faults.filter((f) => f.status === "Resuelta");
  const activeMaint = v.maintenance.filter((m) => m.status === "Programado" || m.status === "En curso").sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start));
  const doneMaint = v.maintenance.filter((m) => m.status === "Completado" || m.status === "Cancelado");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/flota" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" aria-hidden /> Flota
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <ModeIcon mode={v.mode} className="mt-1 size-9" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-mono text-2xl font-semibold tracking-tight">{v.code}</h1>
                <VehicleStatusBadge status={v.status} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {v.vehicle_type}
                {v.make ? ` · ${v.make}` : ""}
                {v.model ? ` ${v.model}` : ""}
                {v.year ? ` · ${v.year}` : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {!v.retired && (
              <>
                <Button variant="secondary" size="sm" onClick={() => setSheet("fault")}>
                  <TriangleAlert /> Reportar falla
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setSheet("maint")}>
                  <CalendarPlus /> Programar mantenimiento
                </Button>
              </>
            )}
            <Button variant="secondary" size="sm" asChild>
              <Link href={`/flota/${v.id}/editar`}><Pencil /> Editar</Link>
            </Button>
            {v.retired ? (
              <Button variant="secondary" size="sm" disabled={busy === "react"} onClick={() => run("react", `/api/fleet/vehicles/${v.id}/reactivate`, { usuario: me })}>
                {busy === "react" ? <LoaderCircle className="animate-spin" /> : <RotateCcw />} Reincorporar
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setSheet("retire")}>
                <Archive /> Dar de baja
              </Button>
            )}
            {v.trips_total === 0 && (
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={busy === "del"}
                onClick={() => { if (window.confirm(`¿Borrar el vehículo ${v.code}? No se puede deshacer.`)) void run("del", `/api/fleet/vehicles/${v.id}?usuario=${encodeURIComponent(operator)}`, undefined, "DELETE"); }}>
                <Trash2 /> Borrar
              </Button>
            )}
          </div>
        </div>
      </div>

      {error && !sheet && <ErrorBanner message={error} />}

      {notice && (
        <div role="status" className="rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm">
          <div className="flex items-start justify-between gap-3">
            <p className="font-medium">Se reasignaron los envíos que llevaba este vehículo</p>
            <button type="button" aria-label="Cerrar aviso" onClick={() => setNotice(null)} className="press text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>
          <ul className="mt-2 flex flex-col gap-1 text-xs">
            {notice.replaced.map((r) => (
              <li key={`${r.shipment_code}-r`}>
                <Link href={`/envios/${r.shipment_code}`} className="font-mono hover:text-primary">{r.shipment_code}</Link>: lo lleva ahora <span className="font-mono font-semibold">{r.to}</span>.
              </li>
            ))}
            {notice.outsourced.map((r) => (
              <li key={`${r.shipment_code}-o`}>
                <Link href={`/envios/${r.shipment_code}`} className="font-mono hover:text-primary">{r.shipment_code}</Link>: no había otro vehículo propio libre; el tramo pasó a un transportista tercero.
              </li>
            ))}
          </ul>
        </div>
      )}

      {(v.blockers.length > 0 || v.warnings.length > 0) && (
        <div className="grid gap-3 md:grid-cols-2">
          {v.blockers.length > 0 && (
            <div className="rounded-2xl bg-destructive/12 p-4">
              <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-destructive">
                <OctagonAlert className="size-4" aria-hidden /> {v.status === "En mantenimiento" ? "En el taller" : "No puede operar"}
              </p>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">{v.blockers.map((b) => <li key={b}>{b}</li>)}</ul>
            </div>
          )}
          {v.warnings.length > 0 && (
            <div className="rounded-2xl bg-warning/12 p-4">
              <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-warning">
                <TriangleAlert className="size-4" aria-hidden /> Atención
              </p>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">{v.warnings.map((b) => <li key={b}>{b}</li>)}</ul>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-6">
          <Section title="Próximo mantenimiento">
            {v.retired ? (
              <p className="text-sm text-muted-foreground">Este vehículo está fuera de la flota.</p>
            ) : (
              <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div>
                  <ServiceMeter service={v.service} />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Vence por lo que ocurra primero: <strong className="text-foreground">{v.service_interval_days} días</strong> o{" "}
                    <strong className="text-foreground">{km(v.service_interval_km)} km</strong> desde el último servicio
                    ({dateOnly(v.service.last_service_at)}). Límite: el {dateOnly(v.service.due_at)} o los {km(v.service.due_km)} km.
                  </p>
                </div>
                <div className="rounded-2xl bg-fill p-3 text-sm">
                  {v.in_maintenance ? (
                    <p><Wrench className="mr-1 inline size-4 text-warning" aria-hidden /> {v.in_maintenance.kind} en curso hasta {dt(v.in_maintenance.end)}.</p>
                  ) : v.next_maintenance ? (
                    <p>
                      <CalendarPlus className="mr-1 inline size-4 text-primary" aria-hidden /> {v.next_maintenance.kind} programado:
                      <br /><span className="font-medium">{dt(v.next_maintenance.start)}</span>
                      {v.next_maintenance.workshop ? <span className="text-muted-foreground"> · {v.next_maintenance.workshop}</span> : null}
                    </p>
                  ) : (
                    <p className="text-muted-foreground">No hay mantenimiento programado.</p>
                  )}
                </div>
              </div>
            )}
          </Section>

          <Section title={`Fallas${openFaults.length ? ` (${openFaults.length} abierta${openFaults.length === 1 ? "" : "s"})` : ""}`}
            action={!v.retired ? <Button variant="ghost" size="sm" onClick={() => setSheet("fault")}><TriangleAlert /> Reportar</Button> : null}>
            {v.faults.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin fallas registradas. Si algo falla, repórtalo aquí: si impide operar, el vehículo se inhabilita y sus envíos pasan a otro.</p>
            ) : (
              <ul className="rule-list -mx-5 -mb-5 border-t border-border">
                {[...openFaults, ...closedFaults].map((f) => (
                  <li key={f.fault_id} className={cn("px-5 py-3.5", f.status === "Resuelta" ? "opacity-80" : f.blocks_operation && "bg-destructive/[0.04]")}>
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityBadge severity={f.severity} />
                      <span className="text-sm font-medium">{f.category}</span>
                      <Badge tone={f.status === "Resuelta" ? "success" : f.status === "En reparación" ? "warning" : "danger"}>{f.status}</Badge>
                      {f.status !== "Resuelta" && !f.blocks_operation && <Badge tone="neutral">Puede operar</Badge>}
                      <span className="ml-auto text-xs text-muted-foreground">{dt(f.reported_at)}{f.reported_by ? ` · ${f.reported_by}` : ""}</span>
                    </div>
                    <p className="mt-1.5 text-sm">{f.description}</p>
                    {f.status === "Resuelta" ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Resuelta el {dt(f.resolved_at)}: {f.resolution}
                        {f.repair_cost_usd ? <> · <Money usd={f.repair_cost_usd} /></> : null}
                      </p>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {f.status === "Abierta" && (
                          <Button size="sm" variant="secondary" onClick={() => { setFromFault(f.fault_id); setSheet("maint"); }}>
                            <Wrench /> Enviar a taller
                          </Button>
                        )}
                        <Button size="sm" variant="secondary" onClick={() => { setFault(f); setSheet("resolve"); }}>
                          <CircleCheck /> Marcar resuelta
                        </Button>
                        {f.severity !== "Crítica" && (
                          <Button size="sm" variant="ghost" disabled={busy === `f${f.fault_id}`}
                            onClick={() => run(`f${f.fault_id}`, `/api/fleet/faults/${f.fault_id}`, { blocks_operation: !f.blocks_operation, usuario: me }, "PUT")}>
                            {f.blocks_operation ? "Autorizar a operar con la falla" : "Volver a inhabilitar"}
                          </Button>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Mantenimientos" action={!v.retired ? <Button variant="ghost" size="sm" onClick={() => setSheet("maint")}><CalendarPlus /> Programar</Button> : null}>
            {v.maintenance.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin mantenimientos registrados.</p>
            ) : (
              <ul className="rule-list -mx-5 -mb-5 border-t border-border">
                {[...activeMaint, ...doneMaint].map((m) => (
                  <li key={m.maint_id} className="px-5 py-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={m.kind === "Correctivo" ? "warning" : "info"}><Wrench aria-hidden />{m.kind}</Badge>
                      <Badge tone={m.status === "En curso" ? "warning" : m.status === "Programado" ? "accent" : m.status === "Completado" ? "success" : "neutral"}>{m.status}</Badge>
                      <span className="tabular ml-auto text-xs text-muted-foreground">{dt(m.scheduled_start)} → {dt(m.scheduled_end)}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {m.workshop ?? "Sin taller"}
                      {m.status === "Completado" ? <> · costó <Money usd={m.cost_usd} />{m.odometer_km ? ` · ${km(m.odometer_km)} km` : ""}</> : m.est_cost_usd ? <> · estimado <Money usd={m.est_cost_usd} /></> : null}
                    </p>
                    {m.notes && <p className="mt-1 text-xs">{m.notes}</p>}
                    {(m.status === "Programado" || m.status === "En curso") && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {m.status === "Programado" && (
                          <Button size="sm" variant="secondary" disabled={busy === `s${m.maint_id}`}
                            onClick={() => run(`s${m.maint_id}`, `/api/fleet/maintenance/${m.maint_id}/start`, { usuario: me })}>
                            {busy === `s${m.maint_id}` ? <LoaderCircle className="animate-spin" /> : <Play />} Iniciar ahora
                          </Button>
                        )}
                        <Button size="sm" variant="secondary" onClick={() => { setMaint(m); setSheet("complete"); }}>
                          <CircleCheck /> Completar
                        </Button>
                        <Button size="sm" variant="ghost" disabled={busy === `c${m.maint_id}`}
                          onClick={() => run(`c${m.maint_id}`, `/api/fleet/maintenance/${m.maint_id}/cancel`, { usuario: me })}>
                          Cancelar
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <div className="flex flex-col gap-6">
          <Section title="Datos del vehículo">
            <dl>
              <Fact label="Capacidad">{v.capacity_t.toLocaleString("es-CO")} t{v.capacity_m3 ? ` · ${v.capacity_m3.toLocaleString("es-CO")} m³` : ""}</Fact>
              <Fact label="Odómetro"><span className="tabular">{km(v.odometer_km)} km</span></Fact>
              <Fact label="Bodega">
                {v.home_warehouse_id ? (
                  <Link href={`/bodegas/${v.home_warehouse_id}`} className="inline-flex items-center gap-1 hover:text-primary">
                    <WarehouseIcon className="size-3.5" aria-hidden />{v.home_name}
                  </Link>
                ) : "Sin bodega"}
              </Fact>
              <Fact label="Conductor">
                {v.driver ? (
                  <span className={cn("block", v.driver.license_days_left < 0 && "text-destructive")}>
                    <span className="inline-flex items-center gap-1"><UserRound className="size-3.5" aria-hidden />{v.driver.name}</span>
                    <span className="block text-xs text-muted-foreground">Licencia {v.driver.license_cat} · vence {dateOnly(v.driver.license_expiry)}</span>
                  </span>
                ) : "Sin conductor"}
              </Fact>
              <Fact label="Viajes registrados"><span className="tabular">{v.trips_total}</span></Fact>
              <Fact label="Gastado en mantenimiento"><Money usd={v.maintenance_cost_usd} /></Fact>
              <Fact label="Origen del dato">{v.source === "usuario" ? "Creado por un usuario" : "Flota simulada"}</Fact>
            </dl>
            {v.notes && <p className="mt-3 rounded-xl bg-fill p-3 text-xs">{v.notes}</p>}
          </Section>

          <Section title="Envíos que lleva">
            {v.trips.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no tiene tramos asignados.</p>
            ) : (
              <ul className="flex flex-col">
                {v.trips.slice(0, 12).map((t) => (
                  <li key={t.assign_id} className="border-b border-border py-2 text-sm last:border-0">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/envios/${t.shipment_code}`} className="font-mono text-xs hover:text-primary">{t.shipment_code}</Link>
                      <Badge tone={t.phase === "En curso" ? "accent" : t.phase === "Próximo" ? "info" : "neutral"}>{t.phase}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t.origin} → {t.destination} · {t.load_t.toLocaleString("es-CO")} t · {dt(t.start_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>

      {/* ---- Hojas de acción ---- */}
      <Sheet open={sheet === "fault"} onClose={close} title="Reportar una falla" description={`${v.code} · ${v.vehicle_type}`}>
        <FaultForm catalog={catalog} busy={busy === "fault"} error={error}
          onSubmit={(b) => run("fault", `/api/fleet/vehicles/${v.id}/faults`, { ...b, usuario: me })} />
      </Sheet>
      <Sheet open={sheet === "maint"} onClose={close} title="Programar mantenimiento" description={`${v.code} · ${v.vehicle_type}`}>
        <MaintForm vehicle={v} catalog={catalog} fromFault={fromFault} busy={busy === "maint"} error={error}
          onSubmit={(b) => run("maint", `/api/fleet/vehicles/${v.id}/maintenance`, { ...b, usuario: me })} />
      </Sheet>
      <Sheet open={sheet === "complete" && !!maint} onClose={close} title="Completar mantenimiento" description={maint ? `${maint.kind} · ${v.code}` : undefined}>
        {maint && (
          <CompleteForm m={maint} busy={busy === "done"} error={error}
            onSubmit={(b) => run("done", `/api/fleet/maintenance/${maint.maint_id}/complete`, { ...b, usuario: me })} />
        )}
      </Sheet>
      <Sheet open={sheet === "resolve" && !!fault} onClose={close} title="Marcar la falla como resuelta" description={fault ? `${fault.category} · ${v.code}` : undefined}>
        {fault && (
          <ResolveForm busy={busy === "resolve"} error={error}
            onSubmit={(b) => run("resolve", `/api/fleet/faults/${fault.fault_id}`, { ...b, status: "Resuelta", usuario: me }, "PUT")} />
        )}
      </Sheet>
      <Sheet open={sheet === "retire"} onClose={close} title="Dar de baja" description={`${v.code} sale de la flota y deja de recibir envíos`}>
        <RetireForm busy={busy === "retire"} error={error}
          onSubmit={(reason) => run("retire", `/api/fleet/vehicles/${v.id}/retire`, { reason, usuario: me })} />
      </Sheet>
    </div>
  );
}

// ---------------------------------------------------------------------------
function Actions({ busy, label, onCancel }: { busy: boolean; label: string; onCancel?: () => void }) {
  return (
    <div className="mt-2 flex items-center gap-2">
      <Button type="submit" disabled={busy}>
        {busy && <LoaderCircle className="animate-spin" />} {label}
      </Button>
      {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>}
    </div>
  );
}

function FaultForm({ catalog, busy, error, onSubmit }: { catalog: FleetCatalog | null; busy: boolean; error: string | null; onSubmit: (b: Record<string, unknown>) => void }) {
  const [severity, setSeverity] = useState("Moderada");
  const [category, setCategory] = useState("Motor");
  const [description, setDescription] = useState("");
  const [blocks, setBlocks] = useState(true);
  const [shipment, setShipment] = useState("");
  const effective = severity === "Crítica" ? true : blocks;
  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); onSubmit({ severity, category, description, blocks_operation: effective, shipment_code: shipment || null }); }}>
      <fieldset>
        <legend className="mb-1 text-xs text-muted-foreground">Gravedad</legend>
        <div className="grid grid-cols-3 gap-2" role="radiogroup">
          {(["Leve", "Moderada", "Crítica"] as const).map((s) => (
            <button key={s} type="button" role="radio" aria-checked={severity === s}
              onClick={() => { setSeverity(s); setBlocks(s !== "Leve"); }}
              className={cn("press rounded-xl border px-3 py-2 text-sm", severity === s ? "border-primary/50 bg-primary/10 font-medium" : "border-border text-muted-foreground")}>
              {s}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Leve: se puede seguir operando. Moderada o crítica: el vehículo se inhabilita y sus envíos pendientes pasan a otro.
        </p>
      </fieldset>
      <Field label="Qué falló">
        <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
          {(catalog?.fault_categories ?? ["Motor", "Frenos", "Llantas", "Otro"]).map((c) => <option key={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="Descripción">
        <textarea className={textareaClass} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} placeholder="Qué pasó, cuándo y en qué condiciones" />
      </Field>
      <label className={cn("flex items-start gap-2 text-sm", severity === "Crítica" && "opacity-70")}>
        <input type="checkbox" className="mt-1" checked={effective} disabled={severity === "Crítica"} onChange={(e) => setBlocks(e.target.checked)} />
        <span>
          Impide operar
          {severity === "Crítica" && <span className="block text-xs text-muted-foreground">Una falla crítica siempre inhabilita el vehículo.</span>}
        </span>
      </label>
      <Field label="Envío que llevaba al fallar (opcional)">
        <input className={inputClass} value={shipment} onChange={(e) => setShipment(e.target.value)} placeholder="LS-2610-0001" maxLength={30} />
      </Field>
      <ErrorBanner message={error} />
      <Actions busy={busy} label="Reportar falla" />
    </form>
  );
}

function MaintForm({ vehicle, catalog, fromFault, busy, error, onSubmit }: {
  vehicle: VehicleDetail; catalog: FleetCatalog | null; fromFault: number | null; busy: boolean; error: string | null;
  onSubmit: (b: Record<string, unknown>) => void;
}) {
  const [kind, setKind] = useState<MaintenanceKind>(fromFault ? "Correctivo" : "Preventivo");
  const [start, setStart] = useState(() => { const d = new Date(Date.now() + 24 * 3600_000); d.setHours(8, 0, 0, 0); return localInput(d); });
  const [hours, setHours] = useState("8");
  const [workshop, setWorkshop] = useState("");
  const [cost, setCost] = useState("0");
  const [notes, setNotes] = useState("");
  const open = vehicle.faults.filter((f) => f.status !== "Resuelta");
  const [faultId, setFaultId] = useState(fromFault ? String(fromFault) : "");
  const shops = catalog?.workshops?.[vehicle.mode] ?? [];
  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); onSubmit({ kind, scheduled_start: start, duration_h: hours, workshop, est_cost_usd: cost, notes, fault_id: faultId || null }); }}>
      <Field label="Tipo">
        <select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as MaintenanceKind)}>
          {(["Preventivo", "Correctivo", "Inspección"] as const).map((k) => <option key={k}>{k}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Inicio"><input type="datetime-local" className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} /></Field>
        <Field label="Duración (h)"><input className={inputClass} inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} /></Field>
      </div>
      <Field label="Taller" hint="Mientras dure, el vehículo no recibe envíos y los que se crucen pasan a otro.">
        <input className={inputClass} list="talleres" value={workshop} onChange={(e) => setWorkshop(e.target.value)} maxLength={80} />
      </Field>
      <datalist id="talleres">{shops.map((s) => <option key={s} value={s} />)}</datalist>
      <Field label="Costo estimado (USD)"><input className={inputClass} inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
      {open.length > 0 && (
        <Field label="Falla que atiende (opcional)">
          <select className={inputClass} value={faultId} onChange={(e) => setFaultId(e.target.value)}>
            <option value="">Ninguna</option>
            {open.map((f) => <option key={f.fault_id} value={f.fault_id}>{f.severity} · {f.category} · {f.description.slice(0, 40)}</option>)}
          </select>
        </Field>
      )}
      <Field label="Notas"><textarea className={textareaClass} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} /></Field>
      <ErrorBanner message={error} />
      <Actions busy={busy} label="Programar" />
    </form>
  );
}

function CompleteForm({ m, busy, error, onSubmit }: { m: Maintenance; busy: boolean; error: string | null; onSubmit: (b: Record<string, unknown>) => void }) {
  const [cost, setCost] = useState(String(m.est_cost_usd || ""));
  const [notes, setNotes] = useState("");
  const [resets, setResets] = useState(m.kind !== "Correctivo");
  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); onSubmit({ cost_usd: cost, notes, resets_service: resets }); }}>
      <Field label="Costo final (USD)"><input className={inputClass} inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
      <Field label="Trabajo realizado"><textarea className={textareaClass} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} /></Field>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={resets} onChange={(e) => setResets(e.target.checked)} />
        <span>Reinicia el contador de mantenimiento<span className="block text-xs text-muted-foreground">Los días y los km para el siguiente servicio vuelven a empezar desde hoy.</span></span>
      </label>
      {m.fault_id && <p className="rounded-xl bg-fill p-3 text-xs">Este mantenimiento atiende una falla: al completarlo, la falla se marca como resuelta y el vehículo vuelve a poder operar.</p>}
      <ErrorBanner message={error} />
      <Actions busy={busy} label="Completar" />
    </form>
  );
}

function ResolveForm({ busy, error, onSubmit }: { busy: boolean; error: string | null; onSubmit: (b: Record<string, unknown>) => void }) {
  const [resolution, setResolution] = useState("");
  const [cost, setCost] = useState("");
  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); onSubmit({ resolution, repair_cost_usd: cost || null }); }}>
      <Field label="Qué se hizo"><textarea className={textareaClass} value={resolution} onChange={(e) => setResolution(e.target.value)} maxLength={300} /></Field>
      <Field label="Costo de la reparación (USD)"><input className={inputClass} inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
      <ErrorBanner message={error} />
      <Actions busy={busy} label="Marcar resuelta" />
    </form>
  );
}

function RetireForm({ busy, error, onSubmit }: { busy: boolean; error: string | null; onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); onSubmit(reason); }}>
      <Field label="Motivo de la baja" hint="Sus envíos pendientes pasarán a otro vehículo. Se puede reincorporar después.">
        <textarea className={textareaClass} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="Siniestro, venta, fin de vida útil…" />
      </Field>
      <ErrorBanner message={error} />
      <Actions busy={busy} label="Dar de baja" />
    </form>
  );
}
