"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Banknote, Monitor, Moon, Search, Sun } from "lucide-react";

import { useCommandPalette } from "@/components/shell/command-palette";
import { useApp } from "@/components/providers";
import { api } from "@/lib/client";
import { EASE } from "@/lib/motion";
import { usePrefs, type ThemePref } from "@/lib/prefs";
import type { Currency } from "@/lib/types";
import { cn } from "@/lib/utils";

const DEFAULT_TRM = 4000;

const THEMES: { value: ThemePref; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "Sistema", icon: Monitor },
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
];

/** Barra de herramientas de la ventana: búsqueda / comandos, moneda y apariencia. */
export function Toolbar() {
  const { open, shortcut } = useCommandPalette();
  return (
    <div className="material sticky top-0 z-30 hidden h-12 shrink-0 items-center gap-2 border-b border-border px-5 md:flex">
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

/**
 * Moneda de los costos (USD o COP) y TRM editable, en un popover. La TRM se guarda en el servidor
 * (con fecha, fuente y operador, como en Configuración) para que sea la misma en todos los equipos.
 */
export function CurrencyControl() {
  const { currency, setCurrency, fx, refreshFx, operator } = useApp();
  const trm = fx?.rate ?? null;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  async function save() {
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    try {
      await api("/api/settings/fx", {
        method: "PUT",
        body: {
          rate: parsed,
          date: new Date().toISOString().slice(0, 10),
          source: "Manual (barra superior)",
          usuario: operator || null,
        },
      });
      await refreshFx();
      setCurrency("COP");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la TRM");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setDraft(trm ? String(trm) : "");
          setError(null);
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
              {(["COP", "USD"] as Currency[]).map((c) => {
                const disabled = c === "COP" && !trm;
                return (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={currency === c}
                    disabled={disabled}
                    title={disabled ? "Escribe una TRM para ver montos en COP" : undefined}
                    onClick={() => setCurrency(c)}
                    className={cn(
                      "press h-8 rounded-[10px] text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-40",
                      currency === c ? "bg-card shadow-sm" : "text-muted-foreground",
                    )}
                  >
                    {c === "COP" ? "Pesos (COP)" : "Dólares (USD)"}
                  </button>
                );
              })}
            </div>
            <label className="mt-4 block text-sm">
              <span className="font-semibold">TRM</span>
              <span className="text-muted-foreground"> · pesos por dólar</span>
              <input
                inputMode="decimal"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && save()}
                placeholder={String(DEFAULT_TRM)}
                aria-invalid={draft !== "" && !valid}
                className="tabular mt-1.5 h-9 w-full rounded-xl bg-fill px-3 outline-none placeholder:text-muted-foreground focus:ring-[3px] focus:ring-ring/50 aria-[invalid=true]:ring-[3px] aria-[invalid=true]:ring-destructive/50 pointer-coarse:h-11"
              />
            </label>
            {error && <p role="alert" className="mt-1 text-xs text-destructive">{error}</p>}
            <button
              type="button"
              onClick={save}
              disabled={!valid || saving}
              className="press mt-3 h-9 w-full rounded-xl bg-solid text-sm font-medium text-primary-foreground outline-none hover:bg-solid/90 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 pointer-coarse:h-11"
            >
              {saving ? "Guardando…" : "Guardar TRM"}
            </button>
            <p className="mt-2 text-xs text-muted-foreground">
              {fx?.rate ? `Vigente: ${fx.rate.toLocaleString("es-CO")} (${fx.date}, ${fx.source}). ` : ""}
              Es un valor editable; no se actualiza solo. Historial y fuente en{" "}
              <Link href="/configuracion" className="text-primary hover:underline" onClick={() => setOpen(false)}>
                Configuración
              </Link>
              .
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
