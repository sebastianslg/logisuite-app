"use client";

import { motion } from "framer-motion";

import { T_VIEW } from "@/lib/motion";

/** Transición de vista: fundido + deslizamiento hacia arriba (template.tsx se remonta en cada navegación). */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={T_VIEW}
      className="min-h-full"
    >
      {children}
    </motion.div>
  );
}
