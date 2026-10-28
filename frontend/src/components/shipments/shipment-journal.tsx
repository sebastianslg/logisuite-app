"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRightLeft, Check, CircleCheck, Flag, MapPin, MessageSquare, Plus, Trash2, TriangleAlert } from "lucide-react";

import { useApp } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { SaveIcon, useSavedFlash } from "@/components/ui/save-icon";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/client";
import { EASE } from "@/lib/motion";
import type { EventKind, Shipment, ShipmentEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

const KINDS: { value: EventKind; label: string }[] = [
  { value: "nota", label: "Nota" },
  { value: "retraso", label: "Retraso" },
  { value: "derrumbe", label: "Derrumbe" },
  { value: "paro", label: "Paro o bloqueo" },
  { value: "clima", label: "Clima" },
  { value: "mecanica", label: "Falla mecánica" },
  { value: "otro", label: "Otro" },
];

type Item =
  | { type: "plan"; at: Date; key: string; title: string; detail?: string; icon: "start" | "transfer" | "end" }
  | { type: "event"; at: Date; key: string; event: ShipmentEvent };

const hours = (d: Date, h: number) => new Date(d.getTime() + h * 3_600_000);

function when(d: Date) {
  return d.toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).replace(/\s/g, " ");
}

/**
 * Bitácora del envío: en una sola línea de tiempo, lo previsto (salida, transbordos, llegada con el retraso
 * vigente) y lo registrado (notas e incidencias), con una marca de «ahora». Lo que aún no pasa se ve atenuado.
 * Una incidencia puede sumar horas de retraso: la API lo aplica al envío y la ETA se recalcula.
 */
export function ShipmentJournal({ shipment: s, initial }: { shipment: Shipment; initial: ShipmentEvent[] }) {
  const router = useRouter();
  const { operator } = useApp();
  const [events, setEvents] = useState(initial);
  // «Ahora» se recalcula con cada registro nuevo (si no, lo recién anotado quedaría «en el futuro»)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const now = useMemo(() => new Date(), [events]);
  const [open, setOpen] = useState(false);

  const items = useMemo<Item[]>(() => {
    const dep = new Date(s.departure_at);
    const plan: Item[] = [
      { type: "plan", at: dep, key: "dep", title: `Salida de ${s.origin}`, detail: s.legs?.[0]?.from.name, icon: "start" },
      ...(s.transfers ?? []).map<Item>((t, i) => ({
        type: "plan", at: hours(dep, t.start_h), key: `tr-${i}`, title: t.label, detail: `${t.node.name} · ${t.time_fmt}`, icon: "transfer",
      })),
      {
        type: "plan", at: hours(new Date(s.eta_at), s.delay_h || 0), key: "eta",
        title: `Llegada a ${s.destination}`, detail: s.delay_fmt ? `ETA planeada ${when(new Date(s.eta_at))} · +${s.delay_fmt} de retraso` : s.legs?.at(-1)?.to.name,
        icon: "end",
      },
    ];
    const ev: Item[] = events.map((e) => ({ type: "event", at: new Date(e.created_at), key: `ev-${e.event_id}`, event: e }));
    return [...plan, ...ev].sort((a, b) => a.at.getTime() - b.at.getTime());
  }, [s, events]);

  const nowIndex = items.findIndex((i) => i.at > now);
  const openIncidents = events.filter((e) => e.incident && !e.resolved_at).length;

  async function resolve(e: ShipmentEvent) {
    try {
      const updated = await api<ShipmentEvent>(
        `/api/shipments/${encodeURIComponent(s.code)}/events/${e.event_id}/resolve?usuario=${encodeURIComponent(operator)}`,
        { method: "POST" },
      );
      setEvents((list) => list.map((x) => (x.event_id === e.event_id ? updated : x)));
      toast({ title: "Incidencia resuelta" });
    } catch (err) {
      toast({ title: "No se pudo resolver", description: (err as Error).message, tone: "error" });
    }
  }

  async function remove(e: ShipmentEvent) {
    if (!window.confirm("¿Borrar esta nota?")) return;
    try {
      await api(`/api/shipments/${encodeURIComponent(s.code)}/events/${e.event_id}?usuario=${encodeURIComponent(operator)}`, { method: "DELETE" });
      setEvents((list) => list.filter((x) => x.event_id !== e.event_id));
    } catch (err) {
      toast({ title: "No se pudo borrar", description: (err as Error).message, tone: "error" });
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {events.length === 0
            ? "Sin notas ni incidencias."
            : `${events.length} ${events.length === 1 ? "registro" : "registros"}${openIncidents ? ` · ${openIncidents} ${openIncidents === 1 ? "incidencia abierta" : "incidencias abiertas"}` : ""}`}
        </p>
        <Button variant="secondary" size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="print:hidden">
          <Plus className={cn("transition-transform duration-200", open && "rotate-45")} />
          {open ? "Cancelar" : "Registrar"}
        </Button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE } }}
            exit={{ opacity: 0, y: -6, transition: { duration: 0.15, ease: EASE } }}
          >
            <EventForm
              code={s.code}
              delivered={s.status === "Entregado"}
              operator={operator}
              onAdded={(e) => {
                setEvents((list) => [...list, e]);
                setOpen(false);
                toast({ title: e.incident ? "Incidencia registrada" : "Nota guardada", description: e.delay_h ? `Se sumaron ${e.delay_h} h de retraso al envío.` : undefined });
                // El retraso cambia ETA, estado e historial: se recarga el detalle
                if (e.delay_h) router.refresh();
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <ol className="mt-4" aria-label="Línea de tiempo del envío">
        {items.map((it, i) => {
          const future = it.at > now;
          return (
            <li key={it.key}>
              {i === nowIndex && <NowMarker />}
              <div className={cn("grid grid-cols-[5.5rem_1.25rem_minmax(0,1fr)] gap-x-3 pb-4", future && it.type === "plan" && "opacity-60")}>
                <time dateTime={it.at.toISOString()} className="tabular pt-0.5 text-right text-[12px] text-muted-foreground">
                  {when(it.at)}
                </time>
                <div className="relative flex justify-center">
                  {i < items.length - 1 && <span aria-hidden className="absolute top-5 -bottom-4 w-px bg-border" />}
                  <Dot item={it} />
                </div>
                {it.type === "plan" ? (
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      {it.title}
                      {future && <span className="ml-2 text-xs font-normal text-muted-foreground">previsto</span>}
                    </div>
                    {it.detail && <div className="text-xs text-muted-foreground">{it.detail}</div>}
                  </div>
                ) : (
                  <EventRow e={it.event} onResolve={resolve} onDelete={remove} />
                )}
              </div>
            </li>
          );
        })}
        {nowIndex === -1 && <NowMarker />}
      </ol>
    </div>
  );
}

function NowMarker() {
  return (
    <div className="grid grid-cols-[5.5rem_1.25rem_minmax(0,1fr)] items-center gap-x-3 pb-4" aria-label="Ahora">
      <span className="text-right text-[11px] font-semibold tracking-wide text-primary uppercase">Ahora</span>
      <span className="mx-auto size-2 rounded-full bg-primary" aria-hidden />
      <span className="h-px bg-primary/40" aria-hidden />
    </div>
  );
}

function Dot({ item }: { item: Item }) {
  const base = "relative z-[1] flex size-5 items-center justify-center rounded-full ring-4 ring-[var(--card)] [&_svg]:size-3";
  if (item.type === "plan") {
    const Icon = item.icon === "start" ? MapPin : item.icon === "transfer" ? ArrowRightLeft : Flag;
    return (
      <span className={cn(base, item.icon === "transfer" ? "bg-warning/12 text-warning" : "bg-fill text-foreground")} aria-hidden>
        <Icon />
      </span>
    );
  }
  const e = item.event;
  if (!e.incident)
    return (
      <span className={cn(base, "bg-fill text-muted-foreground")} aria-hidden>
        <MessageSquare />
      </span>
    );
  return (
    <span className={cn(base, e.resolved_at ? "bg-success/12 text-success" : "bg-destructive/10 text-destructive")} aria-hidden>
      {e.resolved_at ? <CircleCheck /> : <TriangleAlert />}
    </span>
  );
}

function EventRow({ e, onResolve, onDelete }: { e: ShipmentEvent; onResolve: (e: ShipmentEvent) => void; onDelete: (e: ShipmentEvent) => void }) {
  return (
    <div className="group/ev min-w-0">
      <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className={cn("font-medium", e.incident && !e.resolved_at && "text-destructive")}>{e.kind_label}</span>
        {e.delay_h > 0 && <span className="tabular text-xs text-destructive">+{e.delay_h.toLocaleString("es-CO")} h</span>}
        {e.resolved_at && <span className="text-xs text-success">Resuelta</span>}
        <span className="text-xs text-muted-foreground">{e.created_by}</span>
      </div>
      <p className="mt-0.5 text-sm [overflow-wrap:anywhere] whitespace-pre-line text-foreground/90">{e.body}</p>
      <div className="mt-1 flex gap-1 print:hidden">
        {e.incident && !e.resolved_at && (
          <Button variant="ghost" size="sm" className="-ml-2 h-7 px-2 text-xs" onClick={() => onResolve(e)}>
            <Check /> Marcar resuelta
          </Button>
        )}
        {!e.incident && (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 h-7 px-2 text-xs text-muted-foreground opacity-0 group-hover/ev:opacity-100 focus-visible:opacity-100 hover:text-destructive pointer-coarse:opacity-100"
            onClick={() => onDelete(e)}
          >
            <Trash2 /> Borrar
          </Button>
        )}
      </div>
    </div>
  );
}

function EventForm({ code, delivered, operator, onAdded }: { code: string; delivered: boolean; operator: string; onAdded: (e: ShipmentEvent) => void }) {
  const [kind, setKind] = useState<EventKind>("nota");
  const [body, setBody] = useState("");
  const [delay, setDelay] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, flash] = useSavedFlash();
  const incident = kind !== "nota";

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await api<ShipmentEvent>(`/api/shipments/${encodeURIComponent(code)}/events`, {
        method: "POST",
        body: { kind, body, delay_h: incident ? Number(delay.replace(",", ".")) || 0 : 0, usuario: operator },
      });
      flash();
      setBody("");
      setDelay("");
      onAdded(created);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 grid gap-3 rounded-2xl border border-border p-4 sm:grid-cols-[12rem_minmax(0,1fr)]">
      <label className="block text-xs">
        <span className="mb-1 block text-muted-foreground">Tipo</span>
        <select value={kind} onChange={(e) => setKind(e.target.value as EventKind)} className="field h-10 w-full px-3 text-sm">
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </label>
      <label className={cn("block text-xs", !incident && "sm:col-span-1")}>
        <span className="mb-1 block text-muted-foreground">Horas de retraso que suma (opcional)</span>
        <input
          inputMode="decimal"
          value={delay}
          onChange={(e) => setDelay(e.target.value)}
          disabled={!incident || delivered}
          placeholder={!incident ? "Solo para incidencias" : delivered ? "El envío ya se entregó" : "0"}
          className="field tabular h-10 w-full px-3 text-sm disabled:opacity-60"
        />
      </label>
      <label className="block text-xs sm:col-span-2">
        <span className="mb-1 block text-muted-foreground">{incident ? "Qué pasó" : "Nota"}</span>
        <textarea
          required
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder={incident ? "Ej. Derrumbe en el km 42 de La Línea; paso habilitado a un carril." : "Ej. El cliente pide confirmar por teléfono antes de entregar."}
          className="field w-full resize-y px-3 py-2 text-sm"
        />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" size="sm" disabled={busy || !body.trim()}>
          <SaveIcon state={done ? "done" : busy ? "busy" : "idle"} />
          {incident ? "Registrar incidencia" : "Guardar nota"}
        </Button>
        <span className="text-xs text-muted-foreground">
          Firmará: <span className="text-foreground">{operator || "anónimo"}</span>
        </span>
        {error && (
          <p role="alert" className="w-full text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
