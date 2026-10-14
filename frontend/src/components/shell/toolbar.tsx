"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Banknote, Monitor, Moon, Search, Sun } from "lucide-react";

import { useCommandPalette } from "@/components/shell/command-palette";
import { EASE } from "@/lib/motion";
import { DEFAULT_TRM, usePrefs, type Currency, type ThemePref } from "@/lib/prefs";
import { cn } from "@/lib/utils";

const THEMES: { value: ThemePref; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "Sistema", icon: Monitor },
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
];

/** Barra de herramientas de la ventana: búsqueda / comandos, moneda y apariencia. */
export function Toolbar() {
  const { open, shortcut } = useCommandPalette();
  return (
    <div className="material sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 border-b border-border px-3 md:px-5">
      <button
        type="button"
        onClick={open}
        className="press flex h-8 min-w-0 flex-1 items-center gap-2 rounded-xl bg-fill px-3 text-sm text-muted-foreground outline-none hover:bg-fill/70 focus-visible:ring-[3px] focus-visible:ring-ring/50 pointer-coarse:h-10 md:max-w-md"
        aria-label="Buscar o ejecutar un comando"
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="truncate">Buscar envíos, ciudades, comandos…</span>
        <kbd className="ml-auto hidden shrink-0 rounded-md border border-border-strong px-1.5 text-xs font-medium sm:inline">
          {shortcut}
        </kbd>
      </button>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <CurrencyControl />
        <ThemeControl />
      </div>
    </div>
  );
}

/** Selector de apariencia: segmentado en pantallas anchas, un botón que rota en las estrechas. */
export function ThemeControl({ className }: { className?: string }) {
  const { theme, setTheme } = usePrefs();
  const idx = THEMES.findIndex((t) => t.value === theme);
  const Current = THEMES[idx].icon;
  return (
    <>
      <div
        role="radiogroup"
        aria-label="Apariencia"
        className={cn("hidden rounded-xl bg-fill p-0.5 sm:flex", className)}
      >
        {THEMES.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={theme === value}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              "press relative flex size-7 items-center justify-center rounded-[10px] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 pointer-coarse:size-9",
              theme === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setTheme(THEMES[(idx + 1) % THEMES.length].value)}
        aria-label={`Apariencia: ${THEMES[idx].label}. Cambiar`}
        className="press flex size-9 items-center justify-center rounded-xl bg-fill text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:hidden"
      >
        <Current className="size-4" aria-hidden />
      </button>
    </>
  );
}

/** Moneda de los costos (USD o COP) y TRM editable, en un popover. */
export function CurrencyControl() {
  const { currency, setCurrency, trm, setTrm } = usePrefs();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(String(trm));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const parsed = Number(draft.replace(/\./g, "").replace(",", "."));
  const valid = Number.isFinite(parsed) && parsed > 0;
  const commit = () => {
    if (valid) setTrm(parsed);
    else setDraft(String(trm));
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setDraft(String(trm));
          setOpen((o) => !o);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="press flex h-8 items-center gap-1.5 rounded-xl bg-fill px-2.5 text-sm font-medium outline-none hover:bg-fill/70 focus-visible:ring-[3px] focus-visible:ring-ring/50 pointer-coarse:h-10"
      >
        <Banknote className="size-4" aria-hidden />
        {currency}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Moneda y TRM"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="glass absolute top-full right-0 z-40 mt-2 w-72 rounded-2xl p-4"
            style={{ backgroundColor: "var(--card)" }}
          >
            <div className="text-sm font-semibold">Mostrar costos en</div>
            <div role="radiogroup" aria-label="Moneda" className="mt-2 grid grid-cols-2 rounded-xl bg-fill p-0.5">
              {(["COP", "USD"] as Currency[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={currency === c}
                  onClick={() => setCurrency(c)}
                  className={cn(
                    "press h-8 rounded-[10px] text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    currency === c ? "bg-card shadow-sm" : "text-muted-foreground",
                  )}
                >
                  {c === "COP" ? "Pesos (COP)" : "Dólares (USD)"}
                </button>
              ))}
            </div>
            <label className="mt-4 block text-sm">
              <span className="font-semibold">TRM</span>
              <span className="text-muted-foreground"> · pesos por dólar</span>
              <input
                inputMode="decimal"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => e.key === "Enter" && commit()}
                aria-invalid={!valid}
                className="tabular mt-1.5 h-9 w-full rounded-xl bg-fill px-3 outline-none focus:ring-[3px] focus:ring-ring/50 aria-[invalid=true]:ring-[3px] aria-[invalid=true]:ring-destructive/50 pointer-coarse:h-11"
              />
            </label>
            {!valid && <p className="mt-1 text-xs text-destructive">Escribe un valor mayor que cero.</p>}
            <p className="mt-2 text-xs text-muted-foreground">
              Valor editable; no se actualiza solo. Se guarda en este navegador. Referencia inicial:{" "}
              {DEFAULT_TRM.toLocaleString("es-CO")}.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
