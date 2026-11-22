"use client";

import { useEffect, useId, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EASE, T_VIEW } from "@/lib/motion";
import { useMedia } from "@/lib/use-media";
import { cn } from "@/lib/utils";

/** Lo enfocable dentro de la hoja: el Tab no debe escaparse a la página que queda detrás. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Hoja modal. En pantallas anchas es un inspector que entra por la derecha; en móvil, una hoja
 * inferior con agarradera que se cierra deslizándola hacia abajo. Esc o tocar fuera la cierran,
 * el foco entra en la hoja, se queda dentro mientras está abierta y vuelve a lo que la abrió.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  actions,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const mobile = useMedia("(max-width: 767px)");
  const titleId = useId();
  const descriptionId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  // El cierre llega por ref: casi todas las hojas pasan una flecha nueva en cada render, y si fuera una dependencia del
  // efecto, cada redibujo del dueño devolvería el foco al botón de cerrar y perdería a qué elemento volver.
  const closeFn = useRef(onClose);
  useEffect(() => {
    closeFn.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeFn.current();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      // El foco queda dentro de la hoja (aria-modal): al pasar del último elemento vuelve al primero
      // Solo lo que el Tab de verdad visita: visible, sin tabindex=-1 y, en un grupo de radios, el marcado
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) =>
          el.getClientRects().length > 0 &&
          el.tabIndex >= 0 &&
          !(el instanceof HTMLInputElement && el.type === "radio" && !el.checked && el.name && el.form?.querySelector(`input[name="${el.name}"]:checked`)),
      );
      if (!items.length) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!panelRef.current.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    const t = setTimeout(() => closeRef.current?.focus(), 50);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(t);
      document.body.style.overflow = prevOverflow;
      // Vuelve a lo que la abrió; si ese elemento ya no existe (un ítem de un menú que se cerró),
      // el foco va al contenido en lugar de quedarse en el <body>.
      const back = opener.current;
      if (back?.isConnected) back.focus();
      else document.getElementById("contenido")?.focus({ preventScroll: true });
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70]" role="presentation">
          <motion.div
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            onClick={onClose}
            aria-hidden
          />
          <motion.section
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            initial={mobile ? { y: "100%" } : { x: 48, opacity: 0 }}
            animate={mobile ? { y: 0 } : { x: 0, opacity: 1 }}
            exit={mobile ? { y: "100%" } : { x: 48, opacity: 0 }}
            transition={T_VIEW}
            drag={mobile ? "y" : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
            className={cn(
              "glass absolute flex flex-col overflow-hidden bg-card",
              "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-3xl",
              "md:inset-y-3 md:right-3 md:left-auto md:max-h-none md:w-[min(640px,calc(100vw-1.5rem))] md:rounded-3xl",
              className,
            )}
            style={{ backgroundColor: "var(--card)" }}
          >
            <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-border-strong md:hidden" aria-hidden />
            <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
              <div className="min-w-0">
                <h2 id={titleId} className="truncate text-lg font-bold tracking-tight">{title}</h2>
                {description && <p id={descriptionId} className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {actions}
                <Button ref={closeRef} variant="ghost" size="icon" aria-label="Cerrar" onClick={onClose}>
                  <X />
                </Button>
              </div>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">{children}</div>
          </motion.section>
        </div>
      )}
    </AnimatePresence>
  );
}
