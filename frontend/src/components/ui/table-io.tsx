"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, CircleCheck, Download, FileUp, LoaderCircle, RotateCcw, Sheet as SheetIcon } from "lucide-react";

import { useApp } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";
import { api, saveBlob } from "@/lib/client";
import { CHECK_THIRD_PARTY, recordConsent } from "@/lib/consent";
import { cn } from "@/lib/utils";

export type TableKind = "vehiculos" | "conductores" | "inventario";

interface TableImport {
  rows: number;
  valid: number;
  errors: number;
  created: number;
  results: ({ row: number; ok: true; label: string } | { row: number; ok: false; error: string })[];
}

const COPY: Record<TableKind, { noun: string; title: string; columns: string; personal: boolean }> = {
  vehiculos: {
    noun: "vehículos",
    title: "Cargar vehículos",
    columns: "placa, modo, tipo · opcionales: marca, modelo, anio, capacidad_t, bodega, conductor, soat_vence, rtm_vence…",
    personal: false,
  },
  conductores: {
    noun: "conductores",
    title: "Cargar conductores",
    columns: "nombre, categoria, licencia_vence · opcional: estado",
    personal: true,
  },
  inventario: {
    noun: "productos",
    title: "Cargar inventario",
    columns: "bodega (código), sku, nombre · opcionales: categoria, unidad, cantidad, minimo, maximo, volumen_m3, peso_kg, costo_usd, zona",
    personal: false,
  },
};

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(file);
  });
}

/**
 * Exportar a Excel y cargar desde Excel o CSV una tabla de la flota o de las bodegas. La carga es en dos pasos, como la de
 * envíos: vista previa de cada fila (o el motivo del error) y, al confirmar, se crean solo las válidas. Los conductores son
 * datos personales: guardar exige la declaración de autorización, que queda en el registro de aceptaciones.
 */
export function TableIO({ kind }: { kind: TableKind }) {
  const copy = COPY[kind];
  const router = useRouter();
  const { operator } = useApp();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<{ name: string; b64: string } | null>(null);
  const [preview, setPreview] = useState<TableImport | null>(null);
  const [done, setDone] = useState<TableImport | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const base = `/api/tables/${kind}`;

  function reset() {
    setFile(null);
    setPreview(null);
    setDone(null);
    setError(null);
    setAuthorized(false);
    if (input.current) input.current.value = "";
  }

  async function download(path: string, name: string) {
    try {
      saveBlob(await api<Blob>(path), name);
    } catch (e) {
      toast({ title: "No se pudo descargar", description: (e as Error).message, tone: "error" });
    }
  }

  async function choose(f: File | undefined) {
    if (!f) return;
    setError(null);
    setPreview(null);
    setDone(null);
    setBusy(true);
    try {
      const b64 = await toBase64(f);
      setFile({ name: f.name, b64 });
      setPreview(await api<TableImport>(`${base}/import`, { method: "POST", body: { filename: f.name, content_b64: b64 } }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!file || (copy.personal && !authorized)) return;
    setBusy(true);
    setError(null);
    try {
      if (copy.personal) await recordConsent([{ document: "autorizacion_terceros", text: CHECK_THIRD_PARTY }], "importacion", operator);
      const r = await api<TableImport>(`${base}/import`, {
        method: "POST",
        body: { filename: file.name, content_b64: file.b64, commit: true, usuario: operator, autorizado: copy.personal },
      });
      setDone(r);
      setPreview(null);
      toast({ title: `${r.created} ${copy.noun} creados`, description: file.name });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => download(`${base}/export.xlsx`, `${kind}.xlsx`)}>
        <Download /> Excel
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        <FileUp /> Cargar
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={copy.title} description="Desde un Excel o CSV: primero una vista previa, luego se crean">
        <div className="flex flex-col gap-4">
          {done ? (
            <>
              <p className="flex items-start gap-2.5 text-sm">
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                <span>
                  Se crearon <strong className="tabular">{done.created}</strong> {copy.noun} desde {file?.name}
                  {done.errors > 0 && `; ${done.errors} ${done.errors === 1 ? "fila quedó" : "filas quedaron"} fuera por error`}.
                </span>
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={reset}>
                  <RotateCcw /> Cargar otro archivo
                </Button>
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Listo
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border-strong px-4 py-8 text-center text-sm text-muted-foreground">
                {busy ? <LoaderCircle className="size-6 animate-spin" aria-hidden /> : <SheetIcon className="size-6" aria-hidden />}
                <span>
                  {file ? <span className="font-medium text-foreground">{file.name}</span> : "Elige un Excel o CSV"}{" "}
                  <button type="button" onClick={() => input.current?.click()} className="font-medium text-primary underline-offset-2 hover:underline">
                    {file ? "elige otro" : "desde tu equipo"}
                  </button>
                </span>
                <span className="text-xs">Columnas: {copy.columns}</span>
                <input ref={input} type="file" accept=".xlsx,.csv" className="sr-only" aria-label={`Archivo de ${copy.noun}`} onChange={(e) => choose(e.target.files?.[0])} />
              </div>
              <button
                type="button"
                onClick={() => download(`${base}/template.xlsx`, `plantilla-${kind}-westvane.xlsx`)}
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
                      <li key={r.row} className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-3 px-4 py-2.5">
                        <span className="tabular pt-0.5 text-xs text-muted-foreground">Fila {r.row}</span>
                        {r.ok ? (
                          <span className="flex items-center gap-1.5 font-medium">
                            <CircleCheck className="size-3.5 shrink-0 text-success" aria-hidden />
                            {r.label}
                          </span>
                        ) : (
                          <p className={cn("flex items-start gap-1.5 text-destructive")}>
                            <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                            {r.error}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                  {copy.personal && (
                    <label className="flex items-start gap-3 text-sm">
                      <input type="checkbox" checked={authorized} onChange={(e) => setAuthorized(e.target.checked)} className="mt-0.5" />
                      <span>{CHECK_THIRD_PARTY}</span>
                    </label>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button onClick={confirm} disabled={busy || preview.valid === 0 || (copy.personal && !authorized)}>
                      {busy ? <LoaderCircle className="animate-spin" /> : <CircleCheck />}
                      Crear {preview.valid} {copy.noun}
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
            </>
          )}
        </div>
      </Sheet>
    </>
  );
}
