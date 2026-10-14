"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, LoaderCircle, PackagePlus } from "lucide-react";

import { ModeChain } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { Sheet } from "@/components/ui/sheet";
import { PRIORITIES } from "@/lib/modes";
import type { Shipment, SimulateResponse } from "@/lib/types";

const DEPARTURES = [
  { value: 0, label: "Ahora" },
  { value: 2, label: "En 2 horas" },
  { value: 6, label: "En 6 horas" },
  { value: 24, label: "Mañana (24 h)" },
  { value: 48, label: "En 2 días" },
];

/** Crea un envío con la ruta simulada y muestra su costo, tiempo, combustible y CO₂e antes de confirmar. */
export function CreateShipmentSheet({
  open,
  onClose,
  result,
  weight,
}: {
  open: boolean;
  onClose: () => void;
  result: SimulateResponse;
  weight: number;
}) {
  const r = result.route;
  const fp = result.footprint;
  const [cargo, setCargo] = useState("Carga general");
  const [client, setClient] = useState("");
  const [departure, setDeparture] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Shipment | null>(null);

  const valid = cargo.trim().length >= 2 && client.trim().length >= 2;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/shipments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          origen: r.origin,
          destino: r.destination,
          prioridad: r.priority,
          peso_t: weight,
          carga: cargo.trim(),
          cliente: client.trim(),
          salida_en_h: departure,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : "No se pudo crear el envío");
      setCreated(data as Shipment);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo contactar la API");
    } finally {
      setSaving(false);
    }
  }

  const close = () => {
    onClose();
    // Tras cerrar la confirmación, el formulario queda listo para otro envío
    setTimeout(() => setCreated(null), 400);
  };

  return (
    <Sheet open={open} onClose={close} title={created ? "Envío creado" : "Crear envío"} description={`${r.origin} → ${r.destination}`}>
      {created ? (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-success/14 text-success">
            <Check className="size-7" aria-hidden />
          </span>
          <div>
            <div className="font-mono text-lg font-bold">{created.code}</div>
            <p className="mt-1 text-muted-foreground">
              Quedó en la operación con estado <strong className="text-foreground">{created.status}</strong>. Aparecerá en la flota en vivo en unos segundos.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link href={`/envios/${created.code}`}>Ver envío</Link>
            </Button>
            <Button variant="secondary" onClick={close}>
              Seguir en el simulador
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <section aria-label="Resumen de la ruta" className="rounded-2xl bg-fill p-4">
            <ModeChain modes={r.modes} />
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
              {[
                ["Prioridad", PRIORITIES[r.priority]],
                ["Peso", r.weight_fmt],
                ["Distancia", r.distance_fmt],
                ["Tiempo", r.time_fmt],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className="tabular font-medium">{v}</dd>
                </div>
              ))}
              <div>
                <dt className="text-xs text-muted-foreground">Flete</dt>
                <dd className="tabular font-medium"><Money usd={r.cost} /></dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">CO₂e</dt>
                <dd className="tabular font-medium">{fp.co2e_fmt}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Combustible</dt>
                <dd className="tabular font-medium">{fp.fuel_fmt}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Frente a carretera</dt>
                <dd className="tabular font-medium">
                  {fp.saved_vs_road_pct === 0
                    ? "Igual que por carretera"
                    : fp.saved_vs_road_pct > 0
                      ? `−${fp.saved_vs_road_pct.toLocaleString("es-CO")} % CO₂e`
                      : `+${Math.abs(fp.saved_vs_road_pct).toLocaleString("es-CO")} % CO₂e`}
                </dd>
              </div>
            </dl>
          </section>

          <label className="block text-sm">
            <span className="font-medium">Carga</span>
            <input
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
              maxLength={120}
              required
              className="mt-1.5 h-10 w-full rounded-xl bg-fill px-3 outline-none focus:ring-[3px] focus:ring-ring/50 pointer-coarse:h-12"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Cliente</span>
            <input
              value={client}
              onChange={(e) => setClient(e.target.value)}
              maxLength={120}
              required
              placeholder="Nombre del cliente"
              className="mt-1.5 h-10 w-full rounded-xl bg-fill px-3 outline-none placeholder:text-muted-foreground focus:ring-[3px] focus:ring-ring/50 pointer-coarse:h-12"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Salida</span>
            <select
              value={departure}
              onChange={(e) => setDeparture(Number(e.target.value))}
              className="mt-1.5 h-10 w-full rounded-xl bg-fill px-3 outline-none focus:ring-[3px] focus:ring-ring/50 pointer-coarse:h-12"
            >
              {DEPARTURES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>

          {error && (
            <p role="alert" className="rounded-2xl bg-destructive/12 p-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={close}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!valid || saving}>
              {saving ? <LoaderCircle className="animate-spin" /> : <PackagePlus />}
              Crear envío
            </Button>
          </div>
        </form>
      )}
    </Sheet>
  );
}
