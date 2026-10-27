"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Sparkles } from "lucide-react";

import { ErrorBanner, Field, inputClass, textareaClass } from "@/components/fleet/form-bits";
import { useApp } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { SaveIcon, useSavedFlash } from "@/components/ui/save-icon";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/client";
import type { Warehouse, WarehouseDetail, WarehouseRole } from "@/lib/types";

type Draft = {
  name: string;
  city: string;
  role: string;
  capacity_m3: string;
  capacity_pallets: string;
  docks: string;
  manager: string;
  shift: string;
  status: string;
  strategic_reason: string;
  temp_controlled: boolean;
  hazmat: boolean;
  bonded: boolean;
};

function draftFrom(w?: WarehouseDetail): Draft {
  return {
    name: w?.name ?? "",
    city: w?.city ?? "",
    role: w?.role ?? "regional",
    capacity_m3: w ? String(w.capacity_m3) : "5000",
    capacity_pallets: w ? String(w.capacity_pallets) : "2000",
    docks: w ? String(w.docks) : "6",
    manager: w?.manager ?? "",
    shift: w?.shift ?? "Lun–sáb 6:00–22:00",
    status: w?.status ?? "Operativa",
    strategic_reason: w?.strategic_reason ?? "",
    temp_controlled: w?.temp_controlled ?? false,
    hazmat: w?.hazmat ?? false,
    bonded: w?.bonded ?? false,
  };
}

/** Alta y edición de una bodega. El rol define qué guarda; frío, peligrosos y aduana se activan solos cuando el rol lo exige. */
export function WarehouseForm({ warehouse }: { warehouse?: WarehouseDetail }) {
  const router = useRouter();
  const { operator } = useApp();
  const [draft, setDraft] = useState<Draft>(() => draftFrom(warehouse));
  const [roles, setRoles] = useState<WarehouseRole[]>([]);
  const [statuses, setStatuses] = useState<string[]>(["Operativa", "Mantenimiento", "Cerrada"]);
  const [cities, setCities] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, flashDone] = useSavedFlash();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ items: WarehouseRole[]; statuses: string[] }>("/api/warehouses/roles")
      .then((d) => { setRoles(d.items); setStatuses(d.statuses); })
      .catch(() => undefined);
    api<{ items: Warehouse[] }>("/api/warehouses")
      .then((d) => setCities([...new Set(d.items.map((w) => w.city))].sort((a, b) => a.localeCompare(b, "es"))))
      .catch(() => undefined);
  }, []);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const role = roles.find((r) => r.key === draft.role);
  const forcedCold = draft.role === "frio";
  const forcedHazmat = draft.role === "peligrosos";
  const forcedBonded = draft.role === "aduanera" || draft.role === "frontera";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      ...draft,
      temp_controlled: draft.temp_controlled || forcedCold,
      hazmat: draft.hazmat || forcedHazmat,
      bonded: draft.bonded || forcedBonded,
      usuario: operator || null,
    };
    try {
      const saved = warehouse
        ? await api<WarehouseDetail>(`/api/warehouses/${warehouse.warehouse_id}`, { method: "PUT", body })
        : await api<WarehouseDetail>("/api/warehouses", { method: "POST", body });
      flashDone();
      toast({ title: warehouse ? "Bodega guardada" : "Bodega creada", description: saved.name });
      router.push(`/bodegas/${saved.warehouse_id}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} noValidate className="glass flex max-w-4xl flex-col gap-6 rounded-3xl p-5 md:p-6">
      <section className="grid gap-4 sm:grid-cols-2">
        <h2 className="text-sm font-semibold sm:col-span-2">Identificación</h2>
        <Field label="Nombre">
          <input className={inputClass} value={draft.name} onChange={(e) => set("name", e.target.value)} maxLength={80} placeholder="Centro de distribución Zona Franca" />
        </Field>
        <Field label="Ciudad" hint="Debe ser una ciudad de la red; la bodega queda conectada a su nodo.">
          <input className={inputClass} list="ciudades" value={draft.city} onChange={(e) => set("city", e.target.value)} maxLength={60} />
        </Field>
        <datalist id="ciudades">{cities.map((c) => <option key={c} value={c} />)}</datalist>
        <Field label="Rol" className="sm:col-span-2" hint={role ? `${role.description} Guarda: ${role.stores}` : undefined}>
          <select className={inputClass} value={draft.role} onChange={(e) => set("role", e.target.value)}>
            {roles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            {roles.length === 0 && <option value={draft.role}>{draft.role}</option>}
          </select>
        </Field>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <h2 className="text-sm font-semibold sm:col-span-3">Capacidad</h2>
        <Field label="Volumen (m³)"><input className={inputClass} inputMode="decimal" value={draft.capacity_m3} onChange={(e) => set("capacity_m3", e.target.value)} /></Field>
        <Field label="Posiciones de pallet"><input className={inputClass} inputMode="numeric" value={draft.capacity_pallets} onChange={(e) => set("capacity_pallets", e.target.value)} /></Field>
        <Field label="Muelles"><input className={inputClass} inputMode="numeric" value={draft.docks} onChange={(e) => set("docks", e.target.value)} /></Field>
        <fieldset className="flex flex-wrap gap-x-6 gap-y-2 sm:col-span-3">
          <legend className="mb-1 text-xs text-muted-foreground">Lo que puede manejar</legend>
          {([
            ["temp_controlled", "Cadena de frío", forcedCold],
            ["hazmat", "Mercancías peligrosas", forcedHazmat],
            ["bonded", "Zona aduanera", forcedBonded],
          ] as const).map(([k, label, forced]) => (
            <label key={k} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draft[k] || forced} disabled={forced} onChange={(e) => set(k, e.target.checked)} />
              {label}{forced ? <span className="text-xs text-muted-foreground"> (lo exige el rol)</span> : null}
            </label>
          ))}
        </fieldset>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <h2 className="text-sm font-semibold sm:col-span-2">Operación</h2>
        <Field label="Responsable"><input className={inputClass} value={draft.manager} onChange={(e) => set("manager", e.target.value)} maxLength={60} /></Field>
        <Field label="Horario"><input className={inputClass} value={draft.shift} onChange={(e) => set("shift", e.target.value)} maxLength={40} /></Field>
        <Field label="Estado" hint="Una bodega cerrada no puede enviar traslados.">
          <select className={inputClass} value={draft.status} onChange={(e) => set("status", e.target.value)}>
            {statuses.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Por qué está aquí" className="sm:col-span-2">
          <textarea className={textareaClass} value={draft.strategic_reason} onChange={(e) => set("strategic_reason", e.target.value)} maxLength={300} placeholder="La razón estratégica de tener una bodega en este punto" />
        </Field>
      </section>

      <ErrorBanner message={error} />
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={busy} burst={warehouse ? Check : Sparkles}>
          <SaveIcon state={done ? "done" : busy ? "busy" : "idle"} /> {warehouse ? "Guardar cambios" : "Crear bodega"}
        </Button>
        <Button asChild variant="ghost">
          <Link href={warehouse ? `/bodegas/${warehouse.warehouse_id}` : "/bodegas"}>Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
