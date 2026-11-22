"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import {
  CalendarClock,
  CalendarDays,
  Scale,
  Users,
  BookOpen,
  Ellipsis,
  Fuel,
  History,
  ScrollText,
  Keyboard,
  LayoutDashboard,
  Leaf,
  LogOut,
  Network,
  Package,
  Search,
  Settings,
  TrafficCone,
  Truck,
  UserRound,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

import { useApp } from "@/components/providers";
import { useCommandPalette } from "@/components/shell/command-palette";
import { OPEN_SHORTCUTS_EVENT, preloadShortcutsHelp, shortcutFor } from "@/components/shell/shortcuts";
import { AlertCount, AlertsList, AlertsMenu, useAlerts } from "@/components/shell/alerts-menu";
import { CurrencyControl, ThemeControl } from "@/components/shell/toolbar";
import { ConnectionIndicator } from "@/components/offline-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth, type AuthUser } from "@/lib/auth";
import { openAuthModal } from "@/components/auth/login-dialog";
import { Mail } from "lucide-react";
import { onIdle } from "@/lib/idle";
import { EASE, SPRING, stagger } from "@/lib/motion";
import { useHydrated } from "@/lib/use-hydrated";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/brand/logo";

type NavItem = { href: string; label: string; short?: string; icon: LucideIcon };

/** Los cinco destinos del dock (el quinto es "Más"). */
const PRIMARY: NavItem[] = [
  { href: "/panel", label: "Resumen", icon: LayoutDashboard },
  { href: "/envios", label: "Envíos", icon: Package },
  { href: "/red", label: "Red", icon: Network },
  { href: "/flota", label: "Flota", icon: Truck },
];
/** Lo que vive dentro de "Más". */
const MORE: NavItem[] = [
  { href: "/hoy", label: "Hoy", icon: CalendarClock },
  { href: "/vias", label: "Vías y cierres", short: "Vías", icon: TrafficCone },
  { href: "/bodegas", label: "Bodegas", icon: Warehouse },
  { href: "/combustible", label: "Combustible", icon: Fuel },
  { href: "/huella", label: "Huella de carbono", short: "Huella", icon: Leaf },
  { href: "/historial", label: "Historial de trayectos", short: "Historial", icon: History },
  { href: "/auditoria", label: "Auditoría", icon: ScrollText },
  { href: "/calendario", label: "Calendario", icon: CalendarDays },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/comparar", label: "Comparar rutas", short: "Comparar", icon: Scale },
  { href: "/configuracion", label: "Configuración", icon: Settings },
  { href: "/metodologia", label: "Metodología", icon: BookOpen },
];

const ring = "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/80";

/**
 * Destino activo. Se marca después de hidratar: en una página reescrita por el proxy (la 404 de un envío que no
 * existe) el servidor renderiza otra ruta que la del navegador, y marcarlo antes rompía la hidratación.
 */
function useIsActive() {
  const pathname = usePathname();
  const hydrated = useHydrated();
  return (href: string) => hydrated && (href === "/panel" ? pathname === "/panel" : pathname.startsWith(href));
}

/**
 * Los cuatro destinos primarios se piden cuando el navegador queda libre, una sola vez y sin competir con la
 * pantalla que se está leyendo. «Más» no precarga nada: sus doce enlaces esperan a que el puntero o el foco
 * muestren intención (y en el celular, a que se abra la hoja).
 */
function usePrimaryPrefetch() {
  const router = useRouter();
  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    // Con ahorro de datos o una red de 2G, precargar cuatro rutas es un gasto que no se nota a favor
    if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType ?? "")) return;
    let alive = true;
    let cancel = () => {};
    // Primero deja terminar la carga y la primera lectura de la página; después, en un momento libre
    const grace = window.setTimeout(() => {
      if (!alive) return;
      cancel = onIdle(() => {
        if (!alive) return;
        for (const item of PRIMARY) router.prefetch(item.href);
      }, 2000);
    }, 1500);
    return () => {
      alive = false;
      window.clearTimeout(grace);
      cancel();
    };
  }, [router]);
}

/**
 * Navegación de primer nivel. En escritorio, un dock de vidrio flotante y centrado arriba (radio 999 px)
 * con cinco destinos, búsqueda (Ctrl K), moneda y apariencia; se reduce a íconos al bajar por la página
 * y vuelve al subir, al pasar el puntero o al recibir el foco. En celular, un dock inferior con cuatro
 * destinos y "Más", que abre una hoja desde abajo (se cierra arrastrándola).
 */
export function Dock() {
  usePrimaryPrefetch();
  return (
    <>
      <DesktopDock />
      <MobileDock />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Escritorio                                                          */
/* ------------------------------------------------------------------ */

function DesktopDock() {
  const isActive = useIsActive();
  const pathname = usePathname();
  const router = useRouter();
  const { open: openPalette, preload: preloadPalette, shortcut } = useCommandPalette();
  const [compact, setCompact] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MORE.some((m) => isActive(m.href));
  const overMap = pathname.startsWith("/red");
  const showLabels = !compact || hovered || moreOpen;

  // Bajar por la página reduce el dock a íconos; subir lo devuelve. Un umbral evita el parpadeo.
  useEffect(() => {
    let last = window.scrollY;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        if (Math.abs(y - last) < 8) return;
        setCompact(y > 120 && y > last);
        last = y;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  // Al navegar, el panel "Más" se cierra y el dock se muestra completo.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMoreOpen(false);
    setCompact(false);
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 hidden justify-center px-4 md:flex">
      <motion.header
        layout
        transition={SPRING}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onFocusCapture={() => setHovered(true)}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setHovered(false);
        }}
        className={cn(
          "pointer-events-auto flex h-14 items-center gap-1 rounded-full py-1.5 pr-1.5 pl-2",
          // Sobre el mapa el desenfoque se recalcularía en cada cuadro del mapa: ahí el dock es opaco
          overMap ? "floating" : "dock",
        )}
        style={{ borderRadius: 999 }}
      >
        <motion.div layout="position" transition={SPRING} className="flex items-center">
          <Link
            href="/panel"
            // La precarga de las rutas la pide este dock al quedar libre o al mostrar intención, no al montar el enlace
            prefetch={false}
            onPointerEnter={() => router.prefetch("/panel")}
            onFocus={() => router.prefetch("/panel")}
            aria-label="Westvane, resumen"
            className={cn("press relative flex items-center gap-2 rounded-full py-1 pr-2 pl-1", ring)}
          >
            <Logo />
            <AnimatePresence initial={false} mode="popLayout">
              {showLabels && (
                <motion.span
                  key="brand"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: EASE }}
                  className="text-[0.9375rem] font-semibold tracking-tight lg:inline hidden"
                >
                  Westvane
                </motion.span>
              )}
            </AnimatePresence>
            <SystemDot />
          </Link>
        </motion.div>

        <span className="mx-1 h-6 w-px bg-border" aria-hidden />

        <nav aria-label="Navegación principal" className="flex items-center">
          <LayoutGroup id="dock">
            {PRIMARY.map((item) => (
              <DockLink key={item.href} item={item} active={isActive(item.href)} showLabel={showLabels} />
            ))}
            <MoreMenu open={moreOpen} setOpen={setMoreOpen} active={moreActive} showLabel={showLabels} />
          </LayoutGroup>
        </nav>

        <span className="mx-1 h-6 w-px bg-border" aria-hidden />

        <motion.div layout="position" transition={SPRING} className="flex items-center gap-1">
          <ConnectionIndicator />
          <AlertsMenu />
          <button
            type="button"
            onClick={() => {
              preloadPalette();
              openPalette();
            }}
            onPointerEnter={preloadPalette}
            onFocus={preloadPalette}
            aria-label="Buscar envíos, ciudades o comandos"
            title={`Buscar (${shortcut})`}
            className={cn("press flex h-10 items-center gap-2 rounded-full bg-fill px-3 text-sm text-muted-foreground hover:text-foreground", ring)}
          >
            <Search className="size-4 shrink-0" aria-hidden />
            {showLabels && <span className="hidden xl:inline">Buscar</span>}
            <kbd className="hidden rounded-full border border-border-strong px-1.5 text-[11px] font-medium lg:inline">{shortcut}</kbd>
          </button>
          <AccountMenu showLabel={showLabels} />
        </motion.div>
      </motion.header>
    </div>
  );
}

function DockLink({ item, active, showLabel }: { item: NavItem; active: boolean; showLabel: boolean }) {
  const { href, label, icon: Icon } = item;
  const router = useRouter();
  return (
    <Link
      href={href}
      prefetch={false}
      onPointerEnter={() => router.prefetch(href)}
      onFocus={() => router.prefetch(href)}
      aria-current={active ? "page" : undefined}
      aria-label={showLabel ? undefined : label}
      title={showLabel ? undefined : label}
      className={cn(
        "group/item press relative flex h-10 items-center gap-2 rounded-full px-3 text-sm",
        ring,
        active ? "font-medium text-primary" : "text-foreground/75 hover:text-foreground",
      )}
    >
      {active && <ActivePill />}
      <DockIcon icon={Icon} active={active} />
      {showLabel && <span className="relative">{label}</span>}
    </Link>
  );
}

/**
 * Atajos reales de una acción del menú, en el mismo trazo del pie de la paleta. `aria-hidden`: el lector ya oye el
 * nombre del enlace y la hoja de atajos explica la secuencia; aquí solo es una pista para quien usa teclado.
 */
function MenuKeys({ keys }: { keys?: string[] }) {
  if (!keys) return null;
  return (
    <span aria-hidden className="ml-auto flex shrink-0 items-center gap-1 text-muted-foreground">
      {keys.map((k, i) => (
        <kbd
          key={`${k}-${i}`}
          className="inline-flex min-w-5 items-center justify-center rounded border border-border-strong bg-fill/60 px-1 text-[11px] leading-4 font-medium"
        >
          {k}
        </kbd>
      ))}
    </span>
  );
}

/** Píldora del destino activo: se desliza entre destinos con resorte (layoutId). */
function ActivePill() {
  return (
    <motion.span
      layoutId="dock-active"
      transition={SPRING}
      className="absolute inset-0 rounded-full bg-primary/12"
      aria-hidden
    />
  );
}

/**
 * Ícono del dock: al activarse hace un pequeño resorte (1 → 1,12 → 1); al pasar el puntero gira de −6° a 0°
 * y crece a 1,08. Con "Reducir movimiento" queda quieto.
 */
function DockIcon({ icon: Icon, active }: { icon: LucideIcon; active: boolean }) {
  const reduced = useReducedMotion();
  return (
    <motion.span
      className="relative flex"
      initial={false}
      animate={active && !reduced ? { scale: [1, 1.12, 1] } : { scale: 1 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <span className="dock-icon flex">
        <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
      </span>
    </motion.span>
  );
}

function MoreMenu({
  open,
  setOpen,
  active,
  showLabel,
}: {
  open: boolean;
  setOpen: (o: boolean) => void;
  active: boolean;
  showLabel: boolean;
}) {
  const isActive = useIsActive();
  const router = useRouter();
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={id}
        aria-haspopup="true"
        aria-label={showLabel ? undefined : "Más secciones"}
        className={cn(
          "group/item press relative flex h-10 items-center gap-2 rounded-full px-3 text-sm",
          ring,
          active ? "font-medium text-primary" : "text-foreground/75 hover:text-foreground",
        )}
      >
        {active && <ActivePill />}
        <DockIcon icon={Ellipsis} active={active} />
        {showLabel && <span className="relative">Más</span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id={id}
            initial={{ opacity: 0, scale: 0.96, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: 0.2, ease: EASE } }}
            exit={{ opacity: 0, scale: 0.96, y: -6, transition: { duration: 0.15, ease: EASE } }}
            style={{ transformOrigin: "top center" }}
            className="floating absolute top-full left-1/2 mt-3 w-72 -translate-x-1/2 rounded-[20px] p-2"
          >
            <ul className="flex flex-col">
              {MORE.map(({ href, label, icon: Icon }, i) => {
                const on = isActive(href);
                return (
                  <motion.li
                    key={href}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, ease: EASE, delay: stagger(i, 0.03, 0.2) }}
                  >
                    <Link
                      href={href}
                      prefetch={false}
                      onPointerEnter={() => router.prefetch(href)}
                      onFocus={() => router.prefetch(href)}
                      aria-current={on ? "page" : undefined}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "press flex h-10 items-center gap-3 rounded-xl px-3 text-sm",
                        ring,
                        on ? "bg-primary/12 font-medium text-primary" : "hover:bg-fill",
                      )}
                    >
                      <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
                      <span className="min-w-0 truncate">{label}</span>
                      <MenuKeys keys={shortcutFor(href)} />
                    </Link>
                  </motion.li>
                );
              })}
            </ul>
            {/* Moneda y apariencia viven aquí, como en la hoja «Más» del celular: la barra queda en navegación, avisos y búsqueda */}
            <div className="mt-2 flex items-center justify-between gap-3 border-t border-border px-3 pt-3">
              <span className="text-sm text-muted-foreground">Moneda</span>
              <CurrencyControl />
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 px-3">
              <span className="text-sm text-muted-foreground">Apariencia</span>
              <ThemeControl segmented />
            </div>
            <div className="mt-2 border-t border-border pt-2">
              <OperatorField onNavigate={() => setOpen(false)} />
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  preloadShortcutsHelp();
                  window.dispatchEvent(new Event(OPEN_SHORTCUTS_EVENT));
                }}
                onPointerEnter={preloadShortcutsHelp}
                onFocus={preloadShortcutsHelp}
                className={cn("press flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm text-muted-foreground hover:bg-fill hover:text-foreground", ring)}
              >
                <Keyboard className="size-[18px]" strokeWidth={1.75} aria-hidden />
                Atajos de teclado
                <kbd className="ml-auto rounded-md border border-border-strong px-1.5 text-xs font-medium">?</kbd>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cuenta (escritorio)                                                 */
/* ------------------------------------------------------------------ */

/** Nombre del rol si el servidor no manda `role_label`. */
const ROLE_LABEL: Record<AuthUser["role"], string> = {
  admin: "Administrador",
  operador: "Operador",
  lector: "Lector",
};

function roleLabel(user: AuthUser) {
  return user.role_label || ROLE_LABEL[user.role] || user.role;
}

function roleTone(role: AuthUser["role"]): "accent" | "info" | "neutral" {
  if (role === "admin") return "accent";
  if (role === "operador") return "info";
  return "neutral";
}

/** Iniciales del nombre: la primera letra y la del apellido (el avatar de la cuenta). */
function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (parts[0][0] + last).toUpperCase();
}

/**
 * Quién tiene la sesión: en el dock, la inicial, el nombre y el rol (el nombre se recorta antes de desbordar);
 * al pulsar, el menú de cuenta con el nombre completo, el rol, la empresa y «Cerrar sesión» directo.
 * Sin sesión no dibuja nada: el acceso de cuenta sigue en «Más», como siempre.
 */
function AccountMenu({ showLabel }: { showLabel: boolean }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;

  const name = user.full_name || user.username;
  const label = roleLabel(user);

  // El cierre de sesión ya lleva a /ingresar (lib/auth.ts); aquí solo se evita pulsar dos veces mientras responde
  const exit = async () => {
    setBusy(true);
    try {
      await logout();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        title={`${name} · ${label}`}
        className={cn(
          "press flex h-10 min-w-10 items-center gap-2 rounded-full px-1.5 text-foreground hover:bg-fill/70 pointer-coarse:h-11 pointer-coarse:min-w-11",
          ring,
        )}
      >
        <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-semibold text-primary">
          {initialsOf(name)}
        </span>
        <span className="sr-only">
          Cuenta de {name}, {label}
        </span>
        {showLabel && (
          <span aria-hidden className="hidden min-w-0 max-w-[10.5rem] text-left xl:block">
            <span className="block truncate text-[13px] leading-tight font-medium">{name}</span>
            <span className="block truncate text-xs leading-tight text-muted-foreground">{label}</span>
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id={id}
            role="group"
            aria-label="Cuenta"
            initial={{ opacity: 0, scale: 0.96, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: 0.2, ease: EASE } }}
            exit={{ opacity: 0, scale: 0.96, y: -6, transition: { duration: 0.15, ease: EASE } }}
            style={{ transformOrigin: "top right" }}
            className="floating absolute top-full right-0 z-40 mt-3 w-[min(20rem,calc(100vw-2rem))] rounded-[20px] p-2"
          >
            <div className="px-3 pt-2 pb-3">
              <p className="text-sm leading-snug font-semibold [overflow-wrap:anywhere]">{name}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                <Badge tone={roleTone(user.role)}>{label}</Badge>
                {user.email && <span className="min-w-0 truncate text-xs text-muted-foreground">{user.email}</span>}
              </div>
              {user.company && <p className="mt-1 truncate text-xs text-muted-foreground">{user.company.name}</p>}
            </div>
            <div className="border-t border-border pt-2">
              <Button variant="destructive" className="w-full" onClick={() => void exit()} disabled={busy}>
                <LogOut className="size-4" aria-hidden />
                Cerrar sesión
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Celular                                                             */
/* ------------------------------------------------------------------ */

function MobileDock() {
  const isActive = useIsActive();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const moreActive = MORE.some((m) => isActive(m.href));
  const { open: openPalette, preload: preloadPalette } = useCommandPalette();
  const alerts = useAlerts();
  const closeRef = useRef<HTMLButtonElement>(null);

  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  // Al cerrar la hoja, los avisos que mostró quedan como vistos
  const { markSeen } = alerts;
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) markSeen();
    wasOpen.current = open;
  }, [open, markSeen]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => closeRef.current?.focus(), 50);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [open]);

  return (
    <>
      <nav
        aria-label="Navegación principal (celular)"
        className="dock fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex h-16 items-stretch rounded-full p-1.5 md:hidden"
      >
        {/* El estado de conexión aparece solo cuando hay un problema: flota sobre el dock sin quitarle un destino */}
        <div className="pointer-events-none absolute inset-x-0 -top-11 flex justify-center">
          {/* `empty:hidden`: cuando la conexión está bien el indicador no dibuja nada y el hueco desaparece */}
          <div className="floating pointer-events-auto rounded-full px-2 empty:hidden">
            <ConnectionIndicator />
          </div>
        </div>
        <LayoutGroup id="dock-mobile">
          {PRIMARY.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                prefetch={false}
                onPointerEnter={() => router.prefetch(href)}
                onFocus={() => router.prefetch(href)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group/item press relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-xs",
                  ring,
                  active ? "font-semibold text-primary" : "text-foreground/70",
                )}
              >
                {active && <MobilePill />}
                <DockIcon icon={Icon} active={active} />
                <span className="relative">{label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            aria-label={alerts.items.length ? `Más secciones y ${alerts.items.length} avisos` : undefined}
            aria-expanded={open}
            className={cn(
              "group/item press relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-xs",
              ring,
              moreActive ? "font-semibold text-primary" : "text-foreground/70",
            )}
          >
            {moreActive && <MobilePill />}
            <span className="relative">
              <DockIcon icon={Ellipsis} active={moreActive} />
              <AlertCount count={alerts.unseen} urgent={alerts.urgent} className="-top-2 -right-3" />
            </span>
            <span className="relative">Más</span>
          </button>
        </LayoutGroup>
      </nav>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 md:hidden" role="presentation">
            <motion.div
              className="absolute inset-0 bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <motion.section
              role="dialog"
              aria-modal="true"
              aria-label="Más secciones"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.45, ease: EASE }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100 || info.velocity.y > 500) setOpen(false);
              }}
              className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col overflow-y-auto rounded-t-[28px] bg-card px-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl"
            >
              <div className="mx-auto mt-2 mb-3 h-1.5 w-10 shrink-0 rounded-full bg-border-strong" aria-hidden />
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Logo />
                  <span className="text-base font-semibold tracking-tight">Westvane</span>
                </div>
                <SystemStatusText />
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={() => {
                  setOpen(false);
                  preloadPalette();
                  openPalette();
                }}
                onPointerEnter={preloadPalette}
                onFocus={preloadPalette}
                className={cn("press mt-4 flex h-12 items-center gap-2 rounded-full bg-fill px-4 text-[0.9375rem] text-muted-foreground", ring)}
              >
                <Search className="size-4" aria-hidden /> Buscar envíos, ciudades o comandos
              </button>
              {alerts.items.length > 0 && (
                <section aria-label="Requiere atención" className="glass mt-4 shrink-0 overflow-hidden rounded-[20px]">
                  <h2 className="border-b border-border px-5 py-3 text-sm font-semibold">
                    Requiere atención <span className="tabular font-normal text-muted-foreground">· {alerts.items.length}</span>
                  </h2>
                  <AlertsList limit={3} onNavigate={() => setOpen(false)} />
                </section>
              )}
              <ul className="mt-4 grid grid-cols-3 gap-2">
                {MORE.map(({ href, label, short, icon: Icon }, i) => {
                  const on = isActive(href);
                  return (
                    <motion.li
                      key={href}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, ease: EASE, delay: stagger(i, 0.04, 0.24) }}
                    >
                      <Link
                        href={href}
                        aria-current={on ? "page" : undefined}
                        aria-label={label}
                        className={cn(
                          "press flex h-20 flex-col items-center justify-center gap-1.5 rounded-[20px] text-[13px]",
                          ring,
                          on ? "bg-primary/12 font-medium text-primary" : "bg-fill/70 text-foreground",
                        )}
                      >
                        <Icon className="size-5" strokeWidth={1.75} aria-hidden />
                        {short ?? label}
                      </Link>
                    </motion.li>
                  );
                })}
              </ul>
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
                <span className="text-sm text-muted-foreground">Moneda</span>
                <CurrencyControl placement="up" />
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">Apariencia</span>
                <ThemeControl segmented />
              </div>
              <div className="mt-3 border-t border-border pt-3">
                <OperatorField onNavigate={() => setOpen(false)} showLogout />
              </div>
            </motion.section>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

function MobilePill() {
  return (
    <motion.span layoutId="dock-mobile-active" transition={SPRING} className="absolute inset-0 rounded-full bg-primary/12" aria-hidden />
  );
}

/* ------------------------------------------------------------------ */
/* Piezas compartidas                                                  */
/* ------------------------------------------------------------------ */

function Logo() {
  return <LogoMark className="size-8 rounded-[9px]" />;
}

/**
 * Estado del sistema: consulta la API cada 30 s. Un punto que respira indica que responde;
 * si falla, el punto se pone en rojo y el texto dice que no hay conexión.
 */
function useSystemStatus() {
  const [online, setOnline] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    const check = () =>
      fetch("/api/health", { cache: "no-store", signal: AbortSignal.timeout(8000) })
        .then((r) => alive && setOnline(r.ok))
        .catch(() => alive && setOnline(false));
    // Cada 30 s, solo con la pestaña visible; al volver a ella se comprueba enseguida
    let id = 0;
    const startTimer = () => {
      window.clearInterval(id);
      if (document.visibilityState === "visible") id = window.setInterval(check, 30_000);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
      startTimer();
    };
    check();
    startTimer();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  const color = online === null ? "bg-muted-foreground" : online ? "bg-success" : "bg-destructive";
  const text = online === null ? "Verificando…" : online ? "Sistema en línea" : "Sin conexión";
  return { online, color, text };
}

function Dot({ online, color }: { online: boolean | null; color: string }) {
  return (
    <span className="relative flex size-2 shrink-0" aria-hidden>
      {online && <span className="absolute inline-flex size-full animate-ping rounded-full bg-success/60 motion-reduce:animate-none" />}
      <span className={cn("relative inline-flex size-2 rounded-full", color)} />
    </span>
  );
}

/** Punto junto al logotipo del dock; el texto queda para lectores de pantalla y en el título. */
function SystemDot() {
  const { online, color, text } = useSystemStatus();
  return (
    <span role="status" aria-live="polite" title={text} className="relative flex items-center">
      <Dot online={online} color={color} />
      <span className="sr-only">{text}</span>
    </span>
  );
}

function SystemStatusText() {
  const { online, color, text } = useSystemStatus();
  return (
    <span role="status" aria-live="polite" className="flex items-center gap-2 text-xs text-muted-foreground">
      <Dot online={online} color={color} />
      {text}
    </span>
  );
}

/** Nombre del operador: firma los cambios en el historial (o usuario autenticado por correo). */
function OperatorField({ onNavigate, showLogout = false }: { onNavigate?: () => void; showLogout?: boolean }) {
  const router = useRouter();
  const { operator, setOperator } = useApp();
  const { user, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  // Cierra el menú que contiene este campo: el diálogo de ingreso no debe quedar tapado por el menú «Más»
  const openAccount = () => {
    onNavigate?.();
    openAuthModal();
  };
  // En el celular el cierre de sesión va directo aquí; el escritorio lo tiene en el menú de cuenta del dock
  const exit = async () => {
    setBusy(true);
    try {
      await logout();
    } finally {
      setBusy(false);
    }
  };

  if (user) {
    const name = user.full_name || user.username;
    const label = roleLabel(user);
    return (
      <div className="px-1 pb-2">
        <span className="mb-1.5 flex items-center gap-1.5 px-2 text-xs text-muted-foreground">
          <UserRound className="size-3.5" aria-hidden /> Usuario autenticado
        </span>
        <div className="flex items-center justify-between gap-2 rounded-xl bg-fill p-2.5">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="min-w-0 truncate text-xs font-semibold text-foreground">{name}</span>
              <span className="max-w-[50%] shrink-0 truncate rounded-full bg-primary/15 px-1.5 py-0.5 text-xs font-medium text-primary">
                {label}
              </span>
            </div>
            {user.company && (
              <span className="block truncate text-xs text-muted-foreground">{user.company.name}</span>
            )}
          </div>
          <button
            type="button"
            onClick={openAccount}
            className={cn("press shrink-0 rounded-lg px-2 text-xs font-medium text-primary hover:bg-primary/10 pointer-coarse:min-h-11", ring)}
          >
            Cuenta
          </button>
        </div>
        {user.role === "admin" && (
          <Link
            href="/administracion"
            prefetch={false}
            onPointerEnter={() => router.prefetch("/administracion")}
            onFocus={() => router.prefetch("/administracion")}
            onClick={onNavigate}
            className={cn("mt-1.5 flex items-center rounded-lg px-2 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 pointer-coarse:min-h-11", ring)}
          >
            Administrar usuarios y empresas
          </Link>
        )}
        {showLogout && (
          <Button variant="destructive" className="mt-2 w-full" onClick={() => void exit()} disabled={busy}>
            <LogOut className="size-4" aria-hidden />
            Cerrar sesión
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="px-1 pb-2 space-y-2">
      <label className="block">
        <span className="mb-1.5 flex items-center gap-1.5 px-2 text-xs text-muted-foreground">
          <UserRound className="size-3.5" aria-hidden /> Operador (declarado)
        </span>
        <input
          value={operator}
          onChange={(e) => setOperator(e.target.value)}
          placeholder="Tu nombre (firma cambios)"
          maxLength={60}
          className="h-10 w-full rounded-xl bg-fill px-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-[3px] focus:ring-ring/80 pointer-coarse:h-11"
        />
      </label>
      <button
        type="button"
        onClick={openAccount}
        className="w-full text-center text-xs py-2 px-3 rounded-xl border border-primary/30 text-primary hover:bg-primary/10 transition-colors font-medium flex items-center justify-center gap-1.5"
      >
        <Mail className="size-3.5" />
        Ingresar con código al correo
      </button>
    </div>
  );
}
