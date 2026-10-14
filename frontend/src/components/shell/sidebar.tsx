"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutGroup, motion } from "framer-motion";
import {
  Fuel,
  LayoutDashboard,
  Leaf,
  Network,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Waypoints,
  type LucideIcon,
} from "lucide-react";

import { T_VIEW } from "@/lib/motion";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; short: string; icon: LucideIcon; group: "Operación" | "Logística verde" };

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", short: "Inicio", icon: LayoutDashboard, group: "Operación" },
  { href: "/envios", label: "Envíos", short: "Envíos", icon: Package, group: "Operación" },
  { href: "/red", label: "Red multimodal", short: "Red", icon: Network, group: "Operación" },
  { href: "/combustible", label: "Combustible", short: "Combustible", icon: Fuel, group: "Logística verde" },
  { href: "/huella", label: "Huella de carbono", short: "CO₂e", icon: Leaf, group: "Logística verde" },
];
const GROUPS = ["Operación", "Logística verde"] as const;

const spring = T_VIEW;

/**
 * Navegación de primer nivel. En pantallas anchas es una barra lateral de
 * material translúcido (convención de escritorio); en estrechas se convierte en
 * una barra de pestañas inferior (convención móvil), con las mismas tres
 * secciones y siempre visible.
 */
export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      <motion.aside
        animate={{ width: collapsed ? 68 : 240 }}
        transition={spring}
        className="material sticky top-0 z-30 hidden h-screen shrink-0 flex-col border-r border-border md:flex"
      >
        <div className="flex h-16 items-center gap-2.5 px-4">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-solid text-primary-foreground">
            <Waypoints className="size-4.5" aria-hidden />
          </span>
          {!collapsed && <span className="truncate text-base font-semibold tracking-tight">LogiSuite</span>}
        </div>

        <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 pt-2" aria-label="Navegación principal">
          <LayoutGroup id="sidebar">
            {GROUPS.map((group) => (
              <div key={group} className="flex flex-col gap-0.5">
                {!collapsed && (
                  <span className="px-2.5 pb-1 text-xs font-semibold text-muted-foreground">{group}</span>
                )}
                {NAV.filter((n) => n.group === group).map(({ href, label, icon: Icon }) => {
                  const active = isActive(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      title={collapsed ? label : undefined}
                      aria-label={collapsed ? label : undefined}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "press relative flex h-9 items-center gap-2.5 rounded-xl px-2.5 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                        active ? "font-medium text-primary" : "text-foreground/80 hover:bg-fill/60",
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="nav-active"
                          transition={spring}
                          className="absolute inset-0 rounded-xl bg-primary/12"
                        />
                      )}
                      <Icon className="relative size-[18px] shrink-0" aria-hidden />
                      {!collapsed && <span className="relative truncate">{label}</span>}
                    </Link>
                  );
                })}
              </div>
            ))}
          </LayoutGroup>
        </nav>

        <div className="p-3">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="press flex h-9 w-full items-center gap-2.5 rounded-xl px-2.5 text-sm text-muted-foreground outline-none hover:bg-fill/60 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
            aria-label={collapsed ? "Expandir barra lateral" : "Contraer barra lateral"}
            aria-expanded={!collapsed}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-[18px]" aria-hidden />
            ) : (
              <PanelLeftClose className="size-[18px]" aria-hidden />
            )}
            {!collapsed && <span>Contraer</span>}
          </button>
        </div>
      </motion.aside>

      <nav
        aria-label="Navegación principal"
        className="material fixed inset-x-0 bottom-0 z-40 flex border-t border-border pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {NAV.map(({ href, short, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "press flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50",
                active ? "font-medium text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="size-6" aria-hidden />
              <span className="truncate">{short}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
