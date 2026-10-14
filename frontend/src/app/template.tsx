"use client";

import { motion } from "framer-motion";

/** Transición de página: solo un fundido breve (template.tsx se vuelve a montar en cada navegación). */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="min-h-full"
    >
      {children}
    </motion.div>
  );
}
