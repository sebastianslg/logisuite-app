"use client";

import { useLayoutEffect, useRef } from "react";

import { cn } from "@/lib/utils";

/**
 * Transición compartida del código de envío (fila o tarjeta → encabezado del detalle).
 * El detalle carga con Suspense, así que el navegador no puede emparejar los dos elementos con View
 * Transitions. En su lugar: al tocar, se guarda la caja del código en la lista; al montarse el encabezado,
 * si el código coincide y el toque fue reciente, el título arranca en esa caja y vuela a su sitio (FLIP)
 * con solo `transform`, 500 ms. El resto de la página hace el fundido de la vista. Con "Reducir movimiento"
 * no hay vuelo.
 */
let pending: { code: string; rect: DOMRect; at: number } | null = null;

export function rememberCode(code: string, el: Element | null) {
  if (!el) return;
  pending = { code, rect: el.getBoundingClientRect(), at: performance.now() };
}

/** Busca dentro de `root` el elemento del código (marcado con data-code) y lo recuerda. */
export function rememberCodeIn(root: Element, code: string) {
  rememberCode(code, root.querySelector(`[data-code="${CSS.escape(code)}"]`));
}

export function SharedCode({ code, className }: { code: string; className?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const from = pending;
    pending = null;
    if (!el || !from || from.code !== code || performance.now() - from.at > 4000) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const to = el.getBoundingClientRect();
    if (!to.width || !to.height) return;
    const scale = from.rect.height / to.height;
    const dx = from.rect.left - to.left;
    const dy = from.rect.top - to.top;
    const anim = el.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0.6 },
        { transform: "translate(0, 0) scale(1)", opacity: 1 },
      ],
      { duration: 500, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
    );
    return () => anim.cancel();
  }, [code]);

  return (
    <h1 ref={ref} className={cn("origin-top-left", className)}>
      {code}
    </h1>
  );
}
