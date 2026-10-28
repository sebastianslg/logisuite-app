"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Sheet } from "@/components/ui/sheet";

export const OPEN_SHORTCUTS_EVENT = "westvane:shortcuts";

/** Teclas de navegación: "g" y luego una letra, como en las apps de escritorio. */
const GO: { key: string; href: string; label: string }[] = [
  { key: "d", href: "/", label: "Ir al dashboard" },
  { key: "e", href: "/envios", label: "Ir a envíos" },
  { key: "r", href: "/red", label: "Ir a la red multimodal" },
  { key: "v", href: "/vias", label: "Ir a vías y cierres" },
  { key: "f", href: "/flota", label: "Ir a la flota" },
  { key: "b", href: "/bodegas", label: "Ir a bodegas" },
  { key: "c", href: "/combustible", label: "Ir a combustible" },
  { key: "h", href: "/huella", label: "Ir a huella de carbono" },
  { key: "t", href: "/historial", label: "Ir al historial de trayectos" },
  { key: "s", href: "/configuracion", label: "Ir a configuración" },
];

const HELP: { keys: string[]; label: string }[] = [
  { keys: ["Ctrl", "K"], label: "Buscar o ejecutar un comando" },
  { keys: ["/"], label: "Buscar (fuera de un campo de texto)" },
  { keys: ["n"], label: "Crear un envío" },
  ...GO.map((g) => ({ keys: ["g", g.key], label: g.label })),
  { keys: ["?"], label: "Ver estos atajos" },
  { keys: ["Esc"], label: "Cerrar paneles y hojas" },
];

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (/INPUT|TEXTAREA|SELECT/.test(el.tagName) || el.isContentEditable);
};

/** Atajos de teclado de escritorio y la hoja que los explica. Se ignoran al escribir en un campo. */
export function Shortcuts() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const pending = useRef<number | null>(null);

  useEffect(() => {
    const clear = () => {
      if (pending.current) window.clearTimeout(pending.current);
      pending.current = null;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      if (e.key === "?") {
        e.preventDefault();
        setOpen(true);
        clear();
        return;
      }
      if (pending.current) {
        const target = GO.find((g) => g.key === e.key.toLowerCase());
        clear();
        if (target) {
          e.preventDefault();
          router.push(target.href);
        }
        return;
      }
      if (e.key === "g") {
        pending.current = window.setTimeout(clear, 1200);
      } else if (e.key === "n") {
        e.preventDefault();
        router.push("/envios/nuevo");
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_SHORTCUTS_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_SHORTCUTS_EVENT, onOpen);
      clear();
    };
  }, [router]);

  return (
    <Sheet open={open} onClose={() => setOpen(false)} title="Atajos de teclado" description="Para trabajar sin soltar el teclado">
      <ul className="flex flex-col">
        {HELP.map((h) => (
          <li key={h.label} className="flex items-center justify-between gap-4 border-b border-border py-2.5 text-sm last:border-0">
            <span>{h.label}</span>
            <span className="flex shrink-0 items-center gap-1">
              {h.keys.map((k, i) => (
                <span key={k} className="flex items-center gap-1">
                  {i > 0 && h.keys[0] === "g" && <span className="text-xs text-muted-foreground">luego</span>}
                  <kbd className="rounded-md border border-border-strong bg-fill px-1.5 py-0.5 text-xs font-medium">{k}</kbd>
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
