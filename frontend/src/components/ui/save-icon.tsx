"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Save } from "lucide-react";

import { EASE } from "@/lib/motion";

export type SaveState = "idle" | "busy" | "done";

/**
 * Ícono del botón Guardar: disquete en reposo, un punto que respira mientras guarda y, al guardar con éxito, cambia a
 * Check con escala y fundido (250 ms). Con "Reducir movimiento" el cambio es un fundido simple.
 */
export function SaveIcon({ state }: { state: SaveState }) {
  return (
    <span className="relative inline-flex size-4 items-center justify-center" aria-hidden>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={state}
          className="absolute inset-0 inline-flex items-center justify-center"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          transition={{ duration: 0.25, ease: EASE }}
        >
          {state === "busy" ? (
            // Guardando: un punto que respira, más calmado que un giro
            <span className="size-2 rounded-full bg-current [animation:breathe_1.2s_var(--ease-apple)_infinite] motion-reduce:animate-none" />
          ) : state === "done" ? (
            <Check />
          ) : (
            <Save />
          )}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Marca de "guardado" que dura 1,6 s (para el Check del botón). Se limpia al desmontar. */
export function useSavedFlash(ms = 1600): [boolean, () => void] {
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const flash = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setDone(true);
    timer.current = setTimeout(() => setDone(false), ms);
  }, [ms]);
  return [done, flash];
}
