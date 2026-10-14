"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

/** Contenedor de la cuadrícula: escalona la entrada de sus celdas. */
export function BentoGrid({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.03 } } }}
      className={cn("grid grid-cols-1 gap-4 md:grid-cols-6 xl:grid-cols-12", className)}
    >
      {children}
    </motion.div>
  );
}

const cellVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.25, ease } },
};

/** Celda del dashboard: superficie de tarjeta agrupada sobre el fondo, sin borde ni brillo. */
export function BentoCell({
  className,
  children,
  title,
  description,
  icon,
  action,
  ...props
}: HTMLMotionProps<"section"> & {
  title?: string;
  description?: string;
  /** Elemento ya renderizado (ej. <Radio />): los Server Components no pueden pasar componentes. */
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <motion.section
      variants={cellVariants}
      className={cn(
        "relative flex flex-col overflow-hidden rounded-lg bg-card ring-1 ring-border",
        className,
      )}
      {...props}
    >
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-5">
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
        </header>
      )}
      {children as React.ReactNode}
    </motion.section>
  );
}

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
}: {
  label: string;
  value: string;
  /** Elemento ya renderizado (ej. <Gauge />). */
  icon: React.ReactNode;
  /** Color de estado opcional (variable CSS). */
  accent?: string;
  footnote?: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={cellVariants}
      className={cn("relative rounded-lg bg-card p-5 ring-1 ring-border", className)}
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
    </motion.div>
  );
}
