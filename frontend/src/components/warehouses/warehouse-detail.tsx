"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRightLeft,
  LoaderCircle,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  Truck,
  User,
} from "lucide-react";

import { ErrorBanner, Field, inputClass, textareaClass } from "@/components/fleet/form-bits";
import { VehicleStatusBadge } from "@/components/fleet/status";
import { Money } from "@/components/money";
import { useApp } from "@/components/providers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { api } from "@/lib/client";
import type { MovementKind, StockItem, Warehouse, WarehouseDetail } from "@/lib/types";
import { cn } from "@/lib/utils";

import { Capabilities, n0, n1, OccupancyBar, RoleIcon, StockStateBadge, WarehouseStatusBadge } from "./status";

const dt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }).replace(/\s/g, " ") : "—");

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

function Kpi({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="tabular mt-1 text-xl font-semibold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

type SheetKind = null | "move" | "item" | "transfer";
const KINDS: { key: Extract<MovementKind, "Entrada" | "Salida" | "Merma" | "Ajuste">; help: string }[] = [
  { key: "Entrada", help: "Llega mercancía a la bodega." },
  { key: "Salida", help: "Sale mercancía hacia un cliente o una tienda." },
  { key: "Merma", help: "Se pierde o se daña: baja del inventario." },
  { key: "Ajuste", help: "Conteo físico: fija la cantidad real." },
];

export function WarehouseDetailView({ warehouse: w }: { warehouse: WarehouseDetail }) {
  const router = useRouter();
  const { operator } = useApp();
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [item, setItem] = useState<StockItem | null>(null);
  const [kind, setKind] = useState<(typeof KINDS)[number]["key"]>("Entrada");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [others, setOthers] = useState<Warehouse[]>([]);

  useEffect(() => {
    api<{ items: Warehouse[] }>("/api/warehouses")
      .then((d) => setOthers(d.items.filter((x) => x.warehouse_id !== w.warehouse_id && x.status !== "Cerrada")))
      .catch(() => undefined);
  }, [w.warehouse_id]);

  const me = operator || null;
  const close = () => { setSheet(null); setItem(null); setError(null); };

  async function run(key: string, path: string, body: unknown, method: "POST" | "PUT" | "DELETE" = "POST", message?: string) {
    setBusy(key);
    setError(null);
    try {
      const res = await api<Record<string, unknown>>(path, { method, body: body === undefined ? undefined : body });
      if ("deleted" in res) {
        router.push("/bodegas");
        router.refresh();
        return;
      }
      setNotice(message ?? null);
      close();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const byCategory = [...new Set(w.stock.map((s) => s.category))];
  const lowCount = w.stock.filter((s) => s.state === "Bajo").length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/bodegas" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" aria-hidden /> Bodegas
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-1 grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><RoleIcon role={w.role} className="size-5" /></span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">{w.name}</h1>
                <WarehouseStatusBadge status={w.status} />
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                <span className="font-mono">{w.code}</span>
                <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" aria-hidden />{w.city}</span>
                <Badge tone="accent">{w.role_label}</Badge>
                <Capabilities w={w} />
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => { setSheet("item"); }}><Plus /> Nuevo producto</Button>
            <Button variant="secondary" size="sm" asChild>
              <Link href={`/bodegas/${w.warehouse_id}/editar`}><Pencil /> Editar</Link>
            </Button>
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={busy === "del"}
              onClick={() => { if (window.confirm(`¿Borrar la bodega ${w.name}? Debe estar sin inventario ni vehículos.`)) void run("del", `/api/warehouses/${w.warehouse_id}?usuario=${encodeURIComponent(operator)}`, undefined, "DELETE"); }}>
              <Trash2 /> Borrar
            </Button>
          </div>
        </div>
      </div>

      {error && !sheet && <ErrorBanner message={error} />}
      {notice && <p role="status" className="rounded-2xl border border-success/30 bg-success/10 p-3 text-sm">{notice}</p>}

      {w.alerts.length > 0 && (
        <div className="rounded-2xl bg-warning/12 p-4">
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">{w.alerts.map((a) => <li key={a}>{a}</li>)}</ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Ocupación" value={<>{n1(w.occupancy_pct)} %</>} hint={`${n0(w.used_m3)} de ${n0(w.capacity_m3)} m³`} />
        <Kpi label="Productos" value={w.stock_lines} hint={lowCount ? `${lowCount} bajo el mínimo` : "Todos en nivel normal"} />
        <Kpi label="Valor del inventario" value={<Money usd={w.value_usd} />} />
        <Kpi label="Vehículos / en tránsito" value={`${w.vehicles} / ${w.in_transit}`} hint={`${w.docks} muelles`} />
      </div>
      <OccupancyBar pct={w.occupancy_pct} label={false} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-6">
          <Section title={`Inventario (${w.stock.length})`}>
            {w.stock.length === 0 ? (
              <p className="text-sm text-muted-foreground">Esta bodega no guarda nada todavía. Agrega un producto para empezar: {w.stores}.</p>
            ) : (
              <div className="flex flex-col gap-5">
                {byCategory.map((cat) => (
                  <div key={cat}>
                    <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{cat}</h3>
                    <ul className="flex flex-col">
                      {w.stock.filter((s) => s.category === cat).map((s) => (
                        <li key={s.sku} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border py-2.5 last:border-0">
                          <div className="min-w-0 flex-1 basis-48">
                            <p className="truncate text-sm font-medium">{s.name}</p>
                            <p className="text-xs text-muted-foreground">
                              <span className="font-mono">{s.sku}</span>{s.zone ? ` · zona ${s.zone}` : ""} · mín {n0(s.min_qty)} · máx {n0(s.max_qty)}
                            </p>
                          </div>
                          <div className="tabular text-right text-sm">
                            <p className="font-semibold">{n0(s.qty)} <span className="font-normal text-muted-foreground">{s.unit}</span></p>
                            <p className="text-xs text-muted-foreground">{n1(s.volume_total_m3)} m³</p>
                          </div>
                          <StockStateBadge state={s.state} />
                          <div className="flex gap-1.5">
                            <Button size="sm" variant="secondary" onClick={() => { setItem(s); setKind("Entrada"); setSheet("move"); }}>Mover</Button>
                            <Button size="sm" variant="ghost" aria-label={`Trasladar ${s.name}`} onClick={() => { setItem(s); setSheet("transfer"); }}>
                              <ArrowRightLeft /> Trasladar
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Movimientos recientes">
            {w.movements.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin movimientos.</p>
            ) : (
              <ul className="flex flex-col">
                {w.movements.slice(0, 20).map((m) => (
                  <li key={m.move_id} className="flex flex-wrap items-baseline gap-x-3 border-b border-border py-2 text-sm last:border-0">
                    <Badge tone={m.kind === "Entrada" || m.kind === "Traslado entrada" ? "success" : m.kind === "Merma" ? "danger" : "neutral"}>{m.kind}</Badge>
                    <span className="tabular font-medium">{n0(m.qty)}</span>
                    <span className="font-mono text-xs">{m.sku}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{dt(m.at)}{m.by_user ? ` · ${m.by_user}` : ""}</span>
                    {(m.reference || m.note) && <p className="basis-full text-xs text-muted-foreground">{[m.reference, m.note].filter(Boolean).join(" · ")}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <div className="flex flex-col gap-6">
          <Section title="Qué hace esta bodega">
            <p className="text-sm">{w.role_description}</p>
            <p className="mt-2 text-xs text-muted-foreground">Guarda: {w.stores}</p>
            {w.strategic_reason && <p className="mt-3 rounded-xl bg-fill p-3 text-xs">{w.strategic_reason}</p>}
            <dl className="mt-3 text-sm">
              {w.manager && <div className="flex justify-between gap-3 border-b border-border py-2"><dt className="text-muted-foreground">Responsable</dt><dd className="inline-flex items-center gap-1"><User className="size-3.5" aria-hidden />{w.manager}</dd></div>}
              {w.shift && <div className="flex justify-between gap-3 border-b border-border py-2"><dt className="text-muted-foreground">Horario</dt><dd>{w.shift}</dd></div>}
              <div className="flex justify-between gap-3 py-2"><dt className="text-muted-foreground">Posiciones de pallet</dt><dd className="tabular">{n0(w.capacity_pallets)}</dd></div>
            </dl>
          </Section>

          <Section title={`Vehículos alojados (${w.vehicles_list.length})`}>
            {w.vehicles_list.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ningún vehículo tiene esta bodega como base.</p>
            ) : (
              <ul className="flex flex-col">
                {w.vehicles_list.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-2 border-b border-border py-2 text-sm last:border-0">
                    <Link href={`/flota/${v.id}`} className="inline-flex min-w-0 items-center gap-1.5 hover:text-primary">
                      <Truck className="size-3.5 shrink-0" aria-hidden /><span className="font-mono">{v.code}</span>
                      <span className="truncate text-xs text-muted-foreground">{v.vehicle_type}</span>
                    </Link>
                    <VehicleStatusBadge status={v.status} />
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Traslados">
            {w.transfers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin traslados.</p>
            ) : (
              <ul className="flex flex-col">
                {w.transfers.slice(0, 10).map((t) => {
                  const out = t.from_wh === w.warehouse_id;
                  return (
                    <li key={t.transfer_id} className="border-b border-border py-2 text-sm last:border-0">
                      <div className="flex items-center justify-between gap-2">
                        <span>{out ? "A " : "De "}<Link href={`/bodegas/${out ? t.to_wh : t.from_wh}`} className="font-medium hover:text-primary">{out ? t.to_name : t.from_name}</Link></span>
                        <Badge tone={t.status === "Recibido" ? "success" : t.status === "En tránsito" ? "warning" : "neutral"}>{t.status}</Badge>
                      </div>
                      <p className="tabular text-xs text-muted-foreground">
                        {n0(t.qty)} × <span className="font-mono">{t.sku}</span>
                        {t.shipment_code ? <> · <Link href={`/envios/${t.shipment_code}`} className="font-mono hover:text-primary">{t.shipment_code}</Link></> : ""}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        </div>
      </div>

      {/* ---- Hojas ---- */}
      <Sheet open={sheet === "move" && !!item} onClose={close} title="Mover inventario" description={item ? `${item.name} · hay ${n0(item.qty)} ${item.unit}` : undefined}>
        {item && (
          <MoveForm item={item} kind={kind} setKind={setKind} busy={busy === "move"} error={error}
            onSubmit={(b) => run("move", `/api/warehouses/${w.warehouse_id}/movements`, { ...b, sku: item.sku, kind, usuario: me }, "POST", `${kind} registrada: ${item.name}.`)} />
        )}
      </Sheet>
      <Sheet open={sheet === "item"} onClose={close} title="Nuevo producto" description={`${w.name}`}>
        <ItemForm busy={busy === "item"} error={error}
          onSubmit={(b) => run("item", `/api/warehouses/${w.warehouse_id}/stock`, { ...b, usuario: me }, "POST", "Producto agregado al inventario.")} />
      </Sheet>
      <Sheet open={sheet === "transfer" && !!item} onClose={close} title="Trasladar a otra bodega" description={item ? `${item.name} · hay ${n0(item.qty)} ${item.unit}` : undefined}>
        {item && (
          <TransferForm item={item} others={others} sameCity={(id) => others.find((o) => o.warehouse_id === id)?.city === w.city} busy={busy === "transfer"} error={error}
            onSubmit={(b) => run("transfer", "/api/warehouses/transfers", { ...b, from_wh: w.warehouse_id, sku: item.sku, usuario: me }, "POST", "Traslado creado.")} />
        )}
      </Sheet>
    </div>
  );
}

function Actions({ busy, label }: { busy: boolean; label: string }) {
  return (
    <div className="mt-2 flex items-center gap-2">
      <Button type="submit" disabled={busy}>{busy && <LoaderCircle className="animate-spin" />} {label}</Button>
    </div>
  );
}

function MoveForm({ item, kind, setKind, busy, error, onSubmit }: {
  item: StockItem; kind: (typeof KINDS)[number]["key"]; setKind: (k: (typeof KINDS)[number]["key"]) => void;
  busy: boolean; error: string | null; onSubmit: (b: Record<string, unknown>) => void;
}) {
  const [qty, setQty] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); onSubmit({ qty, reference, note }); }}>
      <fieldset>
        <legend className="mb-1 text-xs text-muted-foreground">Tipo de movimiento</legend>
        <div className="grid grid-cols-2 gap-2" role="radiogroup">
          {KINDS.map((k) => (
            <button key={k.key} type="button" role="radio" aria-checked={kind === k.key} onClick={() => setKind(k.key)}
              className={cn("press rounded-xl border px-3 py-2 text-sm", kind === k.key ? "border-primary/50 bg-primary/10 font-medium" : "border-border text-muted-foreground")}>
              {k.key}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">{KINDS.find((k) => k.key === kind)?.help}</p>
      </fieldset>
      <Field label={kind === "Ajuste" ? `Cantidad contada (${item.unit})` : `Cantidad (${item.unit})`}>
        <input className={inputClass} inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
      </Field>
      <Field label="Referencia (opcional)"><input className={inputClass} value={reference} onChange={(e) => setReference(e.target.value)} maxLength={60} placeholder="Orden, guía o factura" /></Field>
      <Field label="Nota (opcional)"><textarea className={textareaClass} value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} /></Field>
      <ErrorBanner message={error} />
      <Actions busy={busy} label="Registrar" />
    </form>
  );
}

function ItemForm({ busy, error, onSubmit }: { busy: boolean; error: string | null; onSubmit: (b: Record<string, unknown>) => void }) {
  const [d, setD] = useState({ sku: "", name: "", category: "General", unit: "un", qty: "0", min_qty: "0", max_qty: "0", volume_m3: "0.01", weight_kg: "1", unit_cost_usd: "0", zone: "" });
  const set = (k: keyof typeof d, v: string) => setD((x) => ({ ...x, [k]: v }));
  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); onSubmit(d); }}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="SKU"><input className={inputClass} value={d.sku} onChange={(e) => set("sku", e.target.value)} maxLength={30} /></Field>
        <Field label="Zona"><input className={inputClass} value={d.zone} onChange={(e) => set("zone", e.target.value)} maxLength={20} placeholder="A-03" /></Field>
      </div>
      <Field label="Nombre"><input className={inputClass} value={d.name} onChange={(e) => set("name", e.target.value)} maxLength={90} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Categoría"><input className={inputClass} value={d.category} onChange={(e) => set("category", e.target.value)} maxLength={40} /></Field>
        <Field label="Unidad"><input className={inputClass} value={d.unit} onChange={(e) => set("unit", e.target.value)} maxLength={15} /></Field>
        <Field label="Cantidad inicial"><input className={inputClass} inputMode="decimal" value={d.qty} onChange={(e) => set("qty", e.target.value)} /></Field>
        <Field label="Costo por unidad (USD)"><input className={inputClass} inputMode="decimal" value={d.unit_cost_usd} onChange={(e) => set("unit_cost_usd", e.target.value)} /></Field>
        <Field label="Mínimo"><input className={inputClass} inputMode="decimal" value={d.min_qty} onChange={(e) => set("min_qty", e.target.value)} /></Field>
        <Field label="Máximo"><input className={inputClass} inputMode="decimal" value={d.max_qty} onChange={(e) => set("max_qty", e.target.value)} /></Field>
        <Field label="Volumen por unidad (m³)"><input className={inputClass} inputMode="decimal" value={d.volume_m3} onChange={(e) => set("volume_m3", e.target.value)} /></Field>
        <Field label="Peso por unidad (kg)"><input className={inputClass} inputMode="decimal" value={d.weight_kg} onChange={(e) => set("weight_kg", e.target.value)} /></Field>
      </div>
      <ErrorBanner message={error} />
      <Actions busy={busy} label="Agregar producto" />
    </form>
  );
}

function TransferForm({ item, others, sameCity, busy, error, onSubmit }: {
  item: StockItem; others: Warehouse[]; sameCity: (id: number) => boolean; busy: boolean; error: string | null;
  onSubmit: (b: Record<string, unknown>) => void;
}) {
  const [to, setTo] = useState("");
  const [qty, setQty] = useState("");
  const dest = to ? Number(to) : null;
  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); onSubmit({ to_wh: to, qty }); }}>
      <Field label="Bodega de destino">
        <select className={inputClass} value={to} onChange={(e) => setTo(e.target.value)}>
          <option value="">Elige una bodega</option>
          {others.map((o) => <option key={o.warehouse_id} value={o.warehouse_id}>{o.city} · {o.name}</option>)}
        </select>
      </Field>
      <Field label={`Cantidad (${item.unit})`}><input className={inputClass} inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
      <p className="rounded-xl bg-fill p-3 text-xs">
        {dest === null
          ? "Si la bodega está en otra ciudad, se crea un envío por la red y el inventario entra cuando ese envío llegue."
          : sameCity(dest)
            ? "Es la misma ciudad: el traslado es inmediato."
            : "Es otra ciudad: se crea un envío por la red y el inventario entra a la bodega destino cuando ese envío llegue."}
      </p>
      <ErrorBanner message={error} />
      <Actions busy={busy} label="Trasladar" />
    </form>
  );
}
