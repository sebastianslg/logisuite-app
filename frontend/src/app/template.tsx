"use client";

import { motion } from "framer-motion";

import { EASE } from "@/lib/motion";

/**
 * Transición de vista (template.tsx se remonta en cada navegación): fundido de 220 ms con 4 px de subida.
 * Breve a propósito: en una herramienta de trabajo la página nueva debe estar lista, no presentarse.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: EASE }}
      className="min-h-full"
    >
      {children}
    </motion.div>
  );
}
