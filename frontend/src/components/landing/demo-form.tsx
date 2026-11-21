"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { CircleCheck, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/client";

interface Fields {
  name: string;
  company: string;
  email: string;
  phone: string;
  role: string;
  fleet_size: string;
  message: string;
  website: string;
}

const EMPTY: Fields = { name: "", company: "", email: "", phone: "", role: "", fleet_size: "", message: "", website: "" };

/**
 * Pedir una demostración. Llega al buzón de Westvane y queda en Administración; a quien la envía no se le escribe desde el
 * servidor (un formulario público que manda correos a cualquier dirección sería un relevo de spam). El campo «website» es una
 * trampa para robots: está fuera de la vista y del orden de tabulación.
 */
export function DemoForm({ consentText, fleetSizes }: { consentText: string; fleetSizes: string[] }) {
  const [f, setF] = useState<Fields>(EMPTY);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/demo-requests", {
        method: "POST",
        body: { ...f, phone: f.phone || null, role: f.role || null, fleet_size: f.fleet_size || null, message: f.message || null, accepted },
      });
      setSent(f.company);
      setF(EMPTY);
      setAccepted(false);
    } catch (err) {
      setError((err as Error).message);
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setBusy(false);
    }
  }

  if (sent)
    return (
      <div role="status" className="rounded-3xl glass px-6 py-10 sm:px-10">
        <CircleCheck className="size-8 text-success" aria-hidden />
        <p className="mt-4 text-2xl font-semibold tracking-tight">Recibimos su solicitud.</p>
        <p className="mt-2 max-w-[48ch] text-[1.0625rem] leading-relaxed text-muted-foreground">
          Le escribiremos para acordar la demostración con {sent}. Mientras tanto, puede recorrer la app con los datos de ejemplo.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/panel">Ver la app en vivo</Link>
          </Button>
          <Button variant="secondary" size="lg" onClick={() => setSent(null)}>
            Enviar otra solicitud
          </Button>
        </div>
      </div>
    );

  return (
    <form onSubmit={submit} className="rounded-3xl glass p-5 sm:p-8" noValidate={false}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" required>
          <input className="field h-11" name="name" autoComplete="name" required minLength={2} maxLength={80} value={f.name} onChange={set("name")} />
        </Field>
        <Field label="Empresa" required>
          <input className="field h-11" name="company" autoComplete="organization" required minLength={2} maxLength={120} value={f.company} onChange={set("company")} />
        </Field>
        <Field label="Correo de trabajo" required>
          <input className="field h-11" type="email" name="email" autoComplete="email" required maxLength={254} value={f.email} onChange={set("email")} />
        </Field>
        <Field label="Teléfono" hint="Opcional">
          <input className="field h-11" type="tel" name="phone" autoComplete="tel" maxLength={20} value={f.phone} onChange={set("phone")} />
        </Field>
        <Field label="Cargo" hint="Opcional">
          <input className="field h-11" name="role" autoComplete="organization-title" maxLength={80} value={f.role} onChange={set("role")} />
        </Field>
        <Field label="Tamaño de la flota" hint="Opcional">
          <select className="field h-11" name="fleet_size" value={f.fleet_size} onChange={set("fleet_size")}>
            <option value="">Sin indicar</option>
            {fleetSizes.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="¿Qué quiere ver en la demostración?" hint="Opcional" wide>
          <textarea className="field min-h-28 py-2.5" name="message" maxLength={1500} value={f.message} onChange={set("message")} />
        </Field>
      </div>

      {/* Trampa para robots: una persona no la ve ni llega a ella con el teclado */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Sitio web
          <input tabIndex={-1} autoComplete="off" name="website" value={f.website} onChange={set("website")} />
        </label>
      </div>

      <label className="mt-6 flex items-start gap-3 text-sm leading-relaxed">
        <input type="checkbox" className="mt-1" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} required />
        <span>
          {consentText}{" "}
          <Link href="/privacidad" className="font-medium text-primary underline-offset-2 hover:underline">
            Leer la política
          </Link>
        </span>
      </label>

      {error && (
        <p ref={errorRef} tabIndex={-1} role="alert" className="mt-4 text-sm text-destructive outline-none">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Button type="submit" size="lg" disabled={busy || !accepted}>
          {busy && <LoaderCircle className="animate-spin" />} Pedir demostración
        </Button>
        <p className="text-sm text-muted-foreground">Responde una persona del equipo, no un robot.</p>
      </div>
    </form>
  );
}

function Field({ label, hint, required, wide, children }: { label: string; hint?: string; required?: boolean; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={wide ? "flex flex-col gap-1.5 sm:col-span-2" : "flex flex-col gap-1.5"}>
      <span className="flex items-baseline justify-between gap-2 text-[0.8125rem] font-medium">
        <span>
          {label}
          {required && <span className="sr-only"> (obligatorio)</span>}
        </span>
        {hint && (
          <span className="text-xs font-normal text-muted-foreground">
            <span className="sr-only">, </span>
            {hint}
          </span>
        )}
      </span>
      {children}
    </label>
  );
}
