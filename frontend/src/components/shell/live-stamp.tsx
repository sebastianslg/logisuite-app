"use client";

import { useLiveClock } from "@/lib/sondeo";

const fmt = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** «Bogotá · dom 22 nov · 14:02» (las partes por separado: el formato de una sola cadena cambia entre navegadores). */
function stamp(d: Date) {
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value.replace(/\./g, "")]));
  return `Bogotá · ${p.weekday} ${p.day} ${p.month} · ${p.hour}:${p.minute}`;
}

/**
 * «Operación en vivo · Bogotá, sáb 22 nov · 14:02»: la hora de la operación sobre el título de cada pantalla. Solo en el
 * navegador (la hora no puede quedar fija en el HTML prerenderizado). Usa el reloj compartido de 30 s: un solo
 * temporizador para toda la app, detenido con la pestaña oculta. El punto es quieto, sin pulsar: nada se mueve en reposo.
 */
export function LiveStamp() {
  const now = useLiveClock();

  return (
    <p className="flex h-5 min-w-0 items-center gap-2 whitespace-nowrap text-xs font-medium tracking-[0.02em] text-muted-foreground">
      <span className="size-1.5 rounded-full bg-[var(--success)]" aria-hidden />
      <span>Operación en vivo</span>
      {now && (
        <span className="tabular stamp-in min-w-0 truncate text-muted-foreground">
          <span aria-hidden> · </span>
          {stamp(now)}
        </span>
      )}
    </p>
  );
}
