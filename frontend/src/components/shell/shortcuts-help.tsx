"use client";

import { Sheet } from "@/components/ui/sheet";
import { GO } from "@/components/shell/shortcuts";

/** Lo que explica la hoja: los atajos globales primero y, después, cada destino de «g» y una letra. */
const HELP: { keys: string[]; label: string }[] = [
  { keys: ["Ctrl", "K"], label: "Buscar o ejecutar un comando" },
  { keys: ["/"], label: "Buscar (fuera de un campo de texto)" },
  { keys: ["n"], label: "Crear un envío" },
  ...GO.map((g) => ({ keys: ["g", g.key], label: g.label })),
  { keys: ["?"], label: "Ver estos atajos" },
  { keys: ["Esc"], label: "Cerrar paneles y hojas" },
];

/** Cómo se lee cada tecla con un lector de pantalla (las letras sueltas ya se leen bien). */
const KEY_NAMES: Record<string, string> = {
  "?": "signo de interrogación",
  "/": "barra",
  Esc: "Escape",
};

const keysLabel = (keys: string[]) =>
  keys.map((k) => KEY_NAMES[k] ?? k).join(keys.length === 2 && keys[0] === "g" ? ", luego " : " más ");

/**
 * Hoja «Atajos de teclado». Vive en su propio trozo: se descarga al abrirla o al pasar el puntero por la acción
 * que la abre, no con la primera pantalla de la app. El foco y el cierre siguen a cargo de `Sheet`.
 */
export function ShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Atajos de teclado" description="Para trabajar sin soltar el teclado">
      <ul className="flex flex-col">
        {HELP.map((h) => (
          <li key={h.label} className="flex items-center justify-between gap-4 border-b border-border py-2.5 text-sm last:border-0">
            <span>{h.label}</span>
            <span className="flex shrink-0 items-center gap-1">
              {/* El lector de pantalla oye la secuencia completa («Ctrl más K»), no dos teclas sueltas */}
              <span className="sr-only">{keysLabel(h.keys)}</span>
              <span aria-hidden className="flex items-center gap-1">
                {h.keys.map((k, i) => (
                  <span key={`${k}-${i}`} className="flex items-center gap-1">
                    {i > 0 && h.keys[0] === "g" && <span className="text-xs text-muted-foreground">luego</span>}
                    <kbd className="inline-flex min-w-6 items-center justify-center rounded-md border border-border-strong bg-fill px-1.5 py-0.5 text-xs leading-4 font-medium">
                      {k}
                    </kbd>
                  </span>
                ))}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
