"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

import { EASE, T_FAST } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Panel con título que se pliega y despliega sin saltos. No anima `height`: el panel usa la animación
 * de layout de framer-motion (escala por transform, con el contenido corregido para no deformarse) y el
 * contenido entra con opacidad y 6 px de desplazamiento. Los paneles vecinos que también son `motion`
 * con `layout` (otros CollapsiblePanel) se desplazan por transform al cambiar la altura.
 * Con "Reducir movimiento" (MotionConfig) aparece y desaparece sin transición de posición.
 *
 * `collapsible={false}` deja el panel siempre abierto pero conserva el layout para acompañar a sus vecinos.
 */
export function CollapsiblePanel({
  title,
  icon,
  defaultOpen = true,
  collapsible = true,
  className,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  collapsible?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  const shown = !collapsible || open;

  return (
    <motion.section layout transition={T_FAST} className={cn("glass rounded-3xl p-5", className)} style={{ borderRadius: 24 }}>
      <motion.header layout="position" transition={T_FAST} className="flex items-center justify-between gap-3">
        {collapsible ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={id}
            className="press -mx-2 -my-1 flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-1 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/80"
          >
            <ChevronDown
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
                !open && "-rotate-90",
              )}
              aria-hidden
            />
            <h2 className="truncate text-sm font-medium">{title}</h2>
          </button>
        ) : (
          <h2 className="text-sm font-medium">{title}</h2>
        )}
        {icon}
      </motion.header>
      <AnimatePresence initial={false} mode="popLayout">
        {shown && (
          <motion.div
            key="content"
            id={id}
            layout="position"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.15, ease: EASE } }}
            transition={T_FAST}
            className="pt-3"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
