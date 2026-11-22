import { LiveStamp } from "@/components/shell/live-stamp";
import { MODE_ORDER, MODES } from "@/lib/modes";

/**
 * Kilómetros de la red por modo (los mismos de la presentación y de la imagen para compartir). Dan el largo de cada
 * tramo de la línea de red: la firma visual de Westvane es su propia red, no un adorno genérico.
 */
const NETWORK_KM: Record<(typeof MODE_ORDER)[number], number> = {
  maritimo: 3340,
  terrestre: 12628,
  aereo: 13437,
  ferreo: 1464,
  fluvial: 4480,
};

/**
 * Encabezado de cada pantalla de la app: arriba la hora de la operación (en vivo), el título y la descripción, las
 * acciones a la derecha, y debajo la línea de red: un trazo con los cinco modos, cada tramo del largo real de su red,
 * con un nodo en cada cambio de modo. Se dibuja de izquierda a derecha al entrar (solo transform; nada con «reducir
 * movimiento») y luego queda quieta.
 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="reveal-up mb-8 md:mb-10">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <LiveStamp />
          <h1 className="mt-2 text-[2rem] leading-[1.05] font-semibold tracking-[-0.035em] text-balance md:text-[2.75rem]">{title}</h1>
          {description && (
            <p className="mt-3 line-clamp-2 max-w-[62ch] text-[0.9375rem] leading-relaxed text-muted-foreground md:line-clamp-none">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </header>
      <NetworkRule />
    </div>
  );
}

/** La línea de red: cinco tramos con su color de modo y un nodo en cada unión. Decorativa (la leyenda está en Red). */
export function NetworkRule({ className = "" }: { className?: string }) {
  return (
    <div className={`network-rule mt-6 flex items-center md:mt-7 ${className}`} aria-hidden>
      <span className="network-node" style={{ "--i": 0 } as React.CSSProperties} />
      {MODE_ORDER.map((m, i) => (
        <span key={m} className="contents">
          <span
            className="network-seg"
            style={{ flexGrow: NETWORK_KM[m], backgroundColor: MODES[m].color, "--i": i } as React.CSSProperties}
          />
          <span className="network-node" style={{ "--i": i + 1 } as React.CSSProperties} />
        </span>
      ))}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-3xl ${className}`} aria-hidden />;
}
