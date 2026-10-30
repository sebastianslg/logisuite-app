"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2, Mail, Trash2 } from "lucide-react";

import { useApp } from "@/components/providers";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/client";

type Link = { token: string; path: string; created_at: string; created_by: string | null };

/**
 * Seguimiento para el cliente: enlaces públicos de solo lectura (estado, avance, llegada estimada y recorrido; sin
 * costos ni datos internos). Se crean, copian y revocan desde aquí; revocar apaga el enlace al instante.
 */
export function TrackingLinks({ code }: { code: string }) {
  const { operator } = useApp();
  const base = `/api/shipments/${encodeURIComponent(code)}/tracking`;
  const [links, setLinks] = useState<Link[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const { user } = useAuth();
  const canEmail = user?.role === "admin" || user?.role === "operador"; // el servidor también lo exige
  const [mailing, setMailing] = useState<string | null>(null); // token del enlace con el formulario de correo abierto
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api<{ items: Link[] }>(base).then((r) => setLinks(r.items)).catch(() => setLinks([]));
  }, [base]);

  const url = (l: Link) => `${window.location.origin}${l.path}`;

  async function create() {
    setBusy(true);
    try {
      const l = await api<Link>(`${base}?usuario=${encodeURIComponent(operator)}`, { method: "POST" });
      setLinks((x) => [{ ...l, created_at: new Date().toISOString(), created_by: operator || null }, ...(x ?? [])]);
      await copy(l);
    } catch (e) {
      toast({ title: "No se pudo crear el enlace", description: (e as Error).message, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function copy(l: Link) {
    try {
      await navigator.clipboard.writeText(url(l));
      setCopied(l.token);
      toast({ title: "Enlace copiado", description: "Compártelo con tu cliente." });
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast({ title: "No se pudo copiar", description: url(l), tone: "error" });
    }
  }

  async function sendMail(l: Link, e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      const r = await api<{ to: string }>(`${base}/${l.token}/email`, { method: "POST", body: { email: email.trim() } });
      toast({ title: "Correo enviado", description: `El enlace salió hacia ${r.to}.` });
      setMailing(null);
      setEmail("");
    } catch (err) {
      toast({ title: "No se pudo enviar", description: (err as Error).message, tone: "error" });
    } finally {
      setSending(false);
    }
  }

  async function revoke(l: Link) {
    if (!window.confirm("¿Revocar este enlace? Quien lo tenga dejará de ver el envío.")) return;
    try {
      await api(`${base}/${l.token}?usuario=${encodeURIComponent(operator)}`, { method: "DELETE" });
      setLinks((x) => (x ?? []).filter((i) => i.token !== l.token));
    } catch (e) {
      toast({ title: "No se pudo revocar", description: (e as Error).message, tone: "error" });
    }
  }

  return (
    <div className="text-sm">
      <p className="text-xs text-muted-foreground">
        Un enlace de solo lectura con estado, avance, llegada estimada y recorrido. No muestra costos, cliente ni notas.
      </p>
      {links && links.length > 0 && (
        <ul className="rule-list mt-3">
          {links.map((l) => (
            <li key={l.token} className="flex flex-wrap items-center gap-2 py-2">
              <Link2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <a href={l.path} target="_blank" rel="noopener" className="min-w-0 flex-1 truncate font-mono text-xs hover:underline">
                …{l.path.slice(-14)}
              </a>
              <span className="tabular hidden text-xs text-muted-foreground sm:inline">{new Date(l.created_at).toLocaleDateString("es-CO")}</span>
              <Button variant="ghost" size="icon" className="size-8" onClick={() => copy(l)} aria-label="Copiar enlace" title="Copiar">
                {copied === l.token ? <Check /> : <Copy />}
              </Button>
              {canEmail && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => setMailing(mailing === l.token ? null : l.token)}
                  aria-label="Enviar enlace por correo"
                  aria-expanded={mailing === l.token}
                  title="Enviar por correo"
                >
                  <Mail />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="size-8 hover:text-destructive" onClick={() => revoke(l)} aria-label="Revocar enlace" title="Revocar">
                <Trash2 />
              </Button>
              {mailing === l.token && (
                <form onSubmit={(e) => void sendMail(l, e)} className="flex w-full items-center gap-2 pt-1 print:hidden">
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="correo del cliente"
                    aria-label="Correo del cliente"
                    autoComplete="off"
                    className="field h-9 min-w-0 flex-1 px-3 text-sm outline-none"
                  />
                  <Button type="submit" size="sm" disabled={sending || !email.trim()}>
                    {sending ? "Enviando…" : "Enviar"}
                  </Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
      <Button variant="secondary" size="sm" className="mt-3 print:hidden" onClick={create} disabled={busy}>
        <Link2 /> Crear enlace de seguimiento
      </Button>
      {links && links.length > 0 && !canEmail && (
        <p className="mt-2 text-xs text-muted-foreground print:hidden">Inicia sesión como operador para enviar el enlace por correo.</p>
      )}
    </div>
  );
}
