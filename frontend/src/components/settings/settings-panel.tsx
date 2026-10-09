"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, History, Link2, LoaderCircle, RefreshCw, Save, Search, Trash2 } from "lucide-react";

import { useApp } from "@/components/providers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client";
import type { AuditEntry, Settings, ShareLink } from "@/lib/types";
import { cn } from "@/lib/utils";

const ACTIONS: Record<string, string> = {
  INSERT: "Creación",
  UPDATE: "Edición",
  DELETE: "Borrado",
  CLOSE: "Cierre de vía",
  REOPEN: "Reapertura",
  EXPORT: "Enlace creado",
  REVOKE: "Enlace revocado",
  LOGIN: "Inicio de sesión",
};

const TABLES: Record<string, string> = {
  mm_shipments: "Envíos",
  mm_corridor_status: "Vías",
  system_params: "Parámetros",
  mm_share_links: "Enlaces",
};

function dt(iso: string | null) {
  return iso ? new Date(iso).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }) : "—";
}

/** "3.900,50" o "3900,5" (es-CO), "3.900" (miles) o "3900.50" -> número. */
function parseRate(raw: string): number {
  const v = raw.trim().replace(/\s/g, "");
  if (v.includes(",")) return Number(v.replace(/\./g, "").replace(",", "."));
  if (/^\d{1,3}(\.\d{3})+$/.test(v)) return Number(v.replace(/\./g, ""));
  return Number(v);
}

function today() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function SettingsPanel({ settings, links, history }: { settings: Settings; links: ShareLink[]; history: AuditEntry[] }) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="flex flex-col gap-6">
        <FxForm initial={settings.fx} />
        <ReplenishToggle initial={settings.auto_replenish} />
        <SharedLinks links={links} />
      </div>
      <AuditLog history={history} />
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="text-sm font-medium">{title}</h2>
      {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const input =
  "h-9 w-full rounded-md border border-input bg-white/[0.02] px-3 text-sm outline-none focus:border-neon-cyan/40";

function FxForm({ initial }: { initial: Settings["fx"] }) {
  const router = useRouter();
  const { operator, refreshFx } = useApp();
  const [rate, setRate] = useState(initial.rate ? String(initial.rate) : "");
  const [date, setDate] = useState(initial.date ?? today());
  const [source, setSource] = useState(initial.source ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api("/api/settings/fx", {
        method: "PUT",
        body: { rate: parseRate(rate), date, source, usuario: operator },
      });
      await refreshFx();
      setMsg({ ok: true, text: "TRM guardada. Toda la aplicación usa la nueva tasa." });
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      title="Tasa de cambio (TRM)"
      description="Pesos colombianos por dólar. Los costos se calculan en USD y se convierten con esta tasa en pantalla y en los PDF. No se consulta automáticamente: ingrésala con su fecha y fuente."
    >
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-[1fr_1fr]">
        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">COP por USD</span>
          <input className={cn(input, "tabular")} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)}
            placeholder="Ej. 3900,50" required />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">Fecha de vigencia</span>
          <input type="date" className={cn(input, "tabular")} value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs text-muted-foreground">Fuente</span>
          <input className={input} value={source} onChange={(e) => setSource(e.target.value)} maxLength={120}
            placeholder="Ej. Superintendencia Financiera, TRM del día" required />
        </label>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button type="submit" disabled={busy}>
            {busy ? <LoaderCircle className="animate-spin" /> : <Save />}
            Guardar TRM
          </Button>
          {initial.rate ? (
            <span className="text-xs text-muted-foreground">
              Vigente: {initial.rate.toLocaleString("es-CO")} COP/USD · {initial.date} · {initial.source}
            </span>
          ) : (
            <span className="text-xs text-neon-amber">Sin TRM: la app solo puede mostrar USD.</span>
          )}
        </div>
        {msg && <p className={cn("text-xs sm:col-span-2", msg.ok ? "text-neon-emerald" : "text-neon-rose")}>{msg.text}</p>}
      </form>
    </Section>
  );
}

function ReplenishToggle({ initial }: { initial: boolean }) {
  const router = useRouter();
  const { operator } = useApp();
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ auto_replenish: boolean }>("/api/settings/replenish", {
        method: "PUT",
        body: { enabled: !on, usuario: operator },
      });
      setOn(res.auto_replenish);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      title="Reposición automática de envíos"
      description="Si está activa, el sistema despacha envíos simulados cuando hay menos de 16 en tránsito. Desactívala para trabajar solo con los envíos que modeles (por ejemplo, después de borrar los de prueba)."
    >
      <div className="flex items-center gap-3">
        <button type="button" role="switch" aria-checked={on} onClick={toggle} disabled={busy}
          className={cn("relative h-6 w-11 rounded-full border transition-colors disabled:opacity-50",
            on ? "border-neon-cyan/40 bg-neon-cyan/30" : "border-white/10 bg-white/[0.06]")}>
          <span className={cn("absolute top-0.5 size-4.5 rounded-full bg-white transition-all", on ? "left-[22px]" : "left-0.5")} />
          <span className="sr-only">Reposición automática</span>
        </button>
        <span className="text-sm">{on ? "Activa" : "Desactivada"}</span>
        {busy && <LoaderCircle className="size-4 animate-spin text-muted-foreground" />}
      </div>
      {error && <p className="mt-2 text-xs text-neon-rose">{error}</p>}
    </Section>
  );
}

function SharedLinks({ links }: { links: ShareLink[] }) {
  const router = useRouter();
  const { operator } = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const active = links.filter((l) => !l.revoked_at);
  const revoked = links.length - active.length;

  async function revoke(token: string) {
    if (!window.confirm("¿Revocar el enlace? Quien lo tenga ya no podrá abrir el PDF.")) return;
    setBusy(token);
    setError(null);
    try {
      await api(`/api/exports/${token}?usuario=${encodeURIComponent(operator)}`, { method: "DELETE" });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function copy(l: ShareLink) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${l.path}`);
      setCopied(l.token);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError("El navegador no permitió copiar el enlace.");
    }
  }

  return (
    <Section
      title="Enlaces compartidos"
      description="PDF de solo lectura accesibles por enlace. Se generan con los datos vigentes cada vez que se abren."
    >
      {active.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No hay enlaces activos. Créalos desde un envío o desde la selección en{" "}
          <Link href="/envios" className="underline underline-offset-2">Envíos</Link>.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {active.map((l) => (
            <li key={l.token} className="flex flex-wrap items-center gap-3 py-2.5 text-xs">
              <Link2 className="size-3.5 text-neon-cyan" />
              <div className="min-w-0 flex-1">
                <div className="truncate">
                  {l.codes.length === 1 ? l.codes[0] : `${l.codes.length} envíos (${l.codes.slice(0, 3).join(", ")}${l.codes.length > 3 ? "…" : ""})`}
                  <Badge tone="neutral" className="ml-2">{l.currency}</Badge>
                </div>
                <div className="text-muted-foreground">{dt(l.created_at)} · {l.created_by}</div>
              </div>
              <a href={l.path} target="_blank" rel="noopener" className="text-neon-cyan hover:underline">Abrir</a>
              <button type="button" onClick={() => copy(l)} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
                {copied === l.token ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied === l.token ? "Copiado" : "Copiar"}
              </button>
              <Button variant="ghost" size="sm" className="h-7 text-neon-rose hover:text-neon-rose" disabled={busy === l.token} onClick={() => revoke(l.token)}>
                {busy === l.token ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
                Revocar
              </Button>
            </li>
          ))}
        </ul>
      )}
      {revoked > 0 && <p className="mt-2 text-[11px] text-muted-foreground">{revoked} enlace(s) revocado(s).</p>}
      {error && <p className="mt-2 text-xs text-neon-rose">{error}</p>}
    </Section>
  );
}

function AuditLog({ history }: { history: AuditEntry[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [table, setTable] = useState<string>("");
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return history.filter(
      (h) =>
        (!table || h.table_name === table) &&
        (!q || [h.username, h.record_id, h.detail].some((v) => v?.toLowerCase().includes(q))),
    );
  }, [history, query, table]);

  return (
    <section className="h-fit rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <History className="size-4 text-muted-foreground" /> Historial de cambios
        </h2>
        <Button variant="ghost" size="sm" onClick={() => router.refresh()}>
          <RefreshCw />
          Actualizar
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Quién cerró una vía, quién modificó un envío. El usuario es el nombre declarado en la barra lateral (sin autenticación).
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <label className="relative flex h-8 min-w-48 flex-1 items-center">
          <Search className="pointer-events-none absolute left-2.5 size-3.5 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar usuario, envío, vía…" aria-label="Buscar en el historial"
            className="h-8 w-full rounded-md border border-input bg-white/[0.02] pr-2 pl-8 text-xs outline-none focus:border-neon-cyan/40" />
        </label>
        <select value={table} onChange={(e) => setTable(e.target.value)} aria-label="Filtrar por tipo"
          className="h-8 rounded-md border border-input bg-white/[0.02] px-2 text-xs outline-none [&>option]:bg-[#0b0f19]">
          <option value="">Todo</option>
          {Object.entries(TABLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <ul className="mt-4 flex max-h-[720px] flex-col gap-2.5 overflow-y-auto pr-1 text-xs">
        {list.length === 0 && <li className="text-muted-foreground">Sin registros.</li>}
        {list.map((h) => (
          <li key={h.audit_id} className="border-l border-white/10 pl-3">
            <div className="flex flex-wrap items-center gap-x-2 text-muted-foreground">
              <span>{dt(h.timestamp)}</span>·<span className="text-foreground">{h.username}</span>·
              <span>{ACTIONS[h.action] ?? h.action}</span>
              {h.record_id && h.table_name === "mm_shipments" ? (
                <Link href={`/envios/${h.record_id}`} className="font-mono text-slate-300 hover:text-neon-cyan">{h.record_id}</Link>
              ) : (
                h.record_id && <span className="text-slate-300">{h.record_id}</span>
              )}
            </div>
            <div>{h.detail}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
