"use client";

import Link from "next/link";
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
      variants={{ show: { transition: { staggerChildren: 0.05 } } }}
      className={cn("grid grid-cols-1 gap-4 md:grid-cols-6 xl:grid-cols-12", className)}
    >
      {children}
    </motion.div>
  );
}

const cellVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
};

/** Panel principal del dashboard: vidrio de 24 px de radio. */
export function BentoCell({
  className,
  children,
  title,
  description,
  icon,
  action,
  onOpen,
  ...props
}: HTMLMotionProps<"section"> & {
  /** Si se define, el panel completo se puede pulsar (clic, Enter o Espacio) para ampliarlo. */
  onOpen?: () => void;
  title?: string;
  description?: string;
  /** Elemento ya renderizado (ej. <Radio />): los Server Components no pueden pasar componentes. */
  icon?: React.ReactNode;
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
        "glass relative flex flex-col overflow-hidden rounded-3xl outline-none",
        onOpen && "cursor-pointer focus-visible:ring-[3px] focus-visible:ring-ring/50",
        className,
      )}
      {...props}
    >
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-4">
          <div className="flex min-w-0 items-center gap-2.5">
            {icon && (
              <span className="flex size-7 items-center justify-center rounded-md bg-fill text-muted-foreground [&_svg]:size-4">
                {icon}
              </span>
            )}
            <div className="min-w-0">
              <h2 className="truncate text-[0.9375rem] font-semibold tracking-tight">{title}</h2>
              {description && <p className="truncate text-xs text-muted-foreground">{description}</p>}
            </div>
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

const MotionLink = motion.create(Link);

/**
 * Tarjeta KPI. El color del ícono solo aparece cuando el KPI corresponde a un
 * estado (verde = en ruta, naranja = transbordo); el resto va en gris neutro.
 */
export function KpiCard({
  label,
  value,
  icon,
  accent,
  footnote,
  className,
  href,
}: {
  /** Destino al pulsar la tarjeta (lista filtrada, detalle…). */
  href?: string;
  label: string;
  value: React.ReactNode;
  /** Elemento ya renderizado (ej. <Gauge />). */
  icon: React.ReactNode;
  /** Color de estado opcional (variable CSS). */
  accent?: string;
  footnote?: React.ReactNode;
  className?: string;
}) {
  const Comp = href ? MotionLink : motion.div;
  return (
    <Comp
      {...(href ? { href } : {})}
      variants={cellVariants}
      whileHover={hoverLift}
      className={cn(
        "glass relative block rounded-2xl p-5 outline-none",
        href && "cursor-pointer focus-visible:ring-[3px] focus-visible:ring-ring/50",
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span
          className="flex size-8 items-center justify-center rounded-full bg-fill text-muted-foreground [&_svg]:size-4"
          style={accent ? { color: accent, backgroundColor: `color-mix(in srgb, ${accent} 14%, transparent)` } : undefined}
        >
          {icon}
        </span>
      </div>
      <div className="tabular mt-3 text-3xl font-bold tracking-tight">{value}</div>
      {footnote && <div className="mt-1.5 text-sm text-muted-foreground">{footnote}</div>}
    </Comp>
  );
}
