"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { useApp } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client";
import { recordConsent, useConsent, type ConsentStatus } from "@/lib/consent";
import type { LegalInfo } from "@/lib/types";

/** Textos exactos de las casillas: se guardan tal cual en el registro como prueba de lo aceptado. */
export const CHECK_TERMS = "He leído y acepto los Términos y condiciones de Westvane.";
export const CHECK_PRIVACY =
  "Autorizo el tratamiento de mis datos personales (el nombre que declaro y los datos de uso de la app) según la Política de tratamiento de datos.";

/** Páginas que se pueden leer sin haber aceptado (son lo que se acepta). */
const OPEN_PATHS = ["/terminos", "/privacidad", "/cookies", "/creditos"];

/**
 * Bienvenida con aceptación: la primera vez (o cuando cambia la versión de un documento) pide, en dos casillas
 * separadas y sin marcar, aceptar los términos y autorizar el tratamiento de datos. Muestra el aviso de
 * privacidad corto. No se cierra sin aceptar; los documentos se abren en otra pestaña para leerlos.
 */
export function ConsentGate() {
  const pathname = usePathname();
  const { status } = useConsent();
  if (!status || !status.pending.length || OPEN_PATHS.includes(pathname)) return null;
  return <Dialog status={status} />;
}

function Dialog({ status }: { status: ConsentStatus }) {
  const { operator, setOperator } = useApp();
  const [name, setName] = useState(operator);
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [legal, setLegal] = useState<LegalInfo | null>(null);
  const titleId = useId();
  const again = Object.keys(status.documents).length > 0;

  useEffect(() => {
    api<LegalInfo>("/api/legal").then(setLegal).catch(() => undefined);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  async function accept(e: React.FormEvent) {
    e.preventDefault();
    if (!terms || !privacy) return;
    setBusy(true);
    setError(null);
    try {
      if (name.trim() !== operator) setOperator(name.trim());
      await recordConsent(
        [
          { document: "terminos", version: status.versions.terminos, text: CHECK_TERMS },
          { document: "privacidad", version: status.versions.privacidad, text: CHECK_PRIVACY },
        ],
        "primer_uso",
        name.trim(),
      );
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const r = legal?.responsible;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-3 sm:items-center print:hidden" role="presentation">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={accept}
        className="floating enter max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-3xl p-6"
      >
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="size-5" aria-hidden />
          </span>
          <h2 id={titleId} className="text-lg font-semibold tracking-[-0.01em]">
            {again ? "Actualizamos los documentos" : "Antes de empezar"}
          </h2>
        </div>
        <p className="mt-3 text-sm text-foreground/90">
          {again
            ? "Cambiaron los términos o la política de datos. Revísalos y vuelve a aceptarlos para seguir usando Westvane."
            : "Westvane es una herramienta de planificación logística con datos de operación simulados. Para usarla necesitamos tu aceptación."}
        </p>

        <label className="mt-5 block text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">Tu nombre (opcional: firma los cambios que hagas)</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="name" className="field h-10 w-full px-3" />
        </label>

        <div className="mt-5 flex flex-col gap-3 text-sm">
          <label className="flex items-start gap-3">
            <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5" required />
            <span>
              He leído y acepto los{" "}
              <Link href="/terminos" target="_blank" className="text-primary underline">
                Términos y condiciones
              </Link>{" "}
              de Westvane.
            </span>
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} className="mt-0.5" required />
            <span>
              Autorizo el tratamiento de mis datos personales (el nombre que declaro y los datos de uso de la app) según la{" "}
              <Link href="/privacidad" target="_blank" className="text-primary underline">
                Política de tratamiento de datos
              </Link>
              .
            </span>
          </label>
        </div>

        {/* Aviso de privacidad (Decreto 1074 de 2015, art. 2.2.2.25.3.3) */}
        <p className="mt-5 rounded-2xl bg-fill px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          <strong className="font-medium text-foreground">Aviso de privacidad.</strong> Responsable:{" "}
          {r?.name ?? "el titular de Westvane"}
          {r?.city ? `, ${r.city}` : ""}. Usamos tu nombre declarado para firmar los cambios y llevar el historial, y los datos
          de uso para operar y proteger la app. No los vendemos ni los usamos para publicidad. Puedes conocer, actualizar,
          rectificar o suprimir tus datos y revocar esta autorización desde Configuración
          {r?.email ? ` o escribiendo a ${r.email}` : ""}. Detalles en la{" "}
          <Link href="/privacidad" target="_blank" className="underline">
            política completa
          </Link>
          .
        </p>

        {error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="mt-5 w-full" disabled={!terms || !privacy || busy}>
          {busy ? "Guardando…" : "Aceptar y continuar"}
        </Button>
      </form>
    </div>
  );
}
