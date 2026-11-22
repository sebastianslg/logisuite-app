"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FleetCatalog, Maintenance, MaintenanceKind, VehicleDetail } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ErrorBanner, Field, inputClass, textareaClass } from "./form-bits";

function localInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Actions({ busy, label, onCancel }: { busy: boolean; label: string; onCancel?: () => void }) {
  return (
    <div className="mt-2 flex items-center gap-2">
      <Button type="submit" disabled={busy}>
        {busy && <LoaderCircle aria-hidden />} {busy ? "Guardando…" : label}
      </Button>
      {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>}
    </div>
  );
}

export function FaultForm({ catalog, busy, error, onSubmit }: { catalog: FleetCatalog | null; busy: boolean; error: string | null; onSubmit: (b: Record<string, unknown>) => void }) {
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

export function MaintForm({ vehicle, catalog, fromFault, busy, error, onSubmit }: {
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

export function CompleteForm({ m, busy, error, onSubmit }: { m: Maintenance; busy: boolean; error: string | null; onSubmit: (b: Record<string, unknown>) => void }) {
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

export function ResolveForm({ busy, error, onSubmit }: { busy: boolean; error: string | null; onSubmit: (b: Record<string, unknown>) => void }) {
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

export function RetireForm({ busy, error, onSubmit }: { busy: boolean; error: string | null; onSubmit: (reason: string) => void }) {
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
