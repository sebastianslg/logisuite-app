"use client";

import { Maximize2 } from "lucide-react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { EASE as ease, hoverLift } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** Contenedor de la cuadrícula: escalona la entrada de sus celdas. */
export function BentoGrid({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.03 } } }}
      className={cn("grid grid-cols-2 gap-3 md:grid-cols-6 md:gap-4 xl:grid-cols-12", className)}
    >
      {children}
    </motion.div>
  );
}

// Entrada breve: la página carga para trabajar, no para ver una coreografía
const cellVariants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease } },
};

/** Panel principal del dashboard: vidrio de 24 px de radio. */
export function BentoCell({
  className,
  children,
  title,
  description,
  action,
  onOpen,
  ...props
}: HTMLMotionProps<"section"> & {
  /** Si se define, el panel completo se puede pulsar (clic, Enter o Espacio) para ampliarlo. */
  onOpen?: () => void;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <motion.section
      variants={cellVariants}
      whileHover={onOpen ? hoverLift : undefined}
      {...(onOpen
        ? {
            role: "button",
            tabIndex: 0,
            "aria-label": `Ampliar: ${title ?? "detalle"}`,
            onClick: onOpen,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                onOpen();
              }
            },
          }
        : {})}
      className={cn(
        "glass relative col-span-2 flex flex-col overflow-hidden rounded-3xl outline-none md:col-span-1",
        onOpen && "lift cursor-pointer focus-visible:ring-[3px] focus-visible:ring-ring/80",
        className,
      )}
      {...props}
    >
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-4">
          {/* El título habla solo: sin ícono en recuadro (el ícono decorativo convierte cada panel en una plantilla) */}
          <div className="min-w-0">
            <h2 className="truncate text-[0.9375rem] font-semibold tracking-[-0.01em]">{title}</h2>
            {description && <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{description}</p>}
          </div>
          {action}
          {onOpen && !action && (
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground" aria-hidden>
              <Maximize2 className="size-3.5" />
            </span>
          )}
        </header>
      )}
      {children as React.ReactNode}
    </motion.section>
  );
}

