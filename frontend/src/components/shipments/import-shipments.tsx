"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleAlert, CircleCheck, Download, FileUp, LoaderCircle, RotateCcw } from "lucide-react";

import { Money } from "@/components/money";
import { useApp } from "@/components/providers";
import { ModeChain } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { api, saveBlob } from "@/lib/client";
import { CHECK_THIRD_PARTY, recordConsent } from "@/lib/consent";
import type { ImportResult } from "@/lib/types";
import { cn } from "@/lib/utils";

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(file);
  });
}

const when = (iso: string) => new Date(iso).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }).replace(/\s/g, " ");

/**
 * Carga masiva de envíos desde Excel o CSV en dos pasos: primero una vista previa (cada fila con la ruta que
 * tendría, o el motivo por el que no se puede crear) y después la confirmación, que crea solo las filas válidas.
 */
export function ImportShipments({ onDone }: { onDone?: () => void }) {
  const router = useRouter();
  const { operator } = useApp();
  const [file, setFile] = useState<{ name: string; b64: string } | null>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [done, setDone] = useState<ImportResult | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function choose(f: File | undefined) {
    if (!f) return;
    setError(null);
    setPreview(null);
    setDone(null);
    setBusy(true);
    try {
      const b64 = await toBase64(f);
      setFile({ name: f.name, b64 });
      setPreview(await api<ImportResult>("/api/shipments/import", { method: "POST", body: { filename: f.name, content_b64: b64 } }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!file || !authorized) return;
    setBusy(true);
    setError(null);
    try {
      // La declaración queda en el registro de aceptaciones antes de guardar los envíos
      await recordConsent([{ document: "autorizacion_terceros", text: CHECK_THIRD_PARTY }], "importacion", operator);
      const r = await api<ImportResult>("/api/shipments/import", {
        method: "POST",
        body: { filename: file.name, content_b64: file.b64, commit: true, usuario: operator, autorizado: true },
      });
      setDone(r);
      setPreview(null);
      toast({ title: `${r.created.length} ${r.created.length === 1 ? "envío creado" : "envíos creados"}`, description: file.name });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setDone(null);
    setError(null);
    if (input.current) input.current.value = "";
  }

  if (done)
    return (
      <div className="flex flex-col gap-4">
        <p className="flex items-start gap-2.5 text-sm">
          <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
          <span>
            Se crearon <strong className="tabular">{done.created.length}</strong> envíos desde {file?.name}
            {done.errors > 0 && `; ${done.errors} ${done.errors === 1 ? "fila quedó" : "filas quedaron"} fuera por error`}.
          </span>
        </p>
        <ul className="rule-list rounded-2xl border border-border text-sm">
          {done.results.filter((r) => r.ok && r.code).map((r) => (
            <li key={r.row} className="flex items-center justify-between gap-3 px-4 py-2.5">
              {r.ok && (
                <>
                  <Link href={`/envios/${r.code}`} onClick={onDone} className="font-mono text-xs hover:text-primary">
                    {r.code}
                  </Link>
                  <span className="truncate text-muted-foreground">
                    {r.origin} → {r.destination}
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={reset}>
            <RotateCcw /> Cargar otro archivo
          </Button>
          <Button variant="ghost" onClick={onDone}>
            Listo
          </Button>
        </div>
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          choose(e.dataTransfer.files[0]);
        }}
        className={cn(
          "flex flex-col items-center gap-2 rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground transition-colors duration-200",
          over ? "border-primary bg-primary/[0.04] text-foreground" : "border-border-strong",
        )}
      >
        {busy ? <LoaderCircle className="size-6 animate-spin" aria-hidden /> : <FileUp className="size-6" aria-hidden />}
        <span>
          {file ? <span className="font-medium text-foreground">{file.name}</span> : "Arrastra aquí un Excel o CSV, o"}{" "}
          <button type="button" onClick={() => input.current?.click()} className="font-medium text-primary underline-offset-2 hover:underline">
            {file ? "elige otro" : "elige un archivo"}
          </button>
        </span>
        <span className="text-xs">Columnas: origen, destino, carga, cliente, peso_t, salida · opcionales: prioridad, retraso_h, modos, vias</span>
        <input
          ref={input}
          type="file"
          accept=".xlsx,.csv"
          className="sr-only"
          aria-label="Archivo de envíos"
          onChange={(e) => choose(e.target.files?.[0])}
        />
      </div>
      <button
        type="button"
        onClick={async () => {
          try {
            saveBlob(await api<Blob>("/api/shipments/import/template"), "plantilla-envios-westvane.xlsx");
          } catch (e) {
            setError((e as Error).message);
          }
        }}
        className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-primary hover:underline"
      >
        <Download className="size-4" aria-hidden /> Descargar la plantilla de Excel
      </button>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {preview && (
        <>
          <p className="text-sm">
            <strong className="tabular">{preview.valid}</strong> de <span className="tabular">{preview.rows}</span> filas se pueden crear
            {preview.errors > 0 && (
              <>
                {" "}
                · <span className="text-destructive">{preview.errors} con error</span>
              </>
            )}
            . Nada se ha guardado todavía.
          </p>
          <ul className="rule-list max-h-[46dvh] overflow-y-auto rounded-2xl border border-border text-sm">
            {preview.results.map((r) => (
              <li key={r.row} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3 px-4 py-2.5">
                <span className="tabular pt-0.5 text-xs text-muted-foreground">Fila {r.row}</span>
                {r.ok ? (
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-medium">
                        {r.origin} → {r.destination}
                      </span>
                      <ModeChain modes={r.modes} />
                    </div>
                    <div className="tabular text-xs text-muted-foreground">
                      {r.cargo} · {r.client} · {r.weight_t.toLocaleString("es-CO")} t · sale {when(r.departure_at)} · {r.time_fmt} ·{" "}
                      <Money usd={r.cost} />
                    </div>
                  </div>
                ) : (
                  <p className="flex items-start gap-1.5 text-destructive">
                    <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    {r.error}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={authorized} onChange={(e) => setAuthorized(e.target.checked)} className="mt-0.5" />
            <span>{CHECK_THIRD_PARTY}</span>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={confirm} disabled={busy || preview.valid === 0 || !authorized}>
              {busy ? <LoaderCircle className="animate-spin" /> : <CircleCheck />}
              Crear {preview.valid} {preview.valid === 1 ? "envío" : "envíos"}
            </Button>
            <Button variant="ghost" onClick={reset} disabled={busy}>
              Cancelar
            </Button>
            <span className="text-xs text-muted-foreground">
              Firmará: <span className="text-foreground">{operator || "anónimo"}</span>
            </span>
          </div>
        </>
      )}
    </div>
  );
}
