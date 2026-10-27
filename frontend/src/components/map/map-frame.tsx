"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Minimize2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Marco del mapa con morph a pantalla completa: al activarse, el contenedor pasa a `position: fixed` con
 * `inset: 0` y radio 0, y framer-motion anima el cambio con un resorte usando solo transform (layout).
 *
 * El mapa no se redibuja durante la transición: mientras el marco se mueve, la capa del mapa conserva su
 * tamaño anterior (deck.gl no ve un cambio de tamaño) y una cubierta opaca la tapa; al terminar el resorte
 * recupera el tamaño del marco, deck.gl se redimensiona una sola vez y la cubierta se desvanece en 200 ms.
 * Escape o "Salir" devuelven el marco a su sitio. Con "Reducir movimiento" el cambio es inmediato.
 */
export function MapFrame({
  full,
  onExit,
  radius = 0,
  className,
  children,
}: {
  full: boolean;
  onExit: () => void;
  /** Radio del marco fuera de pantalla completa (28 px en tarjetas de medios). */
  radius?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const inner = useRef<HTMLDivElement>(null);
  const size = useRef<{ w: number; h: number } | null>(null);
  const morphing = useRef(false);
  const fallback = useRef<ReturnType<typeof setTimeout> | null>(null);
  const first = useRef(true);
  // Cubierta opaca sobre el mapa durante el morph. No se oculta el canvas con opacity: Chrome libera la capa
  // de WebGL y recrearla al volver costaba segundos en equipos sin GPU.
  const cover = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!full) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onExit();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [full, onExit]);

  // Tamaño en reposo de la capa del mapa (el que se congela durante el morph)
  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      if (!morphing.current) size.current = { w: e.contentRect.width, h: e.contentRect.height };
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const settle = () => {
    const el = inner.current;
    if (fallback.current) clearTimeout(fallback.current);
    if (!el || !morphing.current) return;
    morphing.current = false;
    el.style.width = "";
    el.style.height = "";
    const c = cover.current;
    if (c) {
      const fade = c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: "cubic-bezier(0.16, 1, 0.3, 1)" });
      fade.onfinish = () => {
        c.style.opacity = "0";
      };
    }
  };

  // Antes de que deck.gl mida el nuevo tamaño, la capa se queda con el anterior y se oculta
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const el = inner.current;
    if (!el || !size.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    morphing.current = true;
    el.style.width = `${size.current.w}px`;
    el.style.height = `${size.current.h}px`;
    if (cover.current) cover.current.style.opacity = "1";
    fallback.current = setTimeout(settle, 900);
    return () => {
      if (fallback.current) clearTimeout(fallback.current);
    };
  }, [full]);

  return (
    <motion.div
      data-map-frame
      layout
      transition={SPRING}
      onLayoutAnimationComplete={settle}
      className={cn(full ? "fixed inset-0 z-[60] h-dvh w-full" : className, "overflow-hidden bg-background")}
      style={{ borderRadius: full ? 0 : radius }}
    >
      <div ref={inner} className="absolute inset-0">
        {children}
      </div>
      <div ref={cover} aria-hidden className="pointer-events-none absolute inset-0 bg-background" style={{ opacity: 0 }} />
      {full && (
        <Button variant="secondary" className="floating absolute top-3 right-3 z-[70]" onClick={onExit}>
          <Minimize2 />
          Salir de pantalla completa
        </Button>
      )}
    </motion.div>
  );
}
