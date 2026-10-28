"use client";

import { useRef, useState } from "react";
import { Download, FileImage, FileSpreadsheet, FileText, LoaderCircle, Paperclip, Trash2, Upload } from "lucide-react";

import { useApp } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/client";
import type { Attachment } from "@/lib/types";
import { cn } from "@/lib/utils";

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.csv,.txt,.xlsx,.docx";
const MAX = 10 * 1024 * 1024;

function size(b: number) {
  return b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toLocaleString("es-CO", { maximumFractionDigits: 1 })} MB`;
}

function icon(type: string) {
  if (type.startsWith("image/")) return <FileImage />;
  if (type.includes("spreadsheet") || type === "text/csv") return <FileSpreadsheet />;
  return <FileText />;
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(file);
  });
}

/**
 * Documentos del envío (remesa, manifiesto, fotos de entrega). Se arrastran a la zona o se eligen; cada uno
 * se abre en una pestaña nueva o se descarga. PDF, imágenes, Excel, Word, CSV o texto hasta 10 MB.
 */
export function ShipmentAttachments({ code, initial }: { code: string; initial: Attachment[] }) {
  const { operator } = useApp();
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const base = `/api/shipments/${encodeURIComponent(code)}/attachments`;

  async function upload(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;
    setBusy(true);
    let ok = 0;
    for (const f of list) {
      if (f.size > MAX) {
        toast({ title: `${f.name} pasa de 10 MB`, tone: "error" });
        continue;
      }
      try {
        const created = await api<Attachment>(base, {
          method: "POST",
          body: { filename: f.name, content_b64: await toBase64(f), usuario: operator },
        });
        setItems((x) => [created, ...x]);
        ok++;
      } catch (e) {
        toast({ title: `No se pudo adjuntar ${f.name}`, description: (e as Error).message, tone: "error" });
      }
    }
    setBusy(false);
    if (ok) toast({ title: ok === 1 ? "Documento adjuntado" : `${ok} documentos adjuntados` });
    if (input.current) input.current.value = "";
  }

  async function remove(a: Attachment) {
    if (!window.confirm(`¿Borrar ${a.filename}?`)) return;
    try {
      await api(`${base}/${a.attachment_id}?usuario=${encodeURIComponent(operator)}`, { method: "DELETE" });
      setItems((x) => x.filter((i) => i.attachment_id !== a.attachment_id));
    } catch (e) {
      toast({ title: "No se pudo borrar", description: (e as Error).message, tone: "error" });
    }
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          upload(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center gap-2 rounded-2xl border border-dashed px-4 py-5 text-center text-xs text-muted-foreground transition-colors duration-200 print:hidden",
          over ? "border-primary bg-primary/[0.04] text-foreground" : "border-border-strong",
        )}
      >
        {busy ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : <Upload className="size-5" aria-hidden />}
        <span>
          Arrastra aquí la remesa, el manifiesto o fotos de la entrega, o{" "}
          <button type="button" onClick={() => input.current?.click()} className="font-medium text-primary underline-offset-2 hover:underline">
            elige archivos
          </button>
        </span>
        <span className="text-[11px]">PDF, imagen, Excel, Word, CSV o texto · hasta 10 MB</span>
        <input ref={input} type="file" multiple accept={ACCEPT} className="sr-only" onChange={(e) => e.target.files && upload(e.target.files)} aria-label="Adjuntar documentos" />
      </div>

      {items.length > 0 ? (
        <ul className="rule-list -mx-5 mt-4 -mb-5 border-t border-border">
          {items.map((a) => (
            <li key={a.attachment_id} className="group/att flex items-center gap-3 px-5 py-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-fill text-muted-foreground [&_svg]:size-4" aria-hidden>
                {icon(a.content_type)}
              </span>
              <div className="min-w-0 flex-1">
                <a href={`${base}/${a.attachment_id}`} target="_blank" rel="noopener" className="block truncate text-sm font-medium hover:text-primary">
                  {a.filename}
                </a>
                <div className="tabular text-xs text-muted-foreground">
                  {size(a.size_bytes)} · {a.created_by} · {new Date(a.created_at).toLocaleDateString("es-CO")}
                </div>
              </div>
              <Button variant="ghost" size="icon" className="size-8 print:hidden" asChild>
                <a href={`${base}/${a.attachment_id}?descargar=true`} aria-label={`Descargar ${a.filename}`} title="Descargar">
                  <Download />
                </a>
              </Button>
              <Button variant="ghost" size="icon" className="size-8 hover:text-destructive print:hidden" onClick={() => remove(a)} aria-label={`Borrar ${a.filename}`} title="Borrar">
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Paperclip className="size-3.5" aria-hidden /> Sin documentos adjuntos.
        </p>
      )}
    </div>
  );
}
