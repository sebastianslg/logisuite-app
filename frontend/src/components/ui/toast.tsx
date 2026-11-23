"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";

import { EASE, SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Avisos breves (toasts). `toast({ title })` se puede llamar desde cualquier componente cliente.
 * Cola de máximo 3 avisos (el más antiguo sale primero) y cierre automático a los 4 s, en pausa al pasar el puntero o con la
 * pestaña oculta, con una barra del tiempo que queda; se cierran deslizando hacia un lado. Entran desde abajo
 * con resorte y salen con fundido; con "Reducir movimiento" solo hay fundido. Se anuncian a lectores de
 * pantalla (región aria-live). En celular quedan por encima del dock inferior.
 */
type Tone = "success" | "error" | "info";
type Toast = { id: number; title: string; description?: string; tone: Tone };

const MAX = 3;
const LIFETIME = 4000;
let items: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast({ title, description, tone = "success" }: { title: string; description?: string; tone?: Tone }) {
  items = [...items, { id: nextId++, title, description, tone }].slice(-MAX);
  emit();
}

function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
const EMPTY: Toast[] = [];

const ICON = { success: CircleCheck, error: CircleAlert, info: Info } as const;
const COLOR = { success: "text-success", error: "text-destructive", info: "text-primary" } as const;

export function Toaster() {
  const list = useSyncExternalStore(subscribe, () => items, () => EMPTY);
  return (
    <div
      aria-live="polite"
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-[80] flex flex-col items-center gap-2 px-4 md:bottom-6"
    >
      <AnimatePresence initial={false}>
        {list.map((t) => (
          <ToastItem key={t.id} toast={t} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ toast: t }: { toast: Toast }) {
  // Temporizador que se pausa al pasar el puntero, al enfocar el aviso o con la pestaña oculta (patrón de Sonner): un aviso
  // que se está leyendo no se va. La barra fina de abajo muestra el tiempo que queda (scaleX lineal, se congela en pausa).
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const left = useRef(LIFETIME);
  const bar = useRef<HTMLSpanElement>(null);
  const stopped = paused || hidden;

  useEffect(() => {
    const onVis = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (stopped) return;
    const start = performance.now();
    const id = window.setTimeout(() => dismiss(t.id), left.current);
    const anim = bar.current?.animate([{ transform: `scaleX(${left.current / LIFETIME})` }, { transform: "scaleX(0)" }], {
      duration: left.current,
      easing: "linear",
      fill: "forwards",
    });
    return () => {
      window.clearTimeout(id);
      left.current = Math.max(0, left.current - (performance.now() - start));
      anim?.pause();
    };
  }, [stopped, t.id]);

  const Icon = ICON[t.tone];
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1, transition: SPRING }}
      exit={{ opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.18, ease: EASE } }}
      drag="x"
      dragSnapToOrigin
      dragElastic={0.4}
      onDragEnd={(_, info) => {
        // Se cierra por distancia o por impulso: un gesto rápido basta aunque no llegue al umbral
        if (Math.abs(info.offset.x) > 90 || Math.abs(info.velocity.x) > 500) dismiss(t.id);
      }}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      className="floating pointer-events-auto relative flex w-full max-w-sm cursor-grab touch-pan-y items-start gap-3 overflow-hidden rounded-[20px] px-4 py-3 active:cursor-grabbing"
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", COLOR[t.tone])} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{t.title}</p>
        {t.description && <p className="mt-0.5 text-[13px] text-muted-foreground">{t.description}</p>}
      </div>
      <button
        type="button"
        onClick={() => dismiss(t.id)}
        aria-label="Cerrar aviso"
        className="press -m-1.5 flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-fill hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/80"
      >
        <X className="size-4" aria-hidden />
      </button>
      <span
        ref={bar}
        aria-hidden
        className={cn("absolute inset-x-0 bottom-0 h-0.5 origin-left opacity-60 motion-reduce:hidden", t.tone === "error" ? "bg-destructive" : t.tone === "info" ? "bg-primary" : "bg-success")}
      />
    </motion.div>
  );
}
