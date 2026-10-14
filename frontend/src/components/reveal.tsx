"use client";

import { motion } from "framer-motion";

import { EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Entrada de un bloque de la vista: fundido + deslizamiento hacia arriba (0,5 s).
 * El `index` escalona la cascada de arriba hacia abajo (0,05 s por bloque).
 */
export function Reveal({
  index = 0,
  className,
  children,
}: {
  index?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay: Math.min(index * 0.05, 0.6) }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}
