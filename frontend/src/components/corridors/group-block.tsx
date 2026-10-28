"use client";

import { ChevronRight, Lock } from "lucide-react";

import { cn } from "@/lib/utils";

/** Sección plegable de una lista larga: encabezado fijo con recuento; lo cerrado va primero y abierto. */
export function GroupBlock({
  title,
  count,
  icon,
  danger,
  open,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  icon?: React.ReactNode;
  danger?: boolean;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <li className="list-none">
      <h3 className="sticky top-0 z-10 md:top-20">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className={cn(
            "flex w-full items-center gap-2 rounded-xl bg-background/90 px-3 py-2.5 text-left text-sm font-semibold backdrop-blur-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/80",
            danger ? "text-destructive" : "text-foreground",
          )}
        >
          <ChevronRight
            className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none", open && "rotate-90")}
            aria-hidden
          />
          {danger ? <Lock className="size-4 shrink-0" aria-hidden /> : icon}
          <span className="truncate">{title}</span>
          <span className="tabular ml-auto text-xs font-medium text-muted-foreground">{count}</span>
        </button>
      </h3>
      {open && <ul className="glass rule-list mt-1 mb-4 overflow-hidden rounded-3xl">{children}</ul>}
    </li>
  );
}
