"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Camera, CircleAlert, CircleCheck, ImageIcon } from "lucide-react";

import { useApp } from "@/components/providers";
import { SignaturePad } from "@/components/shipments/signature-pad";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SaveIcon } from "@/components/ui/save-icon";
import { Segmented } from "@/components/ui/segmented";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/client";
import { CHECK_THIRD_PARTY, recordConsent } from "@/lib/consent";
import { EASE, SPRING } from "@/lib/motion";
import type { DeliveryInfo } from "@/lib/types";

function dt(iso: string) {
  return new Date(iso).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/**
 * Prueba de entrega: quién recibió, cuándo, en qué estado llegó la carga y su firma. Se registra cuando el envío
 * llega. Al guardar, el formulario se convierte en el comprobante (fundido y desplazamiento corto; el sello entra
 * con un resorte). Con «Reducir movimiento», solo fundidos.
 */
export function DeliveryProof({ code, initial }: { code: string; initial: DeliveryInfo | null }) {
  const router = useRouter();
  const { operator } = useApp();
  const reduced = useReducedMotion();
  const [info, setInfo] = useState(initial);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [condition, setCondition] = useState<"conforme" | "con_novedad">("conforme");
  const [notes, setNotes] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  // Foto de la entrega (opcional): se sube como adjunto del envío, con la misma declaración de autorización
  const [photo, setPhoto] = useState<{ id: number; name: string } | null>(null);
  const [photoOk, setPhotoOk] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = `/api/shipments/${encodeURIComponent(code)}/delivery`;

  if (!info) return <p className="text-sm text-muted-foreground">No se pudo cargar la entrega.</p>;

  async function subirFoto(file: File) {
    if (!photoOk) {
      toast({ title: "Falta la declaración", description: "Marca que tienes autorización de las personas que aparezcan en la foto.", tone: "error" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "La foto pasa de 10 MB", tone: "error" });
      return;
    }
    setPhotoBusy(true);
    try {
      await recordConsent([{ document: "autorizacion_terceros", text: CHECK_THIRD_PARTY }], "adjunto", operator);
      const b64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
        r.onerror = () => reject(new Error("No se pudo leer la foto."));
        r.readAsDataURL(file);
      });
      const created = await api<{ attachment_id: number; filename: string }>(`/api/shipments/${encodeURIComponent(code)}/attachments`, {
        method: "POST",
        body: { filename: file.name || "foto-entrega.jpg", content_b64: b64, usuario: operator, autorizado: true },
      });
      setPhoto({ id: created.attachment_id, name: created.filename });
      toast({ title: "Foto adjuntada", description: "Queda con los documentos del envío." });
    } catch (err) {
      toast({ title: "No se pudo adjuntar la foto", description: (err as Error).message, tone: "error" });
    } finally {
      setPhotoBusy(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) return setError("Escribe el nombre de quien recibe.");
    if (condition === "con_novedad" && !notes.trim()) return setError("Describe la novedad.");
    if (!signature) return setError("Falta la firma de quien recibe.");
    setState("busy");
    try {
      const next = await api<DeliveryInfo>(url, {
        method: "PUT",
        body: { received_by: name.trim(), condition, notes: notes.trim() || null, signature, usuario: operator },
      });
      setState("done");
      setInfo(next);
      setOpen(false);
      toast({ title: "Entrega registrada" });
      router.refresh();
    } catch (err) {
      setState("idle");
      setError((err as Error).message);
    }
  }

  async function annul() {
    if (!window.confirm("¿Anular la entrega registrada? Queda en el historial y podrás registrarla de nuevo.")) return;
    try {
      setInfo(await api<DeliveryInfo>(`${url}?usuario=${encodeURIComponent(operator)}`, { method: "DELETE" }));
      setState("idle");
      setSignature(null);
      toast({ title: "Entrega anulada" });
      router.refresh();
    } catch (err) {
      toast({ title: "No se pudo anular", description: (err as Error).message, tone: "error" });
    }
  }

  const enter = reduced ? { opacity: 0 } : { opacity: 0, y: 8 };
  const shown = reduced ? { opacity: 1 } : { opacity: 1, y: 0 };
  const d = info.delivery;
  const view = d ? "receipt" : open ? "form" : "idle";

  return (
    <AnimatePresence mode="wait" initial={false}>
      {view === "receipt" && d && (
        <motion.div key="receipt" initial={enter} animate={shown} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: EASE }} className="flex flex-col gap-3 text-sm">
          <div className="flex items-start gap-3">
            <motion.span
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
              animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1 }}
              transition={reduced ? { duration: 0.2 } : { ...SPRING, delay: 0.08 }}
              className={d.condition === "conforme" ? "text-success" : "text-warning"}
              aria-hidden
            >
              {d.condition === "conforme" ? <CircleCheck className="size-8" /> : <CircleAlert className="size-8" />}
            </motion.span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{d.received_by ? `Recibió ${d.received_by}` : "Recibido"}</p>
              <p className="tabular text-xs text-muted-foreground">{dt(d.received_at)}</p>
              <Badge tone={d.condition === "conforme" ? "success" : "warning"} className="mt-1.5">
                {d.condition_label}
              </Badge>
            </div>
          </div>
          {d.notes && <p className="rounded-xl bg-fill px-3 py-2 text-xs">{d.notes}</p>}
          {d.signature ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URL generada en la app; no pasa por el optimizador
            <img src={d.signature} alt={`Firma de ${d.received_by ?? "quien recibió"}`} className="aspect-[10/3] w-full rounded-xl border border-border" style={{ backgroundColor: "#ffffff" }} />
          ) : d.purged ? (
            <p className="text-xs text-muted-foreground">Nombre y firma borrados por el plazo de conservación de datos.</p>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>Registró {d.recorded_by}</span>
            <Button variant="ghost" size="sm" className="print:hidden" onClick={annul}>
              Anular
            </Button>
          </div>
        </motion.div>
      )}

      {view === "form" && (
        <motion.form key="form" onSubmit={save} initial={enter} animate={shown} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: EASE }} className="flex flex-col gap-3 text-sm" noValidate>
          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">Recibe (nombre completo)</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus autoComplete="off" className="field h-10 w-full px-3" aria-invalid={!!error && name.trim().length < 2} />
          </label>
          <Segmented
            id="pod-condition"
            label="Estado de la carga"
            size="sm"
            fill
            value={condition}
            onChange={setCondition}
            options={[
              { value: "conforme", label: "Conforme" },
              { value: "con_novedad", label: "Con novedad" },
            ]}
          />
          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">{condition === "con_novedad" ? "Novedad (obligatoria)" : "Observaciones"}</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} rows={2} className="field w-full px-3 py-2" placeholder={condition === "con_novedad" ? "Faltante, avería, empaque abierto…" : "Opcional"} />
          </label>
          <SignaturePad onChange={setSignature} />

          {/* Foto de la entrega: en el celular abre la cámara; queda como adjunto del envío */}
          <div className="rounded-xl border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Foto de la entrega (opcional)</span>
              {photo ? (
                <span className="flex items-center gap-1.5 text-xs text-success">
                  <ImageIcon className="size-3.5" aria-hidden /> {photo.name}
                </span>
              ) : (
                <label className={photoBusy ? "pointer-events-none opacity-60" : "cursor-pointer"}>
                  <span className="inline-flex h-8 items-center gap-1.5 rounded-md bg-fill px-3 text-xs font-medium press">
                    <Camera className="size-3.5" aria-hidden /> {photoBusy ? "Subiendo…" : "Tomar foto"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    aria-label="Tomar o elegir la foto de la entrega"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void subirFoto(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>
            {!photo && (
              <label className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={photoOk} onChange={(e) => setPhotoOk(e.target.checked)} className="mt-0.5 size-4" />
                Declaro que tengo autorización de las personas que aparezcan en la foto.
              </label>
            )}
          </div>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={state === "busy"}>
              Cancelar
            </Button>
            <Button type="submit" disabled={state === "busy"}>
              <SaveIcon state={state} /> Guardar entrega
            </Button>
          </div>
        </motion.form>
      )}

      {view === "idle" && (
        <motion.div key="idle" initial={enter} animate={shown} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: EASE }} className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-muted-foreground">
            {info.arrived ? "Llegó a destino: registra quién recibió y su firma." : `Se registra al llegar (estimado ${dt(info.eta_at)}).`}
          </p>
          {info.can_record && (
            <Button variant="secondary" size="sm" className="print:hidden" onClick={() => { setError(null); setOpen(true); }}>
              Registrar entrega
            </Button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
