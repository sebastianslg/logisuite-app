"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Banknote,
  CornerDownLeft,
  Fuel,
  Keyboard,
  LayoutDashboard,
  Leaf,
  MapPin,
  Moon,
  Network,
  PackagePlus,
  Package,
  Search,
  Settings,
  Sun,
  TrafficCone,
  Truck,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

import { EASE } from "@/lib/motion";
import { OPEN_SHORTCUTS_EVENT } from "@/components/shell/shortcuts";
import { useApp } from "@/components/providers";
import { usePrefs } from "@/lib/prefs";
import { cn } from "@/lib/utils";

interface Item {
  id: string;
  group: "Ir a" | "Acciones" | "Envíos" | "Ciudades";
  label: string;
  hint?: string;
  icon: LucideIcon;
  run: () => void;
}

const Ctx = createContext<{ open: () => void; shortcut: string }>({ open: () => {}, shortcut: "Ctrl K" });
export const useCommandPalette = () => useContext(Ctx);

const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export function CommandPalette({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { setTheme } = usePrefs();
  const { setCurrency, fx } = useApp();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [shipments, setShipments] = useState<{ code: string; origin: string; destination: string }[]>([]);
  const [cities, setCities] = useState<{ city: string; category: string }[]>([]);
  const mac = useSyncExternalStore(
    () => () => {},
    () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent),
    () => false,
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const show = useCallback(() => {
    setQ("");
    setActive(0);
    setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);

  // Atajos globales: Ctrl/⌘ + K, y "/" fuera de los campos de texto
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement)?.tagName ?? "") ||
        (e.target as HTMLElement)?.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        setQ("");
        setActive(0);
      } else if (e.key === "/" && !typing && !open) {
        e.preventDefault();
        show();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, show]);

  // Datos de búsqueda: se piden al abrir por primera vez
  useEffect(() => {
    if (!open || shipments.length) return;
    fetch("/api/shipments?limit=100", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setShipments(d.items))
      .catch(() => {});
    fetch("/api/locations", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setCities(d.cities))
      .catch(() => {});
  }, [open, shipments.length]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  const go = useCallback(
    (href: string) => () => {
      close();
      router.push(href);
    },
    [close, router],
  );

  const items = useMemo<Item[]>(() => {
    const base: Item[] = [
      { id: "p-home", group: "Ir a", label: "Dashboard", icon: LayoutDashboard, run: go("/") },
      { id: "p-env", group: "Ir a", label: "Envíos", icon: Package, run: go("/envios") },
      { id: "p-red", group: "Ir a", label: "Red multimodal", icon: Network, run: go("/red") },
      { id: "p-fuel", group: "Ir a", label: "Combustible", icon: Fuel, run: go("/combustible") },
      { id: "p-co2", group: "Ir a", label: "Huella de carbono", icon: Leaf, run: go("/huella") },
      { id: "p-vias", group: "Ir a", label: "Vías y cierres", icon: TrafficCone, run: go("/vias") },
      { id: "p-fleet", group: "Ir a", label: "Flota de vehículos", icon: Truck, run: go("/flota") },
      { id: "p-wh", group: "Ir a", label: "Bodegas", icon: Warehouse, run: go("/bodegas") },
      { id: "p-cfg", group: "Ir a", label: "Configuración", icon: Settings, run: go("/configuracion") },
      { id: "a-veh", group: "Acciones", label: "Agregar un vehículo", hint: "Flota", icon: Truck, run: go("/flota/nuevo") },
      { id: "a-wh", group: "Acciones", label: "Crear una bodega", hint: "Bodegas", icon: Warehouse, run: go("/bodegas/nueva") },
      { id: "a-new", group: "Acciones", label: "Crear envío", hint: "Simulador de rutas", icon: PackagePlus, run: go("/envios/nuevo") },
      ...(fx?.rate ? [{ id: "a-cop", group: "Acciones" as const, label: "Mostrar costos en pesos (COP)", icon: Banknote, run: () => { setCurrency("COP"); close(); } }] : []),
      { id: "a-usd", group: "Acciones", label: "Mostrar costos en dólares (USD)", icon: Banknote, run: () => { setCurrency("USD"); close(); } },
      { id: "a-keys", group: "Acciones", label: "Ver atajos de teclado", hint: "?", icon: Keyboard, run: () => { close(); setTimeout(() => window.dispatchEvent(new Event(OPEN_SHORTCUTS_EVENT)), 0); } },
      { id: "a-light", group: "Acciones", label: "Apariencia: claro", icon: Sun, run: () => { setTheme("light"); close(); } },
      { id: "a-dark", group: "Acciones", label: "Apariencia: oscuro", icon: Moon, run: () => { setTheme("dark"); close(); } },
    ];
    const ships = shipments.map<Item>((s) => ({
      id: `s-${s.code}`, group: "Envíos", label: s.code, hint: `${s.origin} → ${s.destination}`,
      icon: Package, run: go(`/envios/${s.code}`),
    }));
    const cs = cities.map<Item>((c) => ({
      id: `c-${c.city}`, group: "Ciudades", label: c.city, hint: "Ver en el mapa",
      icon: MapPin, run: go(`/red?ciudad=${encodeURIComponent(c.city)}`),
    }));
    return [...base, ...ships, ...cs];
  }, [shipments, cities, go, setCurrency, setTheme, close, fx]);

  const results = useMemo(() => {
    const needle = norm(q.trim());
    if (!needle) return items.filter((i) => i.group === "Ir a" || i.group === "Acciones");
    return items
      .filter((i) => norm(`${i.label} ${i.hint ?? ""}`).includes(needle))
      .sort((a, b) => Number(norm(b.label).startsWith(needle)) - Number(norm(a.label).startsWith(needle)))
      .slice(0, 30);
  }, [items, q]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      results[active]?.run();
    } else if (e.key === "Escape") {
      close();
    }
  };

  const value = useMemo(() => ({ open: show, shortcut: mac ? "⌘ K" : "Ctrl K" }), [show, mac]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[60] flex items-start justify-center px-3 pt-[12dvh]" role="presentation">
            <motion.div
              className="absolute inset-0 bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12, ease: EASE }}
              onClick={close}
              aria-hidden
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Buscar o ejecutar un comando"
              initial={{ opacity: 0, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12, ease: EASE }}
              className="glass relative w-full max-w-xl overflow-hidden rounded-3xl"
              style={{ backgroundColor: "var(--card)" }}
            >
              <div className="flex items-center gap-3 border-b border-border px-4">
                <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                <input
                  ref={inputRef}
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setActive(0);
                  }}
                  onKeyDown={onInputKey}
                  role="combobox"
                  aria-expanded
                  aria-controls="palette-list"
                  aria-activedescendant={results[active] ? `palette-${results[active].id}` : undefined}
                  placeholder="Buscar envíos, ciudades o comandos"
                  className="h-14 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
                />
              </div>
              <ul id="palette-list" role="listbox" ref={listRef} className="max-h-[50dvh] overflow-y-auto p-2">
                {results.length === 0 && (
                  <li className="px-3 py-8 text-center text-sm text-muted-foreground">Sin resultados para “{q}”.</li>
                )}
                {results.map((it, i) => {
                  const Icon = it.icon;
                  const showGroup = i === 0 || results[i - 1].group !== it.group;
                  return (
                    <li key={it.id} role="presentation">
                      {showGroup && (
                        <div className="px-3 pt-2 pb-1 text-xs font-semibold text-muted-foreground">{it.group}</div>
                      )}
                      <div
                        id={`palette-${it.id}`}
                        role="option"
                        aria-selected={i === active}
                        data-index={i}
                        onMouseMove={() => setActive(i)}
                        onClick={it.run}
                        className={cn(
                          "flex min-h-10 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm",
                          i === active ? "bg-solid text-primary-foreground" : "",
                        )}
                      >
                        <Icon className="size-4 shrink-0" aria-hidden />
                        <span className="truncate font-medium">{it.label}</span>
                        {it.hint && (
                          <span className={cn("truncate text-xs", i === active ? "opacity-80" : "text-muted-foreground")}>
                            {it.hint}
                          </span>
                        )}
                        {i === active && <CornerDownLeft className="ml-auto size-4 shrink-0 opacity-80" aria-hidden />}
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-xs text-muted-foreground">
                <span>↑↓ navegar</span>
                <span>↵ abrir</span>
                <span>Esc cerrar</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Ctx.Provider>
  );
}
