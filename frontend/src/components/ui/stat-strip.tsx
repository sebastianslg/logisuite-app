"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

export type Stat = {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  /** Solo para estados: rojo si hay algo que atender, naranja si es un aviso, verde si está bien. */
  tone?: "danger" | "warning" | "success" | "accent";
  href?: string;
  onClick?: () => void;
  /** Filtro activo (con onClick). */
  active?: boolean;
};

const TONE = {
  danger: "text-destructive",
  warning: "text-warning",
  success: "text-success",
  accent: "text-primary",
} as const;

/**
 * Franja de indicadores: una sola superficie con celdas separadas por líneas finas, en lugar de una fila de
 * tarjetas iguales con un ícono en un círculo. El color solo aparece cuando la cifra es un estado. Si la
 * cifra lleva a una vista filtrada o filtra la lista, la celda completa es el enlace o el botón.
 */
export function StatStrip({ items, className }: { items: Stat[]; className?: string }) {
  const cols = items.length;
  return (
    <div className={cn("glass overflow-hidden rounded-3xl", className)}>
      {/* Cada celda dibuja su línea izquierda y superior; el margen negativo esconde las del borde exterior */}
      <div
        className={cn(
          "-mt-px -ml-px grid grid-cols-2",
          cols >= 3 && "md:grid-cols-3",
          cols === 4 && "xl:grid-cols-4",
          cols === 5 && "xl:grid-cols-5",
          cols >= 6 && "xl:grid-cols-6",
        )}
      >
        {items.map((it) => (
          <StatCell key={it.label} {...it} />
        ))}
      </div>
    </div>
  );
}

function StatCell({ label, value, hint, tone, href, onClick, active }: Stat) {
  const interactive = !!(href || onClick);
  const body = (
    <>
      <span className="flex items-center justify-between gap-2 text-[13px] font-medium text-muted-foreground">
        <span className="truncate">{label}</span>
        {interactive && (
          <ChevronRight
            className="size-3.5 shrink-0 opacity-0 transition-opacity duration-200 group-hover/stat:opacity-60 group-focus-visible/stat:opacity-60 motion-reduce:transition-none"
            aria-hidden
          />
        )}
      </span>
      <span className={cn("tabular mt-2 block text-[1.75rem] leading-none font-semibold tracking-[-0.03em]", tone && TONE[tone])}>
        {value}
      </span>
      {hint && <div className="mt-2 truncate text-[13px] text-muted-foreground">{hint}</div>}
    </>
  );
  const cls = cn(
    "group/stat relative block min-w-0 border-t border-l border-border bg-card px-5 py-4 text-left outline-none md:px-6 md:py-5",
    interactive &&
      "cursor-pointer transition-colors duration-200 hover:bg-[color-mix(in_srgb,var(--card)_96%,var(--foreground))] focus-visible:z-10 focus-visible:ring-[3px] focus-visible:ring-ring/80 focus-visible:ring-inset",
    active && "bg-primary/[0.06] shadow-[inset_0_-2px_0_var(--accent)]",
  );
  if (href) {
    return (
      <Link href={href} className={cls} data-ripple>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-pressed={active} className={cls} data-ripple>
        {body}
      </button>
    );
  }
  return <div className={cls}>{body}</div>;
}
