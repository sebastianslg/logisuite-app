"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

import { isPublicPath } from "@/components/shell/shell-only";

/**
 * La ayuda va en su propio trozo (la tecla «?» o la acción del menú la piden): así la primera pantalla no carga el
 * contenido de la hoja solo para tenerla cerrada. Se pide al mostrar intención (puntero o foco) y al abrirla, nunca
 * en reposo.
 */
const ShortcutsHelp = dynamic(() => import("@/components/shell/shortcuts-help").then((m) => m.ShortcutsHelp), {
  ssr: false,
});

let helpRequested = false;
/** Descarga la ayuda antes de abrirla (hover o foco); repetirlo no pide nada de nuevo. */
export function preloadShortcutsHelp() {
  if (helpRequested) return;
  helpRequested = true;
  void import("@/components/shell/shortcuts-help");
}

export const OPEN_SHORTCUTS_EVENT = "westvane:shortcuts";

/** Teclas de navegación: "g" y luego una letra, como en las apps de escritorio. */
export const GO: { key: string; href: string; label: string }[] = [
  { key: "d", href: "/panel", label: "Ir al resumen" },
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

/** Teclas que llevan a `href`, para mostrarlas junto a la acción (menú del dock y paleta). */
export function shortcutFor(href: string): string[] | undefined {
  const target = GO.find((g) => g.href === href);
  return target ? ["g", target.key] : undefined;
}

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (/INPUT|TEXTAREA|SELECT/.test(el.tagName) || el.isContentEditable);
};

/** Atajos de teclado de escritorio y la hoja que los explica. Se ignoran al escribir en un campo. */
export function Shortcuts() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Una vez abierta, la hoja sigue montada para que su salida se anime y el estado no se pierda
  const [loaded, setLoaded] = useState(false);
  const pending = useRef<number | null>(null);
  // Estable: si este componente se vuelve a dibujar, la hoja no repite el efecto que mueve el foco
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const clear = () => {
      if (pending.current) window.clearTimeout(pending.current);
      pending.current = null;
    };
    const onKey = (e: KeyboardEvent) => {
      // En la presentación y el seguimiento públicos no hay atajos: un visitante no debe caer en «Nuevo envío» por error
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target) || isPublicPath(window.location.pathname)) return;
      if (e.key === "?") {
        e.preventDefault();
        preloadShortcutsHelp();
        setLoaded(true);
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
    const onOpen = () => {
      // La acción que abre la ayuda (dock o Configuración) ya mostró intención: el trozo se pide aquí
      preloadShortcutsHelp();
      setLoaded(true);
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_SHORTCUTS_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_SHORTCUTS_EVENT, onOpen);
      clear();
    };
  }, [router]);

  return loaded ? <ShortcutsHelp open={open} onClose={close} /> : null;
}
