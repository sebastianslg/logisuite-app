import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Check, CircleCheck, CircleDot, Clock, MapPin } from "lucide-react";

import { AutoRefresh } from "@/components/tracking/auto-refresh";
import { Skeleton } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { apiGetOrNull } from "@/lib/api";
import { MODES } from "@/lib/modes";
import type { TrackingView } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Seguimiento de envío",
  description: "Estado, avance y llegada estimada de tu envío.",
  robots: { index: false, follow: false },
};

/** Seguimiento público de un envío: solo lectura, sin costos ni datos internos. */
export default function SeguimientoPage({ params }: PageProps<"/seguimiento/[token]">) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 md:py-14">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Westvane · seguimiento de envío</p>
      <Suspense fallback={<Skeleton className="mt-6 h-[420px]" />}>
        <Body params={params} />
      </Suspense>
      <p className="mt-10 text-xs text-muted-foreground">
        Información de referencia, con datos de operación simulados. Los tiempos son estimados y pueden cambiar.
      </p>
    </div>
  );
}

async function Body({ params }: { params: PageProps<"/seguimiento/[token]">["params"] }) {
  const { token } = await params;
  const t = await apiGetOrNull<TrackingView>(`/api/tracking/${encodeURIComponent(token)}`);
  if (!t) notFound();
  const done = t.status === "Entregado";
  return (
    <>
      <AutoRefresh seconds={60} />
      <h1 className="mt-3 font-mono text-[1.75rem] leading-tight font-semibold tracking-[-0.02em]">{t.code}</h1>
      <p className="mt-1 text-[1.0625rem] font-medium">
        {t.origin} <span className="text-muted-foreground">→</span> {t.destination}
      </p>
      <p className="text-sm text-muted-foreground">{t.cargo}</p>

      <section className="glass mt-6 rounded-3xl p-5" aria-label="Estado">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StatusBadge status={t.status} />
          <span className="tabular text-sm text-muted-foreground">Avance {Math.round(t.progress_pct)} %</span>
        </div>
        <div className="mt-3 h-2 rounded-full bg-fill" role="progressbar" aria-valuenow={Math.round(t.progress_pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Avance del envío">
          <div className="meter-fill h-full rounded-full bg-[var(--accent-solid)]" style={{ "--v": t.progress_pct / 100 } as React.CSSProperties} />
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="size-3.5" aria-hidden />{done ? "Entregado (estimado)" : "Llegada estimada"}</dt>
            <dd className="tabular mt-0.5 font-medium">{t.eta_fmt}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Retraso</dt>
            <dd className={cn("tabular mt-0.5 font-medium", t.delay_fmt && "text-destructive")}>{t.delay_fmt ?? "Sin retraso"}</dd>
          </div>
        </dl>
        {t.delivery && (
          <p className="mt-4 flex items-center gap-2 border-t border-border pt-4 text-sm font-medium text-success">
            <CircleCheck className="size-4 shrink-0" aria-hidden />
            Entrega confirmada · {new Date(t.delivery.received_at).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })} · {t.delivery.condition_label.toLowerCase()}
          </p>
        )}
      </section>

      <section className="mt-6" aria-labelledby="ruta">
        <h2 id="ruta" className="text-sm font-semibold">Recorrido</h2>
        <ol className="mt-3 flex flex-col">
          {t.legs.map((l, i) => {
            const state = t.route_h >= l.end_h || done ? "hecho" : t.route_h >= l.start_h ? "en curso" : "pendiente";
            const Icon = MODES[l.mode].icon;
            return (
              <li key={i} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3 pb-4 last:pb-0">
                <span className={cn("flex size-7 items-center justify-center rounded-full ring-4 ring-[var(--background)]", state === "pendiente" ? "bg-fill text-muted-foreground" : "bg-[var(--accent-solid)] text-white")}>
                  {state === "hecho" ? <Check className="size-3.5" aria-hidden /> : state === "en curso" ? <CircleDot className="size-3.5" aria-hidden /> : <MapPin className="size-3.5" aria-hidden />}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Icon className="size-3.5" style={{ color: MODES[l.mode].color }} aria-hidden />
                    {l.from} <span className="text-muted-foreground">→</span> {l.to}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {l.mode_label} · <span className="sr-only">Estado: </span>{state}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );
}
