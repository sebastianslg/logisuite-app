"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EASE, T_VIEW } from "@/lib/motion";
import { useMedia } from "@/lib/use-media";
import { cn } from "@/lib/utils";

/**
 * Hoja modal. En pantallas anchas es un inspector que entra por la derecha; en móvil, una hoja
 * inferior con agarradera que se cierra deslizándola hacia abajo. Esc o tocar fuera la cierran,
 * el foco entra en la hoja y vuelve a lo que la abrió.
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
  const closeRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const t = setTimeout(() => closeRef.current?.focus(), 50);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(t);
      document.body.style.overflow = prevOverflow;
      opener.current?.focus?.();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50" role="presentation">
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
            role="dialog"
            aria-modal="true"
            aria-label={title}
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
                <h2 className="truncate text-lg font-bold tracking-tight">{title}</h2>
                {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
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
