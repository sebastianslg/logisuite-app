"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Download, FileDown, Upload } from "lucide-react";

import { useApp } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { SaveIcon, useSavedFlash } from "@/components/ui/save-icon";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/client";
import type { Toll } from "@/lib/types";

const input =
  "h-8 field px-2 text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/80";

export function TollsPanel({ tolls }: { tolls: Toll[] }) {
  const router = useRouter();
  const { operator } = useApp();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tolls;
    return tolls.filter((t) =>
      [t.corridor, t.origin, t.destination].some((v) => v.toLowerCase().includes(q)),
    );
  }, [tolls, query]);

  const sinTarifa = tolls.filter((t) => !t.tolls_cop).length;

  async function importFile(file: File) {
    setBusy(true);
    setMsg(null);
    try {
      const content_b64 = await toBase64(file);
      const res = await api<{ actualizados: number; errores: { fila: number; error: string }[] }>(
        "/api/tolls/import",
        { method: "POST", body: { filename: file.name, content_b64, usuario: operator } },
      );
      const errores = res.errores.length
        ? ` ${res.errores.length} fila(s) con error: ${res.errores.slice(0, 3).map((e) => `fila ${e.fila} (${e.error})`).join("; ")}.`
        : "";
      setMsg({ ok: res.errores.length === 0, text: `Se actualizaron ${res.actualizados} tramos.${errores}` });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="glass mt-6 rounded-3xl p-5">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Peajes por tramo terrestre</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Valor en pesos que paga un despacho por cada tramo. {sinTarifa} de {tolls.length} tramos aún sin tarifa cargada (en 0).
            Los valores se pueden editar aquí o cargar desde Excel o CSV con las columnas <code>link_id</code> y <code>peaje_cop</code>
            (opcionales: <code>nota</code>, <code>fuente</code>).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/api/tolls/export" download>
            <Button variant="outline" size="sm" type="button" burst={FileDown}>
              <Download />
              Exportar CSV
            </Button>
          </a>
          <label className="inline-flex cursor-pointer">
            <input
              type="file"
              accept=".csv,.xlsx"
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) importFile(f);
              }}
            />
            <span className="inline-flex h-8 items-center gap-2 rounded-md border border-border-strong px-3 text-xs font-medium hover:bg-fill">
              <Upload className="size-3.5" />
              {busy ? "Cargando…" : "Cargar Excel o CSV"}
            </span>
          </label>
        </div>
      </header>

      {msg && (
        <p className={`mb-3 text-xs ${msg.ok ? "text-success" : "text-destructive"}`} role="status">
          {msg.text}
        </p>
      )}

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filtrar por corredor o ciudad"
        className={`${input} mb-3 w-full max-w-sm`}
        aria-label="Filtrar peajes"
      />

      <div className="max-h-[520px] overflow-auto rounded-md border border-border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-background text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Corredor</th>
              <th className="px-3 py-2 font-medium">Tramo</th>
              <th className="px-3 py-2 text-right font-medium">Km</th>
              <th className="px-3 py-2 font-medium">Peaje (COP)</th>
              <th className="px-3 py-2 font-medium">Nota</th>
              <th className="px-3 py-2 font-medium">Fuente</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {visible.map((t) => (
              <TollRow key={t.link_id} toll={t} operator={operator} onSaved={() => router.refresh()} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TollRow({ toll: t, operator, onSaved }: { toll: Toll; operator: string; onSaved: () => void }) {
  const [value, setValue] = useState(String(t.tolls_cop ?? 0));
  const [note, setNote] = useState(t.tolls_note ?? "");
  const [source, setSource] = useState(t.tolls_source ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, flashDone] = useSavedFlash();
  const changed =
    Number(value) !== t.tolls_cop || note !== (t.tolls_note ?? "") || source !== (t.tolls_source ?? "");

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/tolls/${t.link_id}`, {
        method: "PUT",
        body: { tolls_cop: Number(value) || 0, note: note || null, source: source || null, usuario: operator },
      });
      flashDone();
      toast({ title: "Peaje guardado" });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="border-t border-border align-top">
      <td className="px-3 py-2">{t.corridor}</td>
      <td className="px-3 py-2">{t.origin} → {t.destination}</td>
      <td className="tabular px-3 py-2 text-right">{t.distance_km.toFixed(0)}</td>
      <td className="px-3 py-2">
        <input
          type="number"
          min={0}
          step={100}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={`${input} tabular w-28`}
          aria-label={`Peaje de ${t.origin} a ${t.destination}`}
        />
      </td>
      <td className="px-3 py-2">
        <input value={note} onChange={(e) => setNote(e.target.value)} className={`${input} w-44`} aria-label="Nota" />
      </td>
      <td className="px-3 py-2">
        <input value={source} onChange={(e) => setSource(e.target.value)} className={`${input} w-32`} aria-label="Fuente" />
      </td>
      <td className="px-3 py-2">
        <Button size="sm" variant={changed ? "default" : "ghost"} disabled={!changed || busy} onClick={save} type="button" burst={Check}>
          <SaveIcon state={done ? "done" : busy ? "busy" : "idle"} />
          Guardar
        </Button>
        {error && <p className="mt-1 text-destructive">{error}</p>}
      </td>
    </tr>
  );
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(file);
  });
}
