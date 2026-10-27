"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import {
  Ellipsis,
  Fuel,
  Keyboard,
  LayoutDashboard,
  Leaf,
  Network,
  Package,
  Search,
  Settings,
  TrafficCone,
  Truck,
  UserRound,
  Warehouse,
  Waypoints,
  type LucideIcon,
} from "lucide-react";

import { useApp } from "@/components/providers";
import { useCommandPalette } from "@/components/shell/command-palette";
import { OPEN_SHORTCUTS_EVENT } from "@/components/shell/shortcuts";
import { CurrencyControl, ThemeControl } from "@/components/shell/toolbar";
import { EASE, SPRING, stagger } from "@/lib/motion";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; short?: string; icon: LucideIcon };

/** Los cinco destinos del dock (el quinto es "Más"). */
const PRIMARY: NavItem[] = [
  { href: "/", label: "Resumen", icon: LayoutDashboard },
  { href: "/envios", label: "Envíos", icon: Package },
  { href: "/red", label: "Red", icon: Network },
  { href: "/flota", label: "Flota", icon: Truck },
];
/** Lo que vive dentro de "Más". */
const MORE: NavItem[] = [
  { href: "/vias", label: "Vías y cierres", short: "Vías", icon: TrafficCone },
  { href: "/bodegas", label: "Bodegas", icon: Warehouse },
  { href: "/combustible", label: "Combustible", icon: Fuel },
  { href: "/huella", label: "Huella de carbono", short: "Huella", icon: Leaf },
  { href: "/configuracion", label: "Configuración", icon: Settings },
];

const ring = "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/80";

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
}

/**
 * Navegación de primer nivel. En escritorio, un dock de vidrio flotante y centrado arriba (radio 999 px)
 * con cinco destinos, búsqueda (Ctrl K), moneda y apariencia; se reduce a íconos al bajar por la página
 * y vuelve al subir, al pasar el puntero o al recibir el foco. En celular, un dock inferior con cuatro
 * destinos y "Más", que abre una hoja desde abajo (se cierra arrastrándola).
 */
export function Dock() {
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
  const { open: openPalette, shortcut } = useCommandPalette();
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
    <div className="pointer-events-none fixed inset-x-0 top-3 z-40 hidden justify-center px-4 md:flex">
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
          <Link href="/" aria-label="Westvane, resumen" className={cn("press relative flex items-center gap-2 rounded-full py-1 pr-2 pl-1", ring)}>
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
          <button
            type="button"
            onClick={openPalette}
            aria-label="Buscar envíos, ciudades o comandos"
            title={`Buscar (${shortcut})`}
            className={cn("press flex h-10 items-center gap-2 rounded-full bg-fill px-3 text-sm text-muted-foreground hover:text-foreground", ring)}
          >
            <Search className="size-4 shrink-0" aria-hidden />
            {showLabels && <span className="hidden xl:inline">Buscar</span>}
            <kbd className="hidden rounded-full border border-border-strong px-1.5 text-[11px] font-medium lg:inline">{shortcut}</kbd>
          </button>
          <CurrencyControl />
          <ThemeControl />
        </motion.div>
      </motion.header>
    </div>
  );
}

function DockLink({ item, active, showLabel }: { item: NavItem; active: boolean; showLabel: boolean }) {
  const { href, label, icon: Icon } = item;
  return (
    <Link
      href={href}
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
                      aria-current={on ? "page" : undefined}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "press flex h-10 items-center gap-3 rounded-xl px-3 text-sm",
                        ring,
                        on ? "bg-primary/12 font-medium text-primary" : "hover:bg-fill",
                      )}
                    >
                      <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
                      {label}
                    </Link>
                  </motion.li>
                );
              })}
            </ul>
            <div className="mt-2 border-t border-border pt-2">
              <OperatorField />
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  window.dispatchEvent(new Event(OPEN_SHORTCUTS_EVENT));
                }}
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
/* Celular                                                             */
/* ------------------------------------------------------------------ */

function MobileDock() {
  const isActive = useIsActive();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const moreActive = MORE.some((m) => isActive(m.href));
  const { open: openPalette } = useCommandPalette();
  const closeRef = useRef<HTMLButtonElement>(null);

  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

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
        <LayoutGroup id="dock-mobile">
          {PRIMARY.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group/item press relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[11px]",
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
            aria-expanded={open}
            className={cn(
              "group/item press relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[11px]",
              ring,
              moreActive ? "font-semibold text-primary" : "text-foreground/70",
            )}
          >
            {moreActive && <MobilePill />}
            <DockIcon icon={Ellipsis} active={moreActive} />
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
                  openPalette();
                }}
                className={cn("press mt-4 flex h-12 items-center gap-2 rounded-full bg-fill px-4 text-[0.9375rem] text-muted-foreground", ring)}
              >
                <Search className="size-4" aria-hidden /> Buscar envíos, ciudades o comandos
              </button>
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
                <OperatorField />
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
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-solid text-primary-foreground">
      <Waypoints className="size-4" aria-hidden />
    </span>
  );
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

/** Nombre del operador: firma los cambios en el historial (no hay autenticación; es un nombre declarado). */
function OperatorField() {
  const { operator, setOperator } = useApp();
  return (
    <label className="block px-1 pb-2">
      <span className="mb-1.5 flex items-center gap-1.5 px-2 text-xs text-muted-foreground">
        <UserRound className="size-3.5" aria-hidden /> Operador
      </span>
      <input
        value={operator}
        onChange={(e) => setOperator(e.target.value)}
        placeholder="Tu nombre (firma cambios)"
        maxLength={60}
        className="h-10 w-full rounded-xl bg-fill px-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-[3px] focus:ring-ring/80 pointer-coarse:h-11"
      />
    </label>
  );
}
