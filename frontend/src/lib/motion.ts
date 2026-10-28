/**
 * Movimiento de Westvane ("Apple motion"): una sola curva con resorte suave para
 * toda transición, 0,3 s en interacciones rápidas y 0,5 s en entradas de vista.
 * framer-motion respeta "Reducir movimiento" vía <MotionProvider>.
 */
export const EASE = [0.16, 1, 0.3, 1] as const;

export const T_FAST = { duration: 0.3, ease: EASE } as const;
export const T_VIEW = { duration: 0.5, ease: EASE } as const;

/** Retraso en cascada: 0,05 s por elemento, de arriba hacia abajo (con tope). */
export const stagger = (i: number, step = 0.05, max = 0.6) => Math.min(i * step, max);

/**
 * Hover de superficies clicables con framer-motion: ya no hay escala ni sombra (ver la utilidad `lift` de
 * globals.css). Se conserva el nombre para los componentes que lo usan; no mueve nada.
 */
export const hoverLift = {} as const;

/** Resorte estándar: solo para indicadores que se deslizan (layoutId) y para el morph del mapa. */
export const SPRING = { type: "spring", stiffness: 420, damping: 38, mass: 0.8 } as const;
