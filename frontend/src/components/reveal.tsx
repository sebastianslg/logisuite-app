"use client";

import { motion } from "framer-motion";

import { EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Entrada de un bloque de la vista: fundido + deslizamiento de 12 px hacia arriba (0,5 s) cuando entra
 * en pantalla, una sola vez. El `index` escalona la cascada (0,05 s por bloque, máximo 0,4 s).
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
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, ease: EASE, delay: Math.min(index * 0.05, 0.4) }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}
