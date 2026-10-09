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
      variants={{ show: { transition: { staggerChildren: 0.05 } } }}
      className={cn("grid grid-cols-1 gap-4 md:grid-cols-6 xl:grid-cols-12", className)}
    >
      {children}
    </motion.div>
  );
}

const cellVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease } },
};

/** Celda genérica del bento: superficie #0B0F19 con borde translúcido. */
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
        "group relative flex flex-col overflow-hidden rounded-lg border border-border bg-card",
        "transition-[border-color,box-shadow] duration-300 hover:border-white/10",
        className,
      )}
      {...props}
    >
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-5">
          <div className="flex min-w-0 items-center gap-2.5">
            {icon && (
              <span className="flex size-7 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.03] text-muted-foreground [&_svg]:size-3.5">
                {icon}
              </span>
            )}
            <div className="min-w-0">
              <h2 className="truncate text-sm font-medium tracking-tight">{title}</h2>
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

/** Tarjeta KPI: hover con escala 1,02, elevación y brillo del acento. */
export function KpiCard({
  label,
  value,
  icon,
  accent = "#22d3ee",
  footnote,
  className,
}: {
  label: string;
  value: string;
  /** Elemento ya renderizado (ej. <Gauge />), toma el color del acento. */
  icon: React.ReactNode;
  accent?: string;
  footnote?: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={cellVariants}
      whileHover={{ scale: 1.02, y: -3 }}
      transition={{ type: "spring", stiffness: 380, damping: 26 }}
      className={cn(
        "group relative overflow-hidden rounded-lg border border-border bg-card p-5",
        "shadow-[0_1px_0_0_rgb(255_255_255/0.03)_inset] transition-shadow duration-300",
        "hover:shadow-[0_24px_48px_-24px_rgb(0_0_0/0.8),0_0_0_1px_rgb(255_255_255/0.06)]",
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: `${accent}26` }}
      />
      <div className="relative flex items-start justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span
          className="flex size-8 items-center justify-center rounded-md border [&_svg]:size-4"
          style={{ borderColor: `${accent}33`, backgroundColor: `${accent}12`, color: accent }}
        >
          {icon}
        </span>
      </div>
      <div className="tabular relative mt-4 text-3xl font-semibold tracking-tight">{value}</div>
      {footnote && <div className="relative mt-2 text-xs text-muted-foreground">{footnote}</div>}
    </motion.div>
  );
}
