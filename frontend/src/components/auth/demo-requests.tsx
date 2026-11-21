"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Mail, Phone, RotateCcw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";

interface DemoRequest {
  request_id: number;
  created_at: string;
  name: string;
  company: string;
  email: string;
  phone: string | null;
  role: string | null;
  fleet_size: string | null;
  message: string | null;
  handled_at: string | null;
  handled_by: string | null;
}

const when = (iso: string) => new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });

/**
 * Solicitudes de demostración que llegan desde la presentación (/). Son datos personales de contacto: solo las ve un
 * administrador, que las marca como atendidas o las borra cuando ya no hacen falta.
 */
export function DemoRequests() {
  const [items, setItems] = useState<DemoRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setItems((await api<{ items: DemoRequest[] }>("/api/demo-requests")).items);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial (el panel solo se monta con sesión de administrador)
    void load();
  }, [load]);

  async function setHandled(r: DemoRequest, handled: boolean) {
    setBusy(r.request_id);
    try {
      await api(`/api/demo-requests/${r.request_id}/handled`, { method: "PUT", body: { handled } });
      await load();
    } catch (e) {
      toast({ title: "No se pudo cambiar", description: (e as Error).message, tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function remove(r: DemoRequest) {
    if (!window.confirm(`¿Borrar la solicitud de ${r.company}? Se borran también sus datos de contacto y no se puede deshacer.`)) return;
    setBusy(r.request_id);
    try {
      await api(`/api/demo-requests/${r.request_id}`, { method: "DELETE" });
      toast({ title: "Solicitud borrada", description: r.company });
      await load();
    } catch (e) {
      toast({ title: "No se pudo borrar", description: (e as Error).message, tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  const pending = (items ?? []).filter((r) => !r.handled_at).length;

  return (
    <section className="glass overflow-hidden rounded-3xl" aria-labelledby="demos-t">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-5 pb-3">
        <h2 id="demos-t" className="text-sm font-semibold">
          Solicitudes de demostración{" "}
          {items && <span className="tabular font-normal text-muted-foreground">· {pending === 1 ? "1 pendiente" : `${pending} pendientes`}</span>}
        </h2>
        <p className="text-xs text-muted-foreground">Llegan desde la presentación pública y avisan al buzón de Westvane.</p>
      </div>
      {error && (
        <p role="alert" className="px-5 pb-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {items && items.length === 0 && <p className="border-t border-border px-5 py-5 text-sm text-muted-foreground">Todavía no hay solicitudes.</p>}
      <ul className="list-in rule-list border-t border-border">
        {(items ?? []).map((r) => (
          <li key={r.request_id} className={cn("grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto]", r.handled_at && "opacity-70")}>
            <div className="min-w-0">
              <p className="font-semibold tracking-tight">
                {r.company}
                <span className="font-normal text-muted-foreground">
                  {" "}
                  · {r.name}
                  {r.role && `, ${r.role}`}
                </span>
              </p>
              <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1.5 text-primary hover:underline">
                  <Mail className="size-3.5" aria-hidden />
                  {r.email}
                </a>
                {r.phone && (
                  <a href={`tel:${r.phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1.5 text-primary hover:underline">
                    <Phone className="size-3.5" aria-hidden />
                    {r.phone}
                  </a>
                )}
                {r.fleet_size && <span className="text-muted-foreground">{r.fleet_size}</span>}
              </p>
              {r.message && <p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-muted-foreground">{r.message}</p>}
              <p className="tabular mt-2 text-xs text-muted-foreground">
                {when(r.created_at)}
                {r.handled_at && ` · atendida ${when(r.handled_at)}${r.handled_by ? ` por ${r.handled_by}` : ""}`}
              </p>
            </div>
            <div className="flex items-start gap-2">
              {r.handled_at ? (
                <Button variant="ghost" size="sm" disabled={busy === r.request_id} onClick={() => setHandled(r, false)}>
                  <RotateCcw /> Pendiente
                </Button>
              ) : (
                <Button variant="secondary" size="sm" disabled={busy === r.request_id} onClick={() => setHandled(r, true)}>
                  <Check /> Atendida
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Borrar la solicitud de ${r.company}`}
                className="text-destructive hover:text-destructive"
                disabled={busy === r.request_id}
                onClick={() => remove(r)}
              >
                <Trash2 />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
