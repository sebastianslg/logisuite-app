"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, CircleCheck } from "lucide-react";

import { AlertRows, buildAlertItems } from "@/components/dashboard/attention";
import { EASE } from "@/lib/motion";
import type { AlertsResponse } from "@/lib/types";
import { useLocal } from "@/lib/local";
import { useLive } from "@/lib/use-live";
import { cn } from "@/lib/utils";

const NONE_SEEN: string[] = [];
/** Firma de un aviso: si cambia su texto (por ejemplo, de 2 a 3 vías cerradas), vuelve a ser nuevo. */
const sig = (i: { key: string; title: string }) => `${i.key}|${i.title}`;

/**
 * Avisos operativos: un sondeo compartido cada 60 s, en pausa con la pestaña oculta. Recuerda en este navegador
 * cuáles ya se vieron: `unseen` cuenta solo lo nuevo desde la última vez que se abrió el panel.
 */
export function useAlerts() {
  const data = useLive<AlertsResponse | null>("/api/alerts", 60_000, null);
  const [seen, setSeen] = useLocal<string[]>("westvane.alerts-seen", NONE_SEEN);
  const items = (data ? buildAlertItems(data.alerts) : []).map((i) => ({ ...i, fresh: !seen.includes(sig(i)) }));
  const urgent = items.filter((i) => i.tone === "danger").length;
  const unseen = items.filter((i) => i.fresh).length;
  const key = items.map(sig).join("~");
  const markSeen = useCallback(() => {
    if (key) setSeen(key.split("~"));
    // la clave resume los avisos actuales
  }, [key, setSeen]);
  return { items, urgent, unseen, markSeen, ready: !!data };
}

/**
 * Cifra sobre la campana: cuántos avisos son nuevos. Roja si hay algo que impide operar, naranja si solo hay
 * avisos. Si todo ya se vio pero sigue habiendo algo urgente, queda un punto rojo sin número.
 */
export function AlertCount({ count, urgent, className }: { count: number; urgent: number; className?: string }) {
  if (!count && urgent)
    return (
      <span
        className={cn("absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-destructive ring-2 ring-[var(--card)]", className && "-top-1 -right-1")}
        aria-hidden
      />
    );
  if (!count) return null;
  // key: cuando llega un aviso nuevo la cifra se vuelve a montar y entra con un pequeño salto (badge-pop)
  return (
    <span
      key={count}
      className={cn(
        "badge-pop tabular absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] leading-none font-semibold text-white ring-2 ring-[var(--card)]",
        urgent ? "bg-destructive" : "bg-warning",
        className,
      )}
      aria-hidden
    >
      {count}
    </span>
  );
}

/** Lista de avisos (o "todo en orden"), para el panel del dock y la hoja del celular. */
export function AlertsList({ onNavigate, limit }: { onNavigate?: () => void; limit?: number }) {
  const { items, ready } = useAlerts();
  if (!ready) return <div className="skeleton m-4 h-16 rounded-2xl" aria-hidden />;
  if (items.length === 0)
    return (
      <p className="flex items-center gap-2.5 px-5 py-4 text-sm text-muted-foreground">
        <CircleCheck className="size-4 shrink-0 text-success" aria-hidden />
        Todo en orden: sin cierres, envíos sin ruta ni retrasos.
      </p>
    );
  const shown = limit ? items.slice(0, limit) : items;
  return (
    <>
      <AlertRows items={shown} onNavigate={onNavigate} />
      {shown.length < items.length && (
        <Link href="/" onClick={onNavigate} className="block border-t border-border px-5 py-3 text-[13px] font-medium text-primary">
          Ver {items.length - shown.length} más en el resumen
        </Link>
      )}
    </>
  );
}

/** Campana del dock de escritorio: abre un panel con lo que requiere atención, desde cualquier página. */
export function AlertsMenu() {
  const { items, urgent, unseen, markSeen } = useAlerts();
  const [open, setOpen] = useState(false);
  // Al cerrar el panel, lo que se mostró queda como visto
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) markSeen();
    wasOpen.current = open;
  }, [open, markSeen]);
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = items.length
    ? `Avisos: ${items.length}${urgent ? `, ${urgent} ${urgent === 1 ? "urgente" : "urgentes"}` : ""}${unseen ? `, ${unseen} ${unseen === 1 ? "nuevo" : "nuevos"}` : ", todos vistos"}`
    : "Avisos: todo en orden";

  return (
    <div ref={ref} className="relative">
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        aria-haspopup="true"
        aria-label={label}
        title={label}
        className="press relative flex size-10 items-center justify-center rounded-full bg-fill text-foreground outline-none hover:bg-fill/70 focus-visible:ring-[3px] focus-visible:ring-ring/80"
      >
        <Bell className="size-4" aria-hidden />
        <AlertCount count={unseen} urgent={urgent} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id={id}
            initial={{ opacity: 0, scale: 0.96, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: 0.2, ease: EASE } }}
            exit={{ opacity: 0, scale: 0.96, y: -6, transition: { duration: 0.15, ease: EASE } }}
            style={{ transformOrigin: "top right" }}
            className="floating absolute top-full right-0 z-40 mt-3 w-[min(26rem,calc(100vw-2rem))] overflow-hidden rounded-[20px]"
          >
            <div className="flex items-baseline justify-between gap-3 border-b border-border px-5 py-3.5">
              <h2 className="text-[0.9375rem] font-semibold">Requiere atención</h2>
              {items.length > 0 && (
                <span className="tabular text-[13px] text-muted-foreground">
                  {urgent ? `${urgent} ${urgent === 1 ? "urgente" : "urgentes"} · ` : ""}
                  {items.length} en total
                </span>
              )}
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              <AlertsList onNavigate={() => setOpen(false)} />
            </div>
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="block border-t border-border px-5 py-3 text-[13px] font-medium text-primary outline-none hover:bg-fill/50 focus-visible:ring-[3px] focus-visible:ring-ring/80 focus-visible:ring-inset"
            >
              Ver el resumen completo
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
