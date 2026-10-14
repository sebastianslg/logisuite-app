"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle, Pencil, Plus, Trash2, UserRound } from "lucide-react";

import { useApp } from "@/components/providers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { api } from "@/lib/client";
import type { Driver } from "@/lib/types";

import { ErrorBanner, Field, inputClass } from "./form-bits";
import { dateOnly } from "./status";

/** Conductores: licencia, estado y el vehículo que manejan. Una licencia vencida inhabilita su vehículo. */
export function DriversBoard({ drivers }: { drivers: Driver[] }) {
  const router = useRouter();
  const { operator } = useApp();
  const [editing, setEditing] = useState<Driver | "new" | null>(null);
  const [name, setName] = useState("");
  const [cat, setCat] = useState("C3");
  const [expiry, setExpiry] = useState("");
  const [status, setStatus] = useState<"Activo" | "Inactivo">("Activo");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function open(d: Driver | "new") {
    setEditing(d);
    setError(null);
    setName(d === "new" ? "" : d.name);
    setCat(d === "new" ? "C3" : d.license_cat);
    setExpiry(d === "new" ? new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10) : d.license_expiry);
    setStatus(d === "new" ? "Activo" : d.status);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy("save");
    setError(null);
    try {
      const body = { name, license_cat: cat, license_expiry: expiry, status, usuario: operator || null };
      if (editing === "new") await api("/api/fleet/drivers", { method: "POST", body });
      else if (editing) await api(`/api/fleet/drivers/${editing.driver_id}`, { method: "PUT", body });
      setEditing(null);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function remove(d: Driver) {
    if (!window.confirm(`¿Borrar a ${d.name}? Su vehículo quedará sin conductor.`)) return;
    setBusy(`del${d.driver_id}`);
    try {
      await api(`/api/fleet/drivers/${d.driver_id}?usuario=${encodeURIComponent(operator)}`, { method: "DELETE" });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const tone = { Vigente: "success", "Por vencer": "warning", Vencida: "danger" } as const;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{drivers.length} conductores · {drivers.filter((d) => d.license_state !== "Vigente").length} con la licencia por vencer o vencida</p>
        <Button size="sm" onClick={() => open("new")}><Plus /> Nuevo conductor</Button>
      </div>
      {error && !editing && <ErrorBanner message={error} />}
      <ul className="grid gap-2 md:grid-cols-2">
        {drivers.map((d) => (
          <li key={d.driver_id} className="glass flex items-center gap-3 rounded-2xl p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-fill text-muted-foreground"><UserRound className="size-4" aria-hidden /></span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-medium">{d.name}</span>
                {d.status === "Inactivo" && <Badge tone="neutral">Inactivo</Badge>}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Licencia {d.license_cat} · vence {dateOnly(d.license_expiry)}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge tone={tone[d.license_state]}>{d.license_state}</Badge>
                {d.vehicle_id ? <Link href={`/flota/${d.vehicle_id}`} className="font-mono text-xs hover:text-primary">{d.vehicle_code}</Link> : <span className="text-xs text-muted-foreground">Sin vehículo</span>}
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button variant="ghost" size="icon" aria-label={`Editar a ${d.name}`} onClick={() => open(d)}><Pencil /></Button>
              <Button variant="ghost" size="icon" aria-label={`Borrar a ${d.name}`} className="text-destructive hover:text-destructive" disabled={busy === `del${d.driver_id}`} onClick={() => remove(d)}>
                {busy === `del${d.driver_id}` ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Nuevo conductor" : "Editar conductor"} description="Los nombres son ficticios en esta demostración">
        <form noValidate className="flex flex-col gap-4" onSubmit={save}>
          <Field label="Nombre completo"><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoría de licencia"><input className={inputClass} value={cat} onChange={(e) => setCat(e.target.value)} maxLength={30} /></Field>
            <Field label="Vence"><input type="date" className={inputClass} value={expiry} onChange={(e) => setExpiry(e.target.value)} /></Field>
          </div>
          <Field label="Estado">
            <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as "Activo" | "Inactivo")}>
              <option>Activo</option>
              <option>Inactivo</option>
            </select>
          </Field>
          <ErrorBanner message={error} />
          <div><Button type="submit" disabled={busy === "save"}>{busy === "save" && <LoaderCircle className="animate-spin" />} Guardar</Button></div>
        </form>
      </Sheet>
    </div>
  );
}
