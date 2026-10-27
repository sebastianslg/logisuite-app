"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Sparkles, type LucideIcon } from "lucide-react";

import { EASE } from "@/lib/motion";

type Particle = { id: number; x: number; y: number; dx: number; rot: number; delay: number };

/**
 * Ráfaga de íconos que flotan hacia arriba desde el punto donde se toca el contenedor.
 * Se monta una vez; `burst(event)` dispara una nueva ráfaga. Con "Reducir movimiento" no hace nada.
 * En pantallas táctiles salen menos chispas (`count - 2`, mínimo 3): el dedo tapa el punto de origen.
 */
export function useBurst(Icon: LucideIcon = Sparkles, count = 6) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const reduced = useReducedMotion();
  const nextId = useRef(0);
  const timers = useRef(new Set<number>());

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => window.clearTimeout(t));
  }, []);

  const burst = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (reduced) return;
      const box = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - box.left;
      const y = e.clientY - box.top;
      const n = e.pointerType === "touch" ? Math.max(3, count - 2) : count;
      const batch = Array.from({ length: n }, (_, i) => ({
        id: nextId.current++,
        x,
        y,
        dx: (Math.random() - 0.5) * 88,
        rot: (Math.random() - 0.5) * 60,
        delay: i * 0.03,
      }));
      setParticles((p) => [...p, ...batch]);
      const t = window.setTimeout(() => {
        timers.current.delete(t);
        const ids = new Set(batch.map((b) => b.id));
        setParticles((p) => p.filter((q) => !ids.has(q.id)));
      }, 1000);
      timers.current.add(t);
    },
    [count, reduced],
  );

  const layer: ReactNode = (
    <AnimatePresence>
      {particles.map((p) => (
        <motion.span
          key={p.id}
          aria-hidden
          className="pointer-events-none absolute z-10 text-primary"
          style={{ left: p.x, top: p.y }}
          initial={{ opacity: 0, x: "-50%", y: "-50%", scale: 0.6, rotate: 0 }}
          animate={{ opacity: [0, 1, 1, 0], x: `calc(-50% + ${p.dx}px)`, y: "calc(-50% - 56px)", scale: 1, rotate: p.rot }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: EASE, delay: p.delay, opacity: { duration: 0.8, delay: p.delay, times: [0, 0.1, 0.55, 1] } }}
        >
          <Icon className="size-3.5" />
        </motion.span>
      ))}
    </AnimatePresence>
  );

  return { burst, layer };
}
