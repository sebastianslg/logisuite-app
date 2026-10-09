"use client";

import { useState } from "react";
import { Check, Copy, Download, FileText, LoaderCircle, Share2 } from "lucide-react";

import { useApp } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { api, openBlob, saveBlob } from "@/lib/client";

/**
 * Exportación a PDF de uno o varios envíos:
 *  - Ver: abre el PDF en una pestaña.
 *  - Descargar: guarda el archivo.
 *  - Compartir: crea un enlace de solo lectura con token (revocable en
 *    Configuración) y lo copia al portapapeles.
 * El PDF usa la moneda elegida en la barra lateral.
 */
export function ExportActions({ codes, size = "sm" }: { codes: string[]; size?: "sm" | "default" }) {
  const { currency, operator } = useApp();
  const [busy, setBusy] = useState<"view" | "download" | "share" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const single = codes.length === 1;

  async function getPdf(download: boolean): Promise<Blob> {
    if (single) {
      return api<Blob>(
        `/api/shipments/${encodeURIComponent(codes[0])}/pdf?moneda=${currency}&descargar=${download}`,
      );
    }
    return api<Blob>(`/api/exports/pdf?descargar=${download}`, {
      method: "POST",
      body: { codes, moneda: currency },
    });
  }

  async function run(kind: "view" | "download" | "share") {
    setBusy(kind);
    setError(null);
    try {
      if (kind === "share") {
        const res = await api<{ token: string; path: string }>("/api/exports", {
          method: "POST",
          body: { codes, moneda: currency, usuario: operator },
        });
        const url = `${window.location.origin}${res.path}`;
        setLink(url);
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        } catch {
          /* sin permiso de portapapeles: el enlace queda visible para copiarlo */
        }
      } else {
        const blob = await getPdf(kind === "download");
        if (kind === "view") openBlob(blob);
        else saveBlob(blob, single ? `${codes[0]}.pdf` : `envios-${codes.length}.pdf`);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const icon = (kind: typeof busy, el: React.ReactNode) =>
    busy === kind ? <LoaderCircle className="animate-spin" /> : el;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size={size} disabled={!!busy || !codes.length} onClick={() => run("view")}>
          {icon("view", <FileText />)}
          {single ? "Ver PDF" : `Ver PDF (${codes.length})`}
        </Button>
        <Button variant="secondary" size={size} disabled={!!busy || !codes.length} onClick={() => run("download")}>
          {icon("download", <Download />)}
          Descargar
        </Button>
        <Button variant="secondary" size={size} disabled={!!busy || !codes.length} onClick={() => run("share")}>
          {icon("share", <Share2 />)}
          Compartir enlace
        </Button>
      </div>
      {link && (
        <div className="flex items-center gap-2 rounded-md border border-neon-cyan/20 bg-neon-cyan/[0.05] px-2.5 py-1.5 text-xs">
          <input
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Enlace para compartir"
            className="min-w-0 flex-1 bg-transparent font-mono text-[11px] text-slate-300 outline-none"
          />
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setCopied(true);
                setTimeout(() => setCopied(false), 2500);
              } catch {
                setError("El navegador no permitió copiar; selecciona el enlace y cópialo.");
              }
            }}
            className="flex items-center gap-1 text-neon-cyan hover:underline"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Copiado" : "Copiar"}
          </button>
        </div>
      )}
      {link && (
        <p className="text-[11px] text-muted-foreground">
          Cualquiera con el enlace puede ver el PDF (solo lectura). Revócalo en Configuración.
        </p>
      )}
      {error && <p className="text-xs text-neon-rose">{error}</p>}
    </div>
  );
}
