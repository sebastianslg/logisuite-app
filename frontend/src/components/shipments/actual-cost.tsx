"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Money } from "@/components/money";
import { useApp } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/client";
import type { Shipment } from "@/lib/types";
import { cn } from "@/lib/utils";

/** "1.234,56" o "1234,5" (es-CO), "1.234" (miles) o "1234.56" -> número. */
function parseAmount(raw: string): number {
  const v = raw.trim().replace(/\s/g, "");
  if (v.includes(",")) return Number(v.replace(/\./g, "").replace(",", "."));
  if (/^\d{1,3}(\.\d{3})+$/.test(v)) return Number(v.replace(/\./g, ""));
  return Number(v);
}

/**
 * Costo real del envío: lo que de verdad costó según las facturas, frente al costo que estimó el motor. Se
 * registra en la moneda que está en pantalla (en COP se convierte con la TRM vigente) y queda en el historial.
 */
export function ActualCost({ shipment: s }: { shipment: Shipment }) {
  const router = useRouter();
  const { currency, operator } = useApp();
  const actual = s.actual_cost ?? null;
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState(actual?.note ?? "");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const n = parseAmount(amount);
    if (!Number.isFinite(n) || n <= 0) {
      toast({ title: "Escribe un valor mayor que cero", tone: "error" });
      return;
    }
    setBusy(true);
    try {
      await api(`/api/shipments/${encodeURIComponent(s.code)}/actual-cost`, {
        method: "PUT",
        body: { amount: n, moneda: currency, note: note.trim() || null, usuario: operator },
      });
      toast({ title: "Costo real registrado" });
      setEditing(false);
      router.refresh();
    } catch (err) {
      toast({ title: "No se pudo registrar", description: (err as Error).message, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    if (!window.confirm("¿Borrar el costo real registrado?")) return;
    try {
      await api(`/api/shipments/${encodeURIComponent(s.code)}/actual-cost`, { method: "PUT", body: { amount: null, usuario: operator } });
      router.refresh();
    } catch (err) {
      toast({ title: "No se pudo borrar", description: (err as Error).message, tone: "error" });
    }
  }

  if (editing || !actual) {
    if (!editing && !actual) {
      return (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-muted-foreground">
            Estimado <Money usd={s.cost} />. Registra lo que de verdad costó para comparar.
          </p>
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)} className="print:hidden">
            Registrar costo real
          </Button>
        </div>
      );
    }
    return (
      <form onSubmit={save} className="grid gap-3 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">Costo real ({currency})</span>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" required autoFocus className="field tabular h-10 w-full px-3" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">Nota (factura, proveedor)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className="field h-10 w-full px-3" />
        </label>
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" size="sm" disabled={busy}>
            Guardar
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
            Cancelar
          </Button>
        </div>
      </form>
    );
  }

  const v = actual.variance_pct;
  return (
    <div className="text-sm">
      <dl className="grid grid-cols-3 gap-3">
        <div>
          <dt className="text-xs text-muted-foreground">Estimado</dt>
          <dd className="tabular font-medium"><Money usd={s.cost} /></dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Real</dt>
          <dd className="tabular font-medium"><Money usd={actual.amount} /></dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Desviación</dt>
          <dd className={cn("tabular font-medium", v === null ? "" : v > 5 ? "text-destructive" : v < -5 ? "text-success" : "")}>
            {v === null ? "—" : `${v > 0 ? "+" : ""}${v.toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`}
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">
        {actual.note ? `${actual.note} · ` : ""}
        {actual.by ?? "anónimo"}
        {actual.at ? ` · ${new Date(actual.at).toLocaleDateString("es-CO")}` : ""}
      </p>
      <div className="mt-3 flex gap-2 print:hidden">
        <Button variant="secondary" size="sm" onClick={() => { setAmount(""); setEditing(true); }}>
          Cambiar
        </Button>
        <Button variant="ghost" size="sm" onClick={clear} className="text-muted-foreground">
          Borrar
        </Button>
      </div>
    </div>
  );
}
