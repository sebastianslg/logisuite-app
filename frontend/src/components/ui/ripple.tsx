"use client";

import { useEffect } from "react";

/**
 * Onda de luz al tocar: un círculo de `currentColor` al 12 % nace en el punto del toque, crece hasta
 * cubrir el control y se desvanece en 500 ms. Solo anima `transform` y `opacity` (Web Animations API,
 * sin re-renderizar React) y vive en una capa propia con `overflow: hidden`, así el control puede
 * dejar ver las chispas de `useBurst` por fuera de su borde.
 *
 * Se aplica por delegación a todo elemento con la clase `press` o el atributo `data-ripple`
 * (botones, enlaces-botón, tarjetas clicables). `data-no-ripple` lo excluye. Las filas de tabla no
 * llevan onda (un <span> no es hijo válido de <tr>). Con "Reducir movimiento" no hace nada.
 */
const SELECTOR = ".press, [data-ripple]";
const DURATION = 500;

export function spawnRipple(el: HTMLElement, clientX: number, clientY: number) {
  if (el.tagName === "TR" || el.tagName === "TABLE" || el.tagName === "TBODY") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const box = el.getBoundingClientRect();
  if (!box.width || !box.height) return;
  if (getComputedStyle(el).position === "static") el.style.position = "relative";

  let host = el.querySelector<HTMLSpanElement>(":scope > [data-ripple-host]");
  if (!host) {
    host = document.createElement("span");
    host.dataset.rippleHost = "";
    host.setAttribute("aria-hidden", "true");
    host.style.cssText =
      "position:absolute;inset:0;overflow:hidden;border-radius:inherit;pointer-events:none;z-index:0;contain:strict";
    el.appendChild(host);
  }

  const size = Math.max(box.width, box.height) * 2.2;
  const dot = document.createElement("span");
  dot.style.cssText = [
    "position:absolute",
    `left:${clientX - box.left - size / 2}px`,
    `top:${clientY - box.top - size / 2}px`,
    `width:${size}px`,
    `height:${size}px`,
    "border-radius:999px",
    "background:currentColor",
    "opacity:0",
    "will-change:transform,opacity",
  ].join(";");
  host.appendChild(dot);

  const anim = dot.animate(
    [
      { transform: "scale(0)", opacity: 0.12 },
      { transform: "scale(1)", opacity: 0 },
    ],
    { duration: DURATION, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "forwards" },
  );
  const cleanup = () => dot.remove();
  anim.onfinish = cleanup;
  anim.oncancel = cleanup;
}

/** Se monta una sola vez en el layout: escucha los toques de toda la app. */
export function RippleRoot() {
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const target = e.target as Element | null;
      const el = target?.closest<HTMLElement>(SELECTOR);
      if (!el || el.closest("[data-no-ripple]")) return;
      if ((el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true") return;
      spawnRipple(el, e.clientX, e.clientY);
    };
    document.addEventListener("pointerdown", onDown, { passive: true });
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);
  return null;
}
