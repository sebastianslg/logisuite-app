"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";

import { openAuthModal } from "@/components/auth/login-dialog";
import { Button } from "@/components/ui/button";
import { CollapsiblePanel } from "@/components/ui/collapsible-panel";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";

interface Status {
  now: string;
  uptime_s: number;
  disk: { total: number; used: number; free: number; used_pct: number };
  memory: { total: number; available: number; used_pct: number } | null;
  load: { "1": number; "5": number; "15": number; cores: number } | null;
  database_bytes: number | null;
  attachments_bytes: number | null;
  counts: { shipments: number; users_active: number; audit: number };
  mail_configured: boolean;
  warnings: string[];
}

const fmtBytes = (n: number | null | undefined) => {
  if (n == null) return "—";
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toLocaleString("es-CO", { maximumFractionDigits: 1 })} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toLocaleString("es-CO", { maximumFractionDigits: 1 })} MB`;
  return `${Math.max(1, Math.round(n / 1024)).toLocaleString("es-CO")} KB`;
};

function fmtUptime(s: number) {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d ? `${d} d ${h} h` : h ? `${h} h ${m} min` : `${m} min`;
}

/** Barra de uso: crece con scaleX (no con el ancho) y se pone naranja o roja cuando el uso preocupa. */
function Meter({ label, value, detail }: { label: string; value: number; detail: string }) {
  const tone = value >= 90 ? "bg-destructive" : value >= 75 ? "bg-warning" : "bg-[var(--accent-solid)]";
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span>{label}</span>
        <span className="tabular text-xs text-muted-foreground">{detail}</span>
      </div>
      <div className="mt-1.5 h-2 rounded-full bg-fill" role="meter" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
        <div className={cn("meter-fill h-full rounded-full", tone)} style={{ "--v": Math.min(Math.max(value, 0), 100) / 100 } as React.CSSProperties} />
      </div>
    </div>
  );
}

/**
 * Estado del servidor visto desde la API (disco, memoria, carga, tamaños). Solo para administradores: el servidor
 * responde 401 o 403 al resto y aquí se explica. Lo que vive fuera del contenedor (los respaldos) sigue en estado.sh.
 */
export function ServerStatus() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setStatus(await api<Status>("/api/system/status"));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial al tener sesión de administrador
      void load();
    }
  }, [isAdmin, load]);

  return (
    <CollapsiblePanel title="Estado del servidor">
      {!isAdmin ? (
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>Disco, memoria y carga del servidor. Solo para administradores.</span>
          <Button variant="secondary" size="sm" onClick={openAuthModal}>
            Ingresar con código al correo
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {status && (
            <>
              {status.warnings.length > 0 && (
                <ul className="flex flex-col gap-1.5 rounded-2xl bg-warning/10 px-4 py-3 text-sm text-warning" role="status">
                  {status.warnings.map((w) => (
                    <li key={w} className="flex items-start gap-2">
                      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                      {w}
                    </li>
                  ))}
                </ul>
              )}
              <Meter label="Disco" value={status.disk.used_pct} detail={`${fmtBytes(status.disk.used)} de ${fmtBytes(status.disk.total)} · libres ${fmtBytes(status.disk.free)}`} />
              {status.memory && (
                <Meter label="Memoria" value={status.memory.used_pct} detail={`${fmtBytes(status.memory.total - status.memory.available)} de ${fmtBytes(status.memory.total)}`} />
              )}
              <dl className="tabular grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                <Fact k="En marcha hace" v={fmtUptime(status.uptime_s)} />
                {status.load && <Fact k="Carga (5 min)" v={`${status.load["5"]} de ${status.load.cores} núcleos`} />}
                <Fact k="Base de datos" v={fmtBytes(status.database_bytes)} />
                <Fact k="Adjuntos" v={fmtBytes(status.attachments_bytes)} />
                <Fact k="Envíos" v={status.counts.shipments.toLocaleString("es-CO")} />
                <Fact k="Correo" v={status.mail_configured ? "Configurado" : "Sin configurar"} />
              </dl>
            </>
          )}
          <div>
            <Button variant="ghost" size="sm" onClick={() => void load()} disabled={busy}>
              <RefreshCw className={busy ? "animate-spin" : undefined} /> Actualizar
            </Button>
          </div>
        </div>
      )}
    </CollapsiblePanel>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className="mt-0.5 font-medium">{v}</dd>
    </div>
  );
}
