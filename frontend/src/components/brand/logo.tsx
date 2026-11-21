import { cn } from "@/lib/utils";

/**
 * Marca de Westvane: la W trazada como una ruta, con origen y destino, sobre el azul de los botones. Es el mismo dibujo
 * de `app/icon.svg` (de donde salen el favicon y los íconos de instalación con `scripts/brand-assets.mjs`): si cambia
 * uno, cambia el otro.
 */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      className={cn("size-8 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <rect width="512" height="512" rx="112" fill="#0071e3" />
      <polyline
        points="122,172 194,344 256,226 318,344 390,172"
        fill="none"
        stroke="#fff"
        strokeWidth="34"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="122" cy="172" r="30" fill="#fff" />
      <circle cx="390" cy="172" r="30" fill="#fff" />
      <circle cx="256" cy="226" r="14" fill="#0071e3" />
    </svg>
  );
}

/** Marca y nombre juntos. El nombre va en Inter, como toda la app. */
export function Wordmark({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-[1.0625rem] font-semibold tracking-[-0.02em]", className)}>
      <LogoMark className={cn("size-7", markClassName)} />
      Westvane
    </span>
  );
}
