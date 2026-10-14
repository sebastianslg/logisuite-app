"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

import { MODES } from "@/lib/modes";
import type { CityOption } from "@/lib/types";
import { cn } from "@/lib/utils";

export const CATEGORY_LABEL = {
  principal: "Principal",
  municipio: "Municipio",
  dificil_acceso: "Difícil acceso",
} as const;

const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/**
 * Selector de ciudad con búsqueda. Pensado para cientos de municipios: filtra al escribir,
 * navega con flechas y Enter, y muestra los modos con los que se llega a cada ciudad.
 */
export function CityCombobox({
  label,
  value,
  onChange,
  cities,
}: {
  label: string;
  value: string;
  onChange: (city: string) => void;
  cities: CityOption[];
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const current = cities.find((c) => c.city === value);

  const results = useMemo(() => {
    const needle = norm(q.trim());
    const list = needle ? cities.filter((c) => norm(c.city).includes(needle)) : cities;
    return list.slice(0, 120);
  }, [cities, q]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  const choose = (c: CityOption) => {
    onChange(c.city);
    setOpen(false);
  };

  const toggle = () => {
    setQ("");
    setActive(0);
    setOpen((o) => !o);
    setTimeout(() => input.current?.focus(), 30);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[active]) choose(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={root} className="relative block">
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="press flex h-9 w-full items-center gap-2 rounded-xl bg-fill pr-2.5 pl-3 text-left text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 pointer-coarse:h-11"
      >
        <span className="min-w-0 flex-1 truncate">{value || "Elegir ciudad"}</span>
        <span className="flex gap-0.5" aria-hidden>
          {current?.modes.map((m) => {
            const Icon = MODES[m].icon;
            return <Icon key={m} className="size-3" style={{ color: MODES[m].color }} />;
          })}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>
      {open && (
        <div
          className="glass absolute top-full right-0 left-0 z-30 mt-1.5 overflow-hidden rounded-2xl"
          style={{ backgroundColor: "var(--card)" }}
        >
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="size-4 text-muted-foreground" aria-hidden />
            <input
              ref={input}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKey}
              placeholder="Buscar ciudad o municipio"
              aria-label={`Buscar ${label.toLowerCase()}`}
              className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <ul role="listbox" aria-label={label} className="max-h-60 overflow-y-auto p-1">
            {results.map((c, i) => (
              <li
                key={c.city}
                role="option"
                aria-selected={c.city === value}
                onMouseMove={() => setActive(i)}
                onClick={() => choose(c)}
                className={cn(
                  "flex min-h-9 cursor-pointer items-center gap-2 rounded-xl px-2.5 py-1.5 text-sm",
                  i === active && "bg-fill",
                )}
              >
                <span className={cn("flex-1 truncate", c.city === value && "font-semibold text-primary")}>{c.city}</span>
                <span className="text-xs text-muted-foreground">{CATEGORY_LABEL[c.category]}</span>
              </li>
            ))}
            {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Sin coincidencias.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
