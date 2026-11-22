"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { Search } from "lucide-react";

import { EASE } from "@/lib/motion";
import { isPublicPath } from "@/components/shell/shell-only";
import type { PaletteResult } from "@/components/shell/command-palette-body";

/**
 * La lista y la búsqueda de la paleta viven en su propio trozo (`command-palette-body`): el armazón de la app solo
 * lleva el atajo, el marco y el campo de texto. El campo se monta con el diálogo y recibe el foco al instante, así la
 * primera tecla no se pierde mientras llega el resto.
 */
const PaletteBody = dynamic(() => import("@/components/shell/command-palette-body").then((m) => m.CommandPaletteBody), {
  ssr: false,
  loading: () => <PaletteLoading />,
});

let paletteRequested = false;
/** Pide el trozo al mostrar intención (puntero o foco) o al pulsar el atajo; repetirlo no descarga nada de nuevo. */
export function preloadCommandPalette() {
  if (paletteRequested) return;
  paletteRequested = true;
  void import("@/components/shell/command-palette-body");
}

const Ctx = createContext<{ open: () => void; preload: () => void; shortcut: string }>({
  open: () => {},
  preload: () => {},
  shortcut: "Ctrl K",
});
export const useCommandPalette = () => useContext(Ctx);

function PaletteLoading() {
  return (
    <div aria-hidden className="p-2">
      <div className="skeleton mx-3 mt-2 mb-2 h-3 w-16 rounded" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="skeleton mx-2 mt-1 h-9 rounded-xl" />
      ))}
    </div>
  );
}

export function CommandPalette({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [activeId, setActiveId] = useState<string | undefined>(undefined);
  const results = useRef<PaletteResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const mac = useSyncExternalStore(
    () => () => {},
    () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent),
    () => false,
  );

  const show = useCallback(() => {
    preloadCommandPalette();
    results.current = [];
    setActiveId(undefined);
    setQ("");
    setActive(0);
    setOpen(true);
  }, []);
  const close = useCallback(() => {
    results.current = [];
    setActiveId(undefined);
    setOpen(false);
  }, []);

  // Atajos globales: Ctrl/⌘ + K, y "/" fuera de los campos de texto. El trozo de la lista se pide a la vez.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isPublicPath(window.location.pathname)) return; // la búsqueda es de la app, no de las páginas públicas
      const typing = /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement)?.tagName ?? "") ||
        (e.target as HTMLElement)?.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) close();
        else show();
      } else if (e.key === "/" && !typing && !open) {
        e.preventDefault();
        show();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close, show]);

  // El foco entra al abrir: el campo existe desde el primer cuadro, aunque la lista todavía esté llegando.
  useEffect(() => {
    if (open) inputRef.current?.focus({ preventScroll: true });
  }, [open]);

  const onResults = useCallback((items: PaletteResult[]) => {
    results.current = items;
  }, []);
  const onActiveId = useCallback((id: string | undefined) => setActiveId(id), []);

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.max(0, Math.min(a + 1, results.current.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      results.current[active]?.run();
    } else if (e.key === "Escape") {
      close();
    }
  };

  const value = useMemo(
    () => ({ open: show, preload: preloadCommandPalette, shortcut: mac ? "⌘ K" : "Ctrl K" }),
    [show, mac],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[75] flex items-start justify-center px-3 pt-[12dvh]" role="presentation">
            <motion.div
              className="absolute inset-0 bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12, ease: EASE }}
              onClick={close}
              aria-hidden
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Buscar o ejecutar un comando"
              initial={{ opacity: 0, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12, ease: EASE }}
              className="glass relative w-full max-w-xl overflow-hidden rounded-3xl"
              style={{ backgroundColor: "var(--card)" }}
            >
              <div className="flex items-center gap-3 border-b border-border px-4">
                <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                <input
                  ref={inputRef}
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setActive(0);
                  }}
                  onKeyDown={onInputKey}
                  role="combobox"
                  aria-expanded
                  aria-controls="palette-list"
                  aria-activedescendant={activeId ? `palette-${activeId}` : undefined}
                  aria-label="Buscar envíos, ciudades o comandos"
                  placeholder="Buscar envíos, ciudades o comandos"
                  className="h-14 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
                />
              </div>
              <PaletteBody
                q={q}
                active={active}
                setActive={setActive}
                onClose={close}
                onResults={onResults}
                onActiveId={onActiveId}
              />
              <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd> navegar</span>
                <span className="flex items-center gap-1.5"><Kbd>Intro</Kbd> abrir</span>
                <span className="flex items-center gap-1.5"><Kbd>Esc</Kbd> cerrar</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Ctx.Provider>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded-md border border-border-strong px-1.5 font-sans text-[11px] font-medium">{children}</kbd>;
}
