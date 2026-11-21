"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";

import { openAuthModal } from "@/components/auth/login-dialog";
import { toast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth";
import { api, saveBlob } from "@/lib/client";

/**
 * Descarga del historial en CSV. El servidor solo lo entrega a un administrador (son mil líneas con nombres y detalles), así
 * que va por `api()`, que lleva la sesión; un enlace directo no la lleva. Sin sesión de administrador, ofrece ingresar.
 */
export function AuditExportButton({ query }: { query: string }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  async function download() {
    if (user?.role !== "admin") {
      openAuthModal();
      return;
    }
    setBusy(true);
    try {
      saveBlob(await api<Blob>(`/api/audit/export.csv?${query}`), `auditoria-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (e) {
      toast({ title: "No se pudo descargar", description: (e as Error).message, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={busy}
      title={user?.role === "admin" ? undefined : "Solo para administradores"}
      className="inline-flex items-center gap-1.5 rounded-md text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/60 disabled:opacity-60 pointer-coarse:min-h-11"
    >
      {busy && <LoaderCircle className="size-3.5 animate-spin" aria-hidden />}
      Descargar CSV{user?.role === "admin" ? "" : " (administradores)"}
    </button>
  );
}
