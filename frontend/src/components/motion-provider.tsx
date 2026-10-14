"use client";

import { MotionConfig } from "framer-motion";

/** Respeta "Reducir movimiento" del sistema en todas las animaciones de la app. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
