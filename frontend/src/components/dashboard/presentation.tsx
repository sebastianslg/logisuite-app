"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Presentation, X } from "lucide-react";

import { AlertRows, buildAlertItems } from "@/components/dashboard/attention";
import { useApp } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Delta, Sparkline } from "@/components/ui/sparkline";
import { MODES } from "@/lib/modes";
import { EASE } from "@/lib/motion";
import type { DashboardSummary } from "@/lib/types";
import { useHydrated } from "@/lib/use-hydrated";
import { useLive } from "@/lib/use-live";

/**
 * Modo presentación: el resumen a pantalla completa y con letra grande, para proyectarlo en clase o en una sala.
 * Solo pide datos mientras está abierto (cada 30 s, en pausa si la pestaña se oculta). Esc o el botón lo cierran;
 * si el navegador permite pantalla completa, la usa.
 */
export function PresentButton() {
  const [open, setOpen] = useState(false);
  const hydrated = useHydrated();
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} className="print:hidden">
        <Presentation />
        Presentar
      </Button>
      {hydrated &&
        createPortal(<AnimatePresence>{open && <PresentationView onClose={() => setOpen(false)} />}</AnimatePresence>, document.body)}
    </>
  );
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function PresentationView({ onClose }: { onClose: () => void }) {
  const data = useLive<DashboardSummary | null>("/api/dashboard/summary", 30_000, null);
  const { money } = useApp();
  const now = useClock();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    el?.requestFullscreen?.().catch(() => {
      /* sin permiso de pantalla completa: queda como capa a toda la ventana */
    });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    // Si el usuario sale de la pantalla completa (Esc del navegador), también se cierra la vista
    const onFs = () => !document.fullscreenElement && onClose();
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFs);
      document.body.style.overflow = prev;
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [onClose]);

  const k = data?.kpis;
  const series = data?.trends.series ?? [];
  const dates = series.map((d) => d.date);
  const items = data ? buildAlertItems(data.alerts).slice(0, 5) : [];
  const figures = k
    ? [
        { label: "Envíos en ruta", value: String(k.active.value ?? 0), trend: series.map((d) => d.in_transit), change: data.trends.week_vs_prev.in_transit, good: "none" as const },
        { label: "Con retraso", value: String(k.delayed.value ?? 0), trend: series.map((d) => d.delayed), change: data.trends.week_vs_prev.delayed, good: "down" as const, danger: (k.delayed.value ?? 0) > 0 },
        { label: "Costo comprometido en tránsito", value: money(k.cost_in_transit.value ?? 0, true), trend: series.map((d) => d.cost_in_transit), change: data.trends.week_vs_prev.cost_in_transit, good: "none" as const, money: true },
      ]
    : [];

  return (
    <motion.div
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-label="Modo presentación"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.3, ease: EASE } }}
      exit={{ opacity: 0, transition: { duration: 0.2, ease: EASE } }}
      className="fixed inset-0 z-[80] flex flex-col overflow-y-auto bg-background px-[4vw] py-[3vh] text-foreground"
    >
      <header className="flex items-baseline justify-between gap-6">
        <div>
          <div className="text-[clamp(1.25rem,1.6vw,1.75rem)] font-semibold tracking-[-0.02em]">Torre de control</div>
          <div className="tabular text-[clamp(0.875rem,1vw,1.125rem)] text-muted-foreground">
            {now.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })} ·{" "}
            {now.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }).replace(/\s/g, " ")} · se actualiza cada 30 s
          </div>
        </div>
        <Button variant="ghost" onClick={onClose} aria-label="Salir del modo presentación">
          <X /> Salir <kbd className="ml-1 rounded border border-border px-1 text-[11px] text-muted-foreground">Esc</kbd>
        </Button>
      </header>

      {!data ? (
        <div className="mt-[6vh] grid flex-1 grid-cols-3 gap-[3vw]" aria-busy>
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-[30vh] rounded-3xl" />
          ))}
        </div>
      ) : (
        <>
          <section aria-label="Cifras principales" className="mt-[5vh] grid grid-cols-1 gap-[3vw] md:grid-cols-[1fr_1fr_1.4fr]">
            {figures.map((f) => (
              <div key={f.label} className="border-t border-border pt-[2.5vh]">
                <div className="text-[clamp(1rem,1.3vw,1.5rem)] text-muted-foreground">{f.label}</div>
                <div
                  className={`tabular mt-[1.5vh] leading-[0.9] font-semibold tracking-[-0.05em] whitespace-nowrap ${
                    f.money ? "text-[clamp(2.75rem,5.2vw,6.5rem)]" : "text-[clamp(3.5rem,7vw,8.5rem)]"
                  } ${f.danger ? "text-destructive" : ""}`}
                >
                  {f.value}
                </div>
                <Sparkline
                  values={f.trend}
                  dates={dates}
                  format={f.money ? (n) => money(n, true) : undefined}
                  label={`${f.label}, últimos 14 días`}
                  color={f.danger ? "var(--danger)" : "var(--accent)"}
                  className="mt-[2.5vh] max-w-[22rem]"
                />
                <Delta pct={f.change} good={f.good} className="mt-2 text-[clamp(0.875rem,1vw,1.0625rem)]" />
              </div>
            ))}
          </section>

          <div className="mt-[6vh] grid gap-[3vw] lg:grid-cols-[1.3fr_1fr]">
            <section aria-labelledby="pres-attn">
              <h2 id="pres-attn" className="text-[clamp(1rem,1.3vw,1.375rem)] font-semibold">
                Requiere atención
              </h2>
              {/* zoom: las filas de avisos son las del resumen, más grandes para leerse de lejos */}
              <div className="glass mt-3 overflow-hidden rounded-3xl [zoom:1.2]">
                {items.length ? <AlertRows items={items} /> : <p className="px-6 py-5 text-muted-foreground">Todo en orden.</p>}
              </div>
            </section>
            <section aria-labelledby="pres-modes">
              <h2 id="pres-modes" className="text-[clamp(1rem,1.3vw,1.375rem)] font-semibold">
                Reparto modal
              </h2>
              <div className="mt-4 flex h-3 overflow-hidden rounded-full" aria-hidden>
                {data.modal_split.map((m) => (
                  <span key={m.mode} style={{ width: `${m.share_pct}%`, backgroundColor: MODES[m.mode].color }} className="h-full border-r-2 border-background last:border-r-0" />
                ))}
              </div>
              <ul className="mt-4 flex flex-col gap-2.5">
                {data.modal_split.map((m) => {
                  const Icon = MODES[m.mode].icon;
                  return (
                    <li key={m.mode} className="flex items-center gap-3 text-[clamp(0.9375rem,1.1vw,1.25rem)]">
                      <Icon className="size-[1.1em]" style={{ color: MODES[m.mode].color }} aria-hidden />
                      <span className="flex-1">{MODES[m.mode].label}</span>
                      <span className="tabular font-semibold">{m.share_pct.toLocaleString("es-CO")} %</span>
                    </li>
                  );
                })}
              </ul>
              <h2 className="mt-[4vh] text-[clamp(1rem,1.3vw,1.375rem)] font-semibold">Corredores más cargados</h2>
              <ol className="mt-3 flex flex-col gap-2 text-[clamp(0.9375rem,1.1vw,1.25rem)]">
                {data.top_corridors.slice(0, 4).map((c) => (
                  <li key={c.corridor} className="flex justify-between gap-4">
                    <span className="truncate">{c.corridor}</span>
                    <span className="tabular shrink-0 font-semibold">{c.tons_fmt}</span>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </>
      )}
    </motion.div>
  );
}
