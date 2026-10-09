"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import {
  CircleDollarSign,
  LayoutDashboard,
  Network,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  TrafficCone,
  UserRound,
  Waypoints,
  type LucideIcon,
} from "lucide-react";

import { useApp } from "@/components/providers";
import type { Currency } from "@/lib/types";
import { cn } from "@/lib/utils";

const NAV: { href: string; label: string; icon: LucideIcon; hint: string }[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, hint: "Torre de control" },
  { href: "/envios", label: "Envíos", icon: Package, hint: "Órdenes y estados" },
  { href: "/red", label: "Red multimodal", icon: Network, hint: "Mapa 3D y simulador" },
  { href: "/vias", label: "Vías", icon: TrafficCone, hint: "Cierres y desvíos" },
  { href: "/configuracion", label: "Configuración", icon: Settings, hint: "TRM, historial, enlaces" },
];

const spring = { type: "spring", stiffness: 420, damping: 36, mass: 0.8 } as const;

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 248 }}
      transition={spring}
      className="sticky top-0 z-30 flex h-screen shrink-0 flex-col border-r border-border bg-[#05080f]/90 backdrop-blur-xl"
    >
      <div className="flex h-16 items-center gap-3 px-4">
        <div className="relative flex size-9 shrink-0 items-center justify-center rounded-lg border border-neon-cyan/30 bg-neon-cyan/10">
          <Waypoints className="size-4.5 text-neon-cyan" />
          <span className="absolute inset-0 rounded-lg shadow-[0_0_24px_-4px_rgb(34_211_238/0.55)]" />
        </div>
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.15 }}
              className="min-w-0"
            >
              <div className="text-sm font-semibold tracking-tight">LogiSuite</div>
              <div className="text-[11px] text-muted-foreground">TMS Multimodal</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 pt-4" aria-label="Navegación principal">
        <LayoutGroup id="sidebar">
          {NAV.map(({ href, label, icon: Icon, hint }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex h-10 items-center gap-3 rounded-md px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    transition={spring}
                    className="absolute inset-0 rounded-md border border-neon-cyan/20 bg-neon-cyan/[0.07]"
                  >
                    <span className="absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-neon-cyan shadow-[0_0_12px_rgb(34_211_238)]" />
                  </motion.span>
                )}
                <motion.span
                  whileHover={{ scale: 1.08 }}
                  transition={spring}
                  className="relative z-10 flex shrink-0"
                >
                  <Icon className={cn("size-4.5", active && "text-neon-cyan")} />
                </motion.span>
                {!collapsed && (
                  <span className="relative z-10 flex min-w-0 flex-col leading-tight">
                    <span className="truncate font-medium">{label}</span>
                    <span className="truncate text-[11px] text-muted-foreground/80">{hint}</span>
                  </span>
                )}
              </Link>
            );
          })}
        </LayoutGroup>
      </nav>

      {!collapsed && <OperatorPanel />}

      <div className="border-t border-border p-3">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex h-9 w-full items-center gap-3 rounded-md px-3 text-xs text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground"
          aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          {!collapsed && <span>Contraer</span>}
        </button>
      </div>
    </motion.aside>
  );
}

/** Moneda de visualización y nombre del operador que firma los cambios. */
function OperatorPanel() {
  const { currency, setCurrency, fx, operator, setOperator } = useApp();
  const hasRate = Boolean(fx?.rate);
  return (
    <div className="flex flex-col gap-3 border-t border-border p-3 text-xs">
      <div>
        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <CircleDollarSign className="size-3.5" /> Moneda
        </div>
        <div className="flex rounded-md border border-white/[0.06] p-0.5" role="radiogroup" aria-label="Moneda">
          {(["USD", "COP"] as Currency[]).map((c) => {
            const disabled = c === "COP" && !hasRate;
            return (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={currency === c}
                disabled={disabled}
                onClick={() => setCurrency(c)}
                title={disabled ? "Configura la TRM para ver montos en COP" : undefined}
                className={cn(
                  "h-7 flex-1 rounded transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                  currency === c ? "bg-white/[0.08] text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {c}
              </button>
            );
          })}
        </div>
        <p className="mt-1 text-[10px] leading-snug text-muted-foreground/80">
          {hasRate ? (
            <>TRM {fx!.rate!.toLocaleString("es-CO")} · {fx!.date}</>
          ) : (
            <Link href="/configuracion" className="underline underline-offset-2 hover:text-foreground">
              TRM sin configurar
            </Link>
          )}
        </p>
      </div>
      <label className="block">
        <span className="mb-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <UserRound className="size-3.5" /> Operador
        </span>
        <input
          value={operator}
          onChange={(e) => setOperator(e.target.value)}
          placeholder="Tu nombre (firma cambios)"
          maxLength={60}
          className="h-8 w-full rounded-md border border-input bg-white/[0.02] px-2.5 text-xs outline-none placeholder:text-muted-foreground/60 focus:border-neon-cyan/40"
        />
      </label>
    </div>
  );
}
