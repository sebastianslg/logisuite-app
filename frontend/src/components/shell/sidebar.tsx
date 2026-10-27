"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import {
  Fuel,
  Keyboard,
  LayoutDashboard,
  Leaf,
  Menu,
  Network,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  TrafficCone,
  Truck,
  UserRound,
  Warehouse,
  Waypoints,
  X,
  type LucideIcon,
} from "lucide-react";

import { useApp } from "@/components/providers";
import { useCommandPalette } from "@/components/shell/command-palette";
import { OPEN_SHORTCUTS_EVENT } from "@/components/shell/shortcuts";
import { CurrencyControl, ThemeControl } from "@/components/shell/toolbar";
import { EASE, T_VIEW, stagger } from "@/lib/motion";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon; group: string };

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, group: "Operación" },
  { href: "/envios", label: "Envíos", icon: Package, group: "Operación" },
  { href: "/red", label: "Red multimodal", icon: Network, group: "Operación" },
  { href: "/vias", label: "Vías y cierres", icon: TrafficCone, group: "Operación" },
  { href: "/flota", label: "Flota", icon: Truck, group: "Flota y bodegas" },
  { href: "/bodegas", label: "Bodegas", icon: Warehouse, group: "Flota y bodegas" },
  { href: "/combustible", label: "Combustible", icon: Fuel, group: "Logística verde" },
  { href: "/huella", label: "Huella de carbono", icon: Leaf, group: "Logística verde" },
  { href: "/configuracion", label: "Configuración", icon: Settings, group: "Sistema" },
];
const GROUPS = ["Operación", "Flota y bodegas", "Logística verde", "Sistema"] as const;

const spring = T_VIEW;

/**
 * Navegación de primer nivel. En pantallas anchas es una barra lateral de material translúcido que
 * se puede contraer; en celular, una barra superior con un menú que se desliza desde la izquierda.
 */
export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { open: openPalette } = useCommandPalette();

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  return (
    <>
      {/* Celular: una sola barra con logo, búsqueda, moneda y menú */}
      <header className="material fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-2 border-b border-border pr-3 pl-[max(0.75rem,env(safe-area-inset-left))] md:hidden">
        <Link href="/" aria-label="Westvane, inicio" className="flex shrink-0 items-center pointer-coarse:min-h-11 pointer-coarse:min-w-11">
          <Logo label={false} />
        </Link>
        <button
          type="button"
          onClick={openPalette}
          aria-label="Buscar envíos, ciudades o comandos"
          className="press flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl bg-fill px-3 text-sm text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/80"
        >
          <Search className="size-4 shrink-0" aria-hidden />
          <span className="truncate">Buscar…</span>
        </button>
        <CurrencyControl />
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menú"
          aria-expanded={mobileOpen}
          className="press flex size-10 shrink-0 items-center justify-center rounded-xl bg-fill outline-none focus-visible:ring-[3px] focus-visible:ring-ring/80"
        >
          <Menu className="size-5" aria-hidden />
        </button>
      </header>

      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menú">
            <motion.button
              type="button"
              className="absolute inset-0 bg-black/40"
              onClick={() => setMobileOpen(false)}
              aria-label="Cerrar menú"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={T_VIEW}
              className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-border bg-card shadow-2xl"
            >
              <div className="flex h-14 items-center justify-between px-4">
                <span className="text-base font-semibold">Menú</span>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Cerrar menú"
                  className="press flex size-11 items-center justify-center rounded-xl outline-none hover:bg-fill focus-visible:ring-[3px] focus-visible:ring-ring/80"
                >
                  <X className="size-5" aria-hidden />
                </button>
              </div>
              <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 pt-2" aria-label="Navegación principal (celular)">
                {GROUPS.map((group) => (
                  <div key={group} className="flex flex-col gap-0.5">
                    <span className="px-3 pb-1 text-xs font-semibold text-muted-foreground">{group}</span>
                    {NAV.filter((n) => n.group === group).map(({ href, label, icon: Icon }) => {
                      const active = isActive(href);
                      return (
                        <motion.div
                          key={href}
                          initial={{ opacity: 0, x: -14 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ ...T_VIEW, delay: stagger(NAV.findIndex((n) => n.href === href), 0.04, 0.4) }}
                        >
                          <Link
                            href={href}
                            aria-current={active ? "page" : undefined}
                            onClick={() => setMobileOpen(false)}
                            className={cn(
                              "press flex min-h-12 items-center gap-3 rounded-xl px-3 text-[0.9375rem] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/80",
                              active ? "bg-primary/12 font-medium text-primary" : "text-foreground/80 hover:bg-fill/60",
                            )}
                          >
                            <Icon className="size-5" aria-hidden />
                            {label}
                          </Link>
                        </motion.div>
                      );
                    })}
                  </div>
                ))}
              </nav>
              <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
                <span className="text-sm text-muted-foreground">Apariencia</span>
                <ThemeControl />
              </div>
              <div className="border-t border-border">
                <OperatorPanel />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <motion.aside
        animate={{ width: collapsed ? 68 : 240 }}
        transition={spring}
        className="material sticky top-0 z-30 hidden h-screen shrink-0 flex-col border-r border-border md:flex"
      >
        <div className="flex h-16 items-center gap-2.5 px-4">
          <Logo label={!collapsed} />
        </div>

        <div className="px-3 pb-2">
          <button
            type="button"
            onClick={openPalette}
            aria-label="Buscar envíos, ciudades o comandos"
            title={collapsed ? "Buscar (Ctrl K)" : undefined}
            className={cn(
              "press flex h-9 w-full items-center gap-2 rounded-xl bg-fill/70 text-sm text-muted-foreground outline-none transition-colors hover:bg-fill hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/80",
              collapsed ? "justify-center" : "px-2.5",
            )}
          >
            <Search className="size-[16px] shrink-0" aria-hidden />
            {!collapsed && (
              <>
                <span className="truncate">Buscar</span>
                <kbd className="ml-auto rounded-md border border-border-strong px-1.5 text-[11px] font-medium">Ctrl K</kbd>
              </>
            )}
          </button>
        </div>

        <nav
          className="group/nav relative flex flex-1 flex-col gap-4 overflow-y-auto px-3 pt-2"
          aria-label="Navegación principal"
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            e.currentTarget.style.setProperty("--spot-x", `${e.clientX - r.left}px`);
            e.currentTarget.style.setProperty("--spot-y", `${e.clientY - r.top}px`);
          }}
        >
          {/* Resplandor que sigue al puntero: da profundidad al vidrio sin cambiar el diseño */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500 group-hover/nav:opacity-100 motion-reduce:transition-none"
            style={{
              background:
                "radial-gradient(160px circle at var(--spot-x, 50%) var(--spot-y, 50%), color-mix(in oklab, var(--primary) 9%, transparent), transparent 70%)",
            }}
          />
          <LayoutGroup id="sidebar">
            {GROUPS.map((group) => (
              <div key={group} className="relative flex flex-col gap-0.5">
                {!collapsed && <span className="px-2.5 pb-1 text-xs font-semibold text-muted-foreground">{group}</span>}
                {NAV.filter((n) => n.group === group).map(({ href, label, icon: Icon }) => {
                  const active = isActive(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      aria-label={collapsed ? label : undefined}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group/item press relative flex h-9 items-center gap-2.5 rounded-xl px-2.5 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/80",
                        active ? "font-medium text-primary" : "text-foreground/80 hover:bg-fill/60",
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="nav-active"
                          transition={spring}
                          className="absolute inset-0 rounded-xl bg-primary/12 shadow-[inset_0_0.5px_0_rgba(255,255,255,0.4)]"
                        />
                      )}
                      <Icon
                        className={cn(
                          "relative size-[18px] shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/item:scale-110 motion-reduce:transition-none",
                          active && "scale-105",
                        )}
                        aria-hidden
                      />
                      {!collapsed && <span className="relative truncate">{label}</span>}
                      {collapsed && (
                        <span
                          role="tooltip"
                          className="pointer-events-none absolute left-full z-50 ml-3 hidden whitespace-nowrap rounded-lg bg-solid px-2.5 py-1.5 text-xs font-medium text-primary-foreground opacity-0 shadow-lg transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/item:translate-x-0 group-hover/item:opacity-100 group-focus-visible/item:opacity-100 md:block md:-translate-x-1"
                        >
                          {label}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </LayoutGroup>
        </nav>

        {!collapsed && <OperatorPanel />}

        <div className="flex flex-col gap-0.5 p-3">
          <SystemStatus collapsed={collapsed} />
          {!collapsed && (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event(OPEN_SHORTCUTS_EVENT))}
              className="press flex h-9 w-full items-center gap-2.5 rounded-xl px-2.5 text-sm text-muted-foreground outline-none hover:bg-fill/60 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/80"
            >
              <Keyboard className="size-[18px]" aria-hidden />
              <span>Atajos</span>
              <kbd className="ml-auto rounded-md border border-border-strong px-1.5 text-xs font-medium">?</kbd>
            </button>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="press flex h-9 w-full items-center gap-2.5 rounded-xl px-2.5 text-sm text-muted-foreground outline-none hover:bg-fill/60 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/80"
            aria-label={collapsed ? "Expandir barra lateral" : "Contraer barra lateral"}
            aria-expanded={!collapsed}
          >
            {collapsed ? <PanelLeftOpen className="size-[18px]" aria-hidden /> : <PanelLeftClose className="size-[18px]" aria-hidden />}
            {!collapsed && <span>Contraer</span>}
          </button>
        </div>
      </motion.aside>
    </>
  );
}

/**
 * Estado del sistema: consulta la API cada 30 s. Un punto que respira indica que responde;
 * si falla, el punto se pone en rojo y el texto dice que no hay conexión.
 */
function SystemStatus({ collapsed }: { collapsed: boolean }) {
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    const check = () =>
      fetch("/api/health", { cache: "no-store" })
        .then((r) => alive && setOnline(r.ok))
        .catch(() => alive && setOnline(false));
    check();
    const id = window.setInterval(check, 30_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  const color = online === null ? "bg-muted-foreground" : online ? "bg-success" : "bg-destructive";
  const text = online === null ? "Verificando…" : online ? "Sistema en línea" : "Sin conexión";

  return (
    <div
      role="status"
      aria-live="polite"
      title={collapsed ? text : undefined}
      className="flex h-9 items-center gap-2.5 rounded-xl px-2.5 text-xs text-muted-foreground"
    >
      <span className="relative flex size-2 shrink-0" aria-hidden>
        {online && <span className="absolute inline-flex size-full animate-ping rounded-full bg-success/60 motion-reduce:animate-none" />}
        <span className={cn("relative inline-flex size-2 rounded-full", color)} />
      </span>
      {!collapsed && <span className="truncate">{text}</span>}
    </div>
  );
}

function Logo({ label }: { label: boolean }) {
  return (
    <>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-solid text-primary-foreground">
        <Waypoints className="size-4.5" aria-hidden />
      </span>
      {label && <span className="truncate text-base font-semibold tracking-tight">Westvane</span>}
    </>
  );
}

/** Nombre del operador: firma los cambios en el historial (no hay autenticación; es un nombre declarado). */
function OperatorPanel() {
  const { operator, setOperator } = useApp();
  return (
    <label className="block border-t border-border p-3">
      <span className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <UserRound className="size-3.5" aria-hidden /> Operador
      </span>
      <input
        value={operator}
        onChange={(e) => setOperator(e.target.value)}
        placeholder="Tu nombre (firma cambios)"
        maxLength={60}
        className="h-9 w-full rounded-xl bg-fill px-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-[3px] focus:ring-ring/80 pointer-coarse:h-11"
      />
    </label>
  );
}
