"use client";

import { AnimatePresence, motion } from "framer-motion";

/** Tooltip de gráfico: superficie elevada, texto en tinta de texto (no color de serie). */
export function ChartTooltip({
  open,
  x,
  y,
  children,
}: {
  open: boolean;
  /** Posición horizontal: píxeles o cualquier longitud CSS (ej. "40%"). */
  x: number | string;
  y: number;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="tooltip"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-md border border-white/10 bg-[#111827]/95 px-2.5 py-1.5 text-xs whitespace-nowrap shadow-xl backdrop-blur"
          style={{ left: x, top: y - 8 }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
