"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Sparkles } from "lucide-react";

import { useApp } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { SaveIcon, useSavedFlash } from "@/components/ui/save-icon";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/client";
import type { Driver, FleetCatalog, Mode, VehicleDetail, Warehouse } from "@/lib/types";

import { ErrorBanner, Field, inputClass, textareaClass } from "./form-bits";

type Draft = {
  code: string;
  mode: Mode;
  vehicle_type: string;
  make: string;
  model: string;
  year: string;
  capacity_t: string;
  capacity_m3: string;
  home_warehouse_id: string;
  driver_id: string;
  odometer_base_km: string;
  last_service_at: string;
  last_service_km: string;
  service_interval_days: string;
  service_interval_km: string;
  notes: string;
};

function draftFrom(v?: VehicleDetail): Draft {
  return {
    code: v?.code ?? "",
    mode: v?.mode ?? "terrestre",
    vehicle_type: v?.vehicle_type ?? "Camión sencillo",
    make: v?.make ?? "",
    model: v?.model ?? "",
    year: v?.year ? String(v.year) : "",
    capacity_t: v ? String(v.capacity_t) : "10",
    capacity_m3: v?.capacity_m3 ? String(v.capacity_m3) : "30",
    home_warehouse_id: v?.home_warehouse_id ? String(v.home_warehouse_id) : "",
    driver_id: v?.driver ? String(v.driver.id) : "",
    odometer_base_km: v ? String(v.odometer_km) : "0",
    last_service_at: v?.last_service_at ?? "",
    last_service_km: v ? String(v.last_service_km) : "0",
    service_interval_days: v ? String(v.service_interval_days) : "120",
    service_interval_km: v ? String(v.service_interval_km) : "15000",
    notes: v?.notes ?? "",
  };
}

/** Alta y edición de un vehículo. Al elegir el tipo se sugieren capacidad e intervalos de mantenimiento. */
export function VehicleForm({ vehicle }: { vehicle?: VehicleDetail }) {
  const router = useRouter();
  const { operator } = useApp();
  const [draft, setDraft] = useState<Draft>(() => draftFrom(vehicle));
  const [catalog, setCatalog] = useState<FleetCatalog | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, flashDone] = useSavedFlash();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<FleetCatalog>("/api/fleet/catalog").then(setCatalog).catch(() => undefined);
    api<{ items: Warehouse[] }>("/api/warehouses").then((d) => setWarehouses(d.items)).catch(() => undefined);
    api<{ items: Driver[] }>("/api/fleet/drivers").then((d) => setDrivers(d.items)).catch(() => undefined);
  }, []);

  const types = useMemo(() => catalog?.modes.find((m) => m.key === draft.mode)?.types ?? [], [catalog, draft.mode]);
  const makes = useMemo(() => types.find((t) => t.name === draft.vehicle_type)?.makes ?? [], [types, draft.vehicle_type]);
  const freeDrivers = drivers.filter((d) => d.status === "Activo" && (!d.vehicle_id || d.vehicle_id === vehicle?.id));

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  function pickMode(mode: Mode) {
    const first = catalog?.modes.find((m) => m.key === mode)?.types[0];
    setDraft((d) => ({
      ...d,
      mode,
      vehicle_type: first?.name ?? "",
      capacity_t: first ? String(first.capacity_t) : d.capacity_t,
      capacity_m3: first ? String(first.capacity_m3) : d.capacity_m3,
      service_interval_days: first ? String(first.service_interval_days) : d.service_interval_days,
      service_interval_km: first ? String(first.service_interval_km) : d.service_interval_km,
      make: "",
      model: "",
      driver_id: mode === "terrestre" ? d.driver_id : "",
    }));
  }

  function pickType(name: string) {
    const t = types.find((x) => x.name === name);
    setDraft((d) => ({
      ...d,
      vehicle_type: name,
      ...(t && !vehicle
        ? {
            capacity_t: String(t.capacity_t),
            capacity_m3: String(t.capacity_m3),
            service_interval_days: String(t.service_interval_days),
            service_interval_km: String(t.service_interval_km),
          }
        : {}),
      make: "",
      model: "",
    }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    // Lo que depende de la fecha se completa aquí, en el navegador, y no al prerenderizar.
    const today = new Date();
    const body = {
      ...draft,
      year: draft.year || String(today.getFullYear() - 2),
      last_service_at: draft.last_service_at || today.toISOString().slice(0, 10),
      home_warehouse_id: draft.home_warehouse_id || null,
      driver_id: draft.driver_id || null,
      usuario: operator || null,
    };
    try {
      const saved = vehicle
        ? await api<VehicleDetail>(`/api/fleet/vehicles/${vehicle.id}`, { method: "PUT", body })
        : await api<VehicleDetail>("/api/fleet/vehicles", { method: "POST", body });
      flashDone();
      toast({ title: vehicle ? "Vehículo guardado" : "Vehículo creado" });
      router.push(`/flota/${saved.id}`);
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
        <Field label="Modo">
          <select className={inputClass} value={draft.mode} onChange={(e) => pickMode(e.target.value as Mode)} disabled={!!vehicle && vehicle.trips_total > 0}>
            {(catalog?.modes ?? []).map((m) => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
            {!catalog && <option value={draft.mode}>{draft.mode}</option>}
          </select>
        </Field>
        <Field label="Tipo de vehículo">
          <select className={inputClass} value={draft.vehicle_type} onChange={(e) => pickType(e.target.value)}>
            {types.map((t) => (
              <option key={t.name} value={t.name}>{t.name}</option>
            ))}
            {types.length === 0 && <option value={draft.vehicle_type}>{draft.vehicle_type}</option>}
          </select>
        </Field>
        <Field label={draft.mode === "terrestre" ? "Placa" : draft.mode === "aereo" ? "Matrícula" : "Nombre o código"} hint="No puede repetirse en la flota.">
          <input className={inputClass} value={draft.code} onChange={(e) => set("code", e.target.value.toUpperCase())} maxLength={30} placeholder={draft.mode === "terrestre" ? "ABC-123" : ""} />
        </Field>
        <Field label="Año">
          <input className={inputClass} inputMode="numeric" value={draft.year} placeholder="Año del modelo" onChange={(e) => set("year", e.target.value)} />
        </Field>
        <Field label="Marca">
          <input className={inputClass} list="marcas" value={draft.make} onChange={(e) => set("make", e.target.value)} maxLength={40} />
        </Field>
        <Field label="Modelo">
          <input className={inputClass} list="modelos" value={draft.model} onChange={(e) => set("model", e.target.value)} maxLength={40} />
        </Field>
        <datalist id="marcas">{[...new Set(makes.map((m) => m.make))].map((m) => <option key={m} value={m} />)}</datalist>
        <datalist id="modelos">{makes.filter((m) => !draft.make || m.make === draft.make).map((m) => <option key={m.model} value={m.model} />)}</datalist>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <h2 className="text-sm font-semibold sm:col-span-2">Capacidad y asignación</h2>
        <Field label="Capacidad de carga (t)">
          <input className={inputClass} inputMode="decimal" value={draft.capacity_t} onChange={(e) => set("capacity_t", e.target.value)} />
        </Field>
        <Field label="Volumen (m³)">
          <input className={inputClass} inputMode="decimal" value={draft.capacity_m3} onChange={(e) => set("capacity_m3", e.target.value)} />
        </Field>
        <Field label="Bodega donde se aloja" hint="Los envíos que salen de esa ciudad lo prefieren.">
          <select className={inputClass} value={draft.home_warehouse_id} onChange={(e) => set("home_warehouse_id", e.target.value)}>
            <option value="">Sin bodega</option>
            {warehouses.map((w) => (
              <option key={w.warehouse_id} value={w.warehouse_id}>{w.name} · {w.city}</option>
            ))}
          </select>
        </Field>
        <Field label="Conductor" hint={draft.mode === "terrestre" ? "Un conductor solo puede tener un vehículo." : "La tripulación de este modo no se modela."}>
          <select className={inputClass} value={draft.driver_id} onChange={(e) => set("driver_id", e.target.value)} disabled={draft.mode !== "terrestre"}>
            <option value="">Sin conductor</option>
            {freeDrivers.map((d) => (
              <option key={d.driver_id} value={d.driver_id}>
                {d.name} · {d.license_cat}{d.license_state !== "Vigente" ? ` · licencia ${d.license_state.toLowerCase()}` : ""}
              </option>
            ))}
          </select>
        </Field>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <h2 className="text-sm font-semibold sm:col-span-2">Mantenimiento</h2>
        <Field label="Fecha del último mantenimiento">
          <input type="date" title="Si se deja vacío se usa hoy" className={inputClass} value={draft.last_service_at} onChange={(e) => set("last_service_at", e.target.value)} />
        </Field>
        <Field label="Kilometraje actual (km)">
          <input className={inputClass} inputMode="decimal" value={draft.odometer_base_km} onChange={(e) => set("odometer_base_km", e.target.value)} />
        </Field>
        <Field label="Kilometraje del último mantenimiento (km)">
          <input className={inputClass} inputMode="decimal" value={draft.last_service_km} onChange={(e) => set("last_service_km", e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cada cuántos días">
            <input className={inputClass} inputMode="numeric" value={draft.service_interval_days} onChange={(e) => set("service_interval_days", e.target.value)} />
          </Field>
          <Field label="Cada cuántos km">
            <input className={inputClass} inputMode="decimal" value={draft.service_interval_km} onChange={(e) => set("service_interval_km", e.target.value)} />
          </Field>
        </div>
        <p className="text-xs text-muted-foreground sm:col-span-2">
          El mantenimiento vence por lo que ocurra primero: los días o los kilómetros. Al vencer, el vehículo deja de recibir envíos.
        </p>
      </section>

      <Field label="Notas">
        <textarea className={textareaClass} value={draft.notes} onChange={(e) => set("notes", e.target.value)} maxLength={300} />
      </Field>

      <ErrorBanner message={error} />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={busy} burst={vehicle ? Check : Sparkles}>
          <SaveIcon state={done ? "done" : busy ? "busy" : "idle"} />
          {vehicle ? "Guardar cambios" : "Crear vehículo"}
        </Button>
        <Button asChild variant="ghost">
          <Link href={vehicle ? `/flota/${vehicle.id}` : "/flota"}>Cancelar</Link>
        </Button>
        <span className="text-xs text-muted-foreground">Firmará: {operator || "anónimo"}</span>
      </div>
    </form>
  );
}
