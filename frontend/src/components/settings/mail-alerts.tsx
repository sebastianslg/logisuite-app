"use client";

import { useCallback, useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";

import { openAuthModal } from "@/components/auth/login-dialog";
import { Button } from "@/components/ui/button";
import { CollapsiblePanel } from "@/components/ui/collapsible-panel";
import { toast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";

interface MailAlertsState {
  configured: boolean;
  /** Dirección del administrador, enmascarada (d***@gmail.com). */
  admin_email: string | null;
  alerts: { kind: string; label: string; enabled: boolean }[];
}

/**
 * Avisos por correo al administrador (ADMIN_EMAIL): cada tipo se enciende o apaga por separado. Cambiarlos exige sesión de
 * administrador (el servidor lo valida); sin ella se ven pero no se tocan. Cada correo que llega dice cómo dejar de
 * recibirlo y apunta aquí.
 */
export function MailAlerts() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [state, setState] = useState<MailAlertsState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setState(await api<MailAlertsState>("/api/settings/mail-alerts"));
    } catch {
      setState(null);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial del estado del servidor
    void load();
  }, [load]);

  async function toggle(kind: string, enabled: boolean) {
    setBusy(kind);
    try {
      setState(await api<MailAlertsState>("/api/settings/mail-alerts", { method: "PUT", body: { kind, enabled } }));
      toast({ title: enabled ? "Aviso activado" : "Aviso desactivado" });
    } catch (e) {
      toast({ title: "No se pudo cambiar", description: (e as Error).message, tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <CollapsiblePanel title="Avisos por correo">
      <p className="text-xs text-muted-foreground">
        Correos que la app te manda a ti, como administrador. Apaga los que no quieras recibir: cada correo también dice cómo
        hacerlo.
      </p>
      <div className="mt-4 flex flex-col gap-3">
        {state === null && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {state && !state.configured && (
          <p className="text-sm text-muted-foreground">El correo no está configurado en el servidor: no se envía ningún aviso.</p>
        )}
        {state && state.configured && (
          <>
            <p className="text-sm">
              {state.admin_email ? (
                <>
                  Los avisos llegan a <span className="font-mono text-xs">{state.admin_email}</span>.
                </>
              ) : (
                "No hay un correo de administrador definido (ADMIN_EMAIL): no se envía ningún aviso."
              )}
            </p>
            <ul className="rule-list">
              {state.alerts.map((a) => (
                <li key={a.kind} className="flex items-center gap-3 py-3">
                  <span className="min-w-0 flex-1 text-sm">{a.label}</span>
                  {busy === a.kind && <LoaderCircle className="size-4 animate-spin text-muted-foreground" aria-hidden />}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={a.enabled}
                    aria-label={a.label}
                    disabled={!isAdmin || busy !== null}
                    onClick={() => void toggle(a.kind, !a.enabled)}
                    className={cn(
                      "relative h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-50",
                      a.enabled ? "border-primary/40 bg-primary/30" : "border-border-strong bg-fill",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 left-0.5 size-4.5 rounded-full bg-white transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
                        a.enabled ? "translate-x-5" : "translate-x-0",
                      )}
                    />
                  </button>
                </li>
              ))}
            </ul>
            {!isAdmin && (
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span>Inicia sesión como administrador para cambiarlos.</span>
                <Button variant="secondary" size="sm" onClick={openAuthModal}>
                  Ingresar con código al correo
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </CollapsiblePanel>
  );
}
