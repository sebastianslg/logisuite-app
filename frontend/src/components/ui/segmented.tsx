"use client";

import { useRef } from "react";
import { LayoutGroup, motion } from "framer-motion";

import { SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type SegmentedOption<T extends string> = { value: T; label: React.ReactNode };

/**
 * Control segmentado (UISegmentedControl): la píldora del elegido se desliza con el resorte estándar
 * (layoutId, solo transform). Es un grupo de radio: Tab entra en el elegido y las flechas cambian de opción.
 * `md` para la cabecera de una vista (píldoras redondas); `sm` dentro de formularios y paneles.
 */
export function Segmented<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
  size = "md",
  fill = false,
  className,
}: {
  id: string;
  label: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (v: T) => void;
  size?: "md" | "sm";
  fill?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const md = size === "md";

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const i = options.findIndex((o) => o.value === value);
    const next = (i + step + options.length) % options.length;
    onChange(options[next].value);
    ref.current?.querySelectorAll<HTMLButtonElement>("[role=radio]")[next]?.focus();
  };

  return (
    <LayoutGroup id={id}>
      <div
        ref={ref}
        role="radiogroup"
        aria-label={label}
        onKeyDown={onKeyDown}
        className={cn(
          "bg-fill",
          // En un teléfono angosto se compacta y, si aun así no cabe, se desplaza dentro de sí (nunca ensancha la página)
          "max-w-full overflow-x-auto [scrollbar-width:none]",
          md ? "inline-flex rounded-full p-1 text-[13px] sm:text-sm" : "flex rounded-xl p-0.5 text-xs",
          fill ? "w-full" : "w-fit",
          className,
        )}
      >
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(o.value)}
              className={cn(
                "press relative whitespace-nowrap outline-none focus-visible:ring-[3px] focus-visible:ring-ring/80",
                md ? "rounded-full px-3 py-1.5 sm:px-3.5" : "h-8 rounded-[10px] px-3 pointer-coarse:h-10",
                fill && "flex-1",
                on ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {on && (
                <motion.span
                  layoutId="segmented-pill"
                  transition={SPRING}
                  className={cn("absolute inset-0 bg-card shadow-sm", md ? "rounded-full" : "rounded-[10px]")}
                  aria-hidden
                />
              )}
              <span className="relative">{o.label}</span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
