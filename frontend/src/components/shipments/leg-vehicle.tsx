"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useApp } from "@/components/providers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";

interface Option {
  id: number;
  code: string;
  vehicle_type: string;
  capacity_t: number;
  status: string;
  home_name: string | null;
  distance_km: number | null;
  available: boolean;
  fits: boolean;
  reason: string | null;
  selected: boolean;
}

interface Options {
  mode: string;
  load_t: number;
  start_at: string;
  locked: boolean;
  pinned: boolean;
  multi_allowed: boolean;
  max_units: number;
  items: Option[];
}

const fmtT = (n: number) => n.toLocaleString("es-CO", { maximumFractionDigits: 1 });

/**
 * Elegir a mano el vehículo (o los vehículos, por carretera) de un tramo. Solo se ofrecen los de la flota
 * propia del modo del tramo; los que no pueden cubrirlo en su horario salen apagados con la razón. Lo elegido
 * queda «fijado»: sobrevive a recalcular la ruta mientras siga pudiendo cubrir el tramo.
 */
export function LegVehicle({ code, legIndex, pinned }: { code: string; legIndex: number; pinned?: boolean }) {
  const router = useRouter();
  const { operator } = useApp();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Options | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const base = `/api/shipments/${encodeURIComponent(code)}/legs/${legIndex}`;

  useEffect(() => {
    if (!open) return;
    let alive = true;
    api<Options>(`${base}/vehicles`)
      .then((d) => {
        if (!alive) return;
        setData(d);
        setPicked(d.items.filter((v) => v.selected).map((v) => v.id));
      })
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [open, base]);

  function openSheet() {
    setData(null);
    setError(null);
    setOpen(true);
  }

  const chosen = data?.items.filter((v) => picked.includes(v.id)) ?? [];
  const capacity = chosen.reduce((a, v) => a + v.capacity_t, 0);
  const short = !!data && chosen.length > 0 && capacity + 1e-9 < data.load_t;

  function toggle(v: Option) {
    if (!data) return;
    if (!data.multi_allowed) return setPicked([v.id]);
    setPicked((p) => (p.includes(v.id) ? p.filter((x) => x !== v.id) : p.length < data.max_units ? [...p, v.id] : p));
  }

  async function save(ids: number[]) {
    setBusy(true);
    try {
      await api(`${base}/vehicle`, { method: "PUT", body: { vehicle_ids: ids, usuario: operator } });
      toast({ title: ids.length ? "Vehículo asignado" : "Asignación automática restablecida" });
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast({ title: "No se pudo cambiar el vehículo", description: (e as Error).message, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {pinned && <Badge tone="neutral">Fijado a mano</Badge>}
      <Button variant="ghost" size="sm" className="print:hidden" onClick={openSheet}>
        Cambiar vehículo
      </Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={`Vehículo del tramo ${legIndex + 1}`}
        description={data ? `Carga de ${fmtT(data.load_t)} t · solo flota propia ${data.mode === "terrestre" ? "por carretera" : "del modo"}` : undefined}
      >
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {!data && !error && <p className="text-sm text-muted-foreground">Buscando vehículos…</p>}
        {data?.locked && (
          <p className="mb-3 rounded-xl bg-warning/10 px-3 py-2 text-sm text-warning">
            Este tramo ya salió: no se puede cambiar su vehículo.
          </p>
        )}
        {data && data.items.length === 0 && (
          <p className="text-sm text-muted-foreground">La flota propia no tiene vehículos de este modo. El tramo va con un transportista tercero.</p>
        )}
        {data && data.items.length > 0 && (
          <>
            <ul className="rule-list -mx-5 border-y border-border" role={data.multi_allowed ? "group" : "radiogroup"} aria-label="Vehículos disponibles">
              {data.items.map((v) => {
                const off = data.locked || !v.available;
                return (
                  <li key={v.id}>
                    <label className={cn("flex items-start gap-3 px-5 py-3", off ? "opacity-60" : "cursor-pointer hover:bg-muted/60")}>
                      <input
                        type={data.multi_allowed ? "checkbox" : "radio"}
                        name="vehiculo"
                        className="mt-1 size-4 accent-[var(--accent-solid)]"
                        checked={picked.includes(v.id)}
                        disabled={off}
                        onChange={() => toggle(v)}
                      />
                      <span className="min-w-0 flex-1 text-sm">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-medium">{v.code}</span>
                          <span className="text-muted-foreground">{v.vehicle_type}</span>
                          {v.selected && <Badge tone="neutral">Actual</Badge>}
                        </span>
                        <span className="tabular mt-0.5 block text-xs text-muted-foreground">
                          {fmtT(v.capacity_t)} t
                          {!v.fits && data.multi_allowed ? " (parcial)" : ""}
                          {v.home_name ? ` · ${v.home_name}` : ""}
                          {v.distance_km != null ? ` · a ${v.distance_km.toLocaleString("es-CO")} km de la salida` : ""}
                        </span>
                        {!v.available && v.reason && <span className="mt-0.5 block text-xs text-destructive">{v.reason}</span>}
                        {v.available && !v.fits && !data.multi_allowed && (
                          <span className="mt-0.5 block text-xs text-warning">No alcanza para la carga sola</span>
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <p className={cn("tabular mt-3 text-xs", short ? "text-destructive" : "text-muted-foreground")} aria-live="polite">
              {chosen.length === 0
                ? "Elige un vehículo."
                : short
                  ? `Capacidad elegida ${fmtT(capacity)} t: no alcanza para ${fmtT(data.load_t)} t.`
                  : `Capacidad elegida ${fmtT(capacity)} t para ${fmtT(data.load_t)} t.`}
            </p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              {data.pinned && !data.locked && (
                <Button variant="secondary" disabled={busy} onClick={() => save([])}>
                  Volver a automático
                </Button>
              )}
              <Button disabled={busy || data.locked || chosen.length === 0 || short} onClick={() => save(picked)}>
                {busy ? "Guardando…" : "Asignar"}
              </Button>
            </div>
          </>
        )}
      </Sheet>
    </>
  );
}
