/**
 * Movimiento de LogiSuite ("Apple motion"): una sola curva con resorte suave para
 * toda transición, 0,3 s en interacciones rápidas y 0,5 s en entradas de vista.
 * framer-motion respeta "Reducir movimiento" vía <MotionProvider>.
 */
export const EASE = [0.16, 1, 0.3, 1] as const;

export const T_FAST = { duration: 0.3, ease: EASE } as const;
export const T_VIEW = { duration: 0.5, ease: EASE } as const;

/** Retraso en cascada: 0,05 s por elemento, de arriba hacia abajo (con tope). */
export const stagger = (i: number, step = 0.05, max = 0.6) => Math.min(i * step, max);

/** Sombra de reposo y elevada del vidrio (mismas capas para poder interpolar). */
export const SHADOW_REST =
  "0 4px 24px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02), 0 0 0 0.5px rgba(0,0,0,0.05)";
export const SHADOW_LIFT =
  "0 16px 48px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06), 0 0 0 0.5px rgba(0,0,0,0.06)";

/** Hover de tarjetas y paneles: escala 1,02, sube 2 px y la sombra se ensancha. */
export const hoverLift = { scale: 1.02, y: -2, boxShadow: SHADOW_LIFT, transition: T_FAST } as const;
