"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRightLeft, Check, ChevronRight, Clock, Copy, CopyPlus, Fuel, Leaf, MapIcon, Route, Weight } from "lucide-react";
import { motion } from "framer-motion";

import { Map3DLazy, MapLoading } from "@/components/map/map-3d-lazy";
import { useMapData } from "@/components/map/use-map-data";
import { Reveal } from "@/components/reveal";
import { ModeChain, ModeIcon, StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { CountUp } from "@/components/ui/count-up";
import { Dial } from "@/components/ui/dial";
import { Money } from "@/components/ui/money";
import { MODE_ORDER, MODES, PRIORITIES } from "@/lib/modes";
import { hoverLift } from "@/lib/motion";
import type { Mode, RouteResult, Shipment } from "@/lib/types";

const when = (iso: string) =>
  new Date(iso).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Detalle de un envío: mapa de su ruta, línea de tiempo por tramo, costo y huella. */
export function ShipmentDetail({ shipment: s }: { shipment: Shipment }) {
  const { network, departments, fleet, error } = useMapData();
  const [copied, setCopied] = useState(false);
  const fp = s.footprint;

  const route: RouteResult | null =
    s.legs && s.transfers && s.trip
      ? {
          origin: s.origin,
          destination: s.destination,
          priority: s.priority,
          weight_t: s.weight_t,
          weight_fmt: s.weight_fmt,
          modes: s.modes,
          mode_labels: s.mode_labels,
          n_transfers: s.n_transfers,
          distance_km: s.distance_km,
          distance_fmt: s.distance_fmt,
          time_h: s.time_h,
          time_fmt: s.time_fmt,
          cost: s.cost,
          cost_fmt: s.cost_fmt,
          cost_per_t: s.cost / (s.weight_t || 1),
          cost_per_t_fmt: "",
          legs: s.legs,
          transfers: s.transfers,
          trip: s.trip,
        }
      : null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(s.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* el navegador no permite copiar: el código sigue visible en pantalla */
    }
  };

  const duplicate = `/red?crear=1&origen=${encodeURIComponent(s.origin)}&destino=${encodeURIComponent(s.destination)}&peso=${s.weight_t}&prioridad=${s.priority}`;

  const stats = [
    { icon: <Route />, label: "Distancia", value: s.distance_fmt },
    { icon: <Clock />, label: "Tiempo", value: s.time_fmt },
    { icon: <Weight />, label: "Peso", value: s.weight_fmt },
    { icon: <ArrowRightLeft />, label: "Transbordos", value: String(s.n_transfers) },
  ];

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 lg:px-10">
      <Reveal>
        <nav aria-label="Ruta de navegación" className="mb-3 flex items-center gap-1 text-sm text-muted-foreground">
          <Link href="/envios" className="rounded-md outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
            Envíos
          </Link>
          <ChevronRight className="size-4" aria-hidden />
          <span className="font-mono text-foreground" aria-current="page">{s.code}</span>
        </nav>
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold md:text-[2.125rem] md:leading-tight">
              {s.origin} <span className="text-muted-foreground">→</span> {s.destination}
            </h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-2 text-muted-foreground">
              <StatusBadge status={s.status} />
              <ModeChain modes={s.modes} />
              <span>{s.cargo}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={copy} aria-live="polite">
              {copied ? <Check /> : <Copy />}
              {copied ? "Copiado" : "Copiar código"}
            </Button>
            <Button asChild>
              <Link href={duplicate}>
                <CopyPlus /> Duplicar envío
              </Link>
            </Button>
          </div>
        </header>
      </Reveal>

      <div className="mt-8 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal index={1} className="grid grid-cols-2 gap-4 md:grid-cols-5 xl:col-span-12">
          <motion.div whileHover={hoverLift} className="glass col-span-2 rounded-2xl p-5 md:col-span-1">
            <div className="text-sm font-medium text-muted-foreground">Flete</div>
            <div className="tabular mt-3 text-2xl font-bold tracking-tight">
              <Money usd={s.cost} />
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              <Money usd={s.cost / (s.weight_t || 1)} /> por t
            </div>
          </motion.div>
          {stats.map((k) => (
            <motion.div key={k.label} whileHover={hoverLift} className="glass rounded-2xl p-5">
              <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                {k.label}
                <span className="[&_svg]:size-4" aria-hidden>{k.icon}</span>
              </div>
              <div className="tabular mt-3 text-2xl font-bold tracking-tight">{k.value}</div>
            </motion.div>
          ))}
        </Reveal>

        <Reveal index={2} className="glass relative h-[360px] overflow-hidden rounded-3xl md:h-[460px] xl:col-span-7">
          {network && departments && route ? (
            <Map3DLazy network={network} departments={departments} fleet={fleet} route={route} visibleModes={new Set(MODE_ORDER)} showFleet={false} showDepartments />
          ) : (
            <MapLoading label={error ?? undefined} />
          )}
          <Link
            href={`/red?ciudad=${encodeURIComponent(s.origin)}`}
            className="material press absolute top-3 left-3 flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-sm font-medium outline-none hover:bg-fill focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <MapIcon className="size-4" aria-hidden /> Abrir en la red
          </Link>
        </Reveal>

        <Reveal index={3} className="glass rounded-3xl p-5 xl:col-span-5">
          <h2 className="text-[0.9375rem] font-semibold">Recorrido</h2>
          <ol className="mt-4 flex flex-col gap-2">
            {(s.legs ?? []).map((l, i) => {
              const t = s.transfers?.[i];
              const leg = fp?.per_leg[i];
              return (
                <li key={`${l.mode}-${i}`} className="flex flex-col gap-2">
                  <div className="flex gap-3 rounded-2xl bg-fill p-3">
                    <ModeIcon mode={l.mode as Mode} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm font-medium">
                        <span className="truncate">{l.from.name} → {l.to.name}</span>
                        <span className="tabular text-xs font-normal text-muted-foreground">{l.mode_label}</span>
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{l.corridors.join(" · ")}</div>
                      <div className="tabular mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-foreground/80">
                        <span>{l.distance_fmt}</span>
                        <span>{l.time_fmt}</span>
                        <Money usd={l.cost} />
                        {leg && <span>{leg.co2e_kg.toLocaleString("es-CO")} kg CO₂e</span>}
                        {leg && <span>{leg.fuel_l.toLocaleString("es-CO")} L</span>}
                      </div>
                      {l.asset && (
                        <div className="mt-1.5 text-xs text-muted-foreground">
                          {l.asset.id} · {l.asset.type}
                          {l.asset.units > 1 ? ` ×${l.asset.units}` : ""} · {l.asset.carrier}
                        </div>
                      )}
                    </div>
                  </div>
                  {t && (
                    <div className="flex items-center gap-2 pl-3 text-sm text-warning">
                      <ArrowRightLeft className="size-3.5" aria-hidden />
                      <span className="font-medium">{t.label}</span>
                      <span className="truncate text-muted-foreground">
                        {t.node.name} · {t.time_fmt} · <Money usd={t.cost} />
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </Reveal>

        {fp && (
          <Reveal index={4} className="glass rounded-3xl p-5 xl:col-span-7">
            <h2 className="flex items-center gap-2 text-[0.9375rem] font-semibold">
              <Leaf className="size-4 text-success" aria-hidden /> Huella de este envío
            </h2>
            <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row">
              <Dial
                value={Math.max(fp.saved_vs_road_pct, 0)}
                color="var(--sys-green)"
                label="Reducción de CO₂e frente a mover esta carga por carretera"
                sublabel="menos que por carretera"
                size={160}
              />
              <dl className="grid flex-1 grid-cols-2 gap-3">
                <div className="rounded-2xl bg-fill p-3">
                  <dt className="text-xs text-muted-foreground">CO₂e</dt>
                  <dd className="tabular mt-1 text-xl font-bold"><CountUp value={fp.co2e_kg} suffix=" kg" /></dd>
                </div>
                <div className="rounded-2xl bg-fill p-3">
                  <dt className="flex items-center gap-1 text-xs text-muted-foreground"><Fuel className="size-3" aria-hidden /> Combustible</dt>
                  <dd className="tabular mt-1 text-xl font-bold"><CountUp value={fp.fuel_l} suffix=" L" /></dd>
                </div>
                <div className="rounded-2xl bg-fill p-3">
                  <dt className="text-xs text-muted-foreground">Por carretera sería</dt>
                  <dd className="tabular mt-1 text-xl font-bold">{fp.baseline_co2e_kg.toLocaleString("es-CO")} kg</dd>
                </div>
                <div className="rounded-2xl bg-fill p-3">
                  <dt className="text-xs text-muted-foreground">Intensidad</dt>
                  <dd className="tabular mt-1 text-xl font-bold">{fp.intensity_g_tkm.toLocaleString("es-CO")} g/t-km</dd>
                </div>
              </dl>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Estimación por factores de intensidad por modo; no es un inventario certificado.
            </p>
          </Reveal>
        )}

        <Reveal index={5} className="glass rounded-3xl p-5 xl:col-span-5">
          <h2 className="text-[0.9375rem] font-semibold">Información</h2>
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
            {[
              ["Cliente", s.client],
              ["Carga", s.cargo],
              ["Prioridad", PRIORITIES[s.priority]],
              ["Salida", when(s.departure_at)],
              ["ETA", when(s.eta_at)],
              ["Retraso", s.delay_fmt ?? "Sin retraso"],
              ["Avance", `${Math.round(s.progress_pct)} %`],
              ["Modos", s.modes.map((m) => MODES[m].label).join(" → ")],
            ].map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </div>
  );
}
