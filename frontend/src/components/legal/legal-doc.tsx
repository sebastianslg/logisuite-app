import { Suspense } from "react";
import Link from "next/link";
import { FileWarning } from "lucide-react";

import { PageHeader, Skeleton } from "@/components/page-header";
import { apiGetOrNull } from "@/lib/api";
import type { LegalInfo, LegalResponsible } from "@/lib/types";

/** Fecha de versión AAAA-MM-DD en palabras: «28 de octubre de 2026». */
export function versionDate(v: string | undefined) {
  if (!v) return "—";
  return new Date(`${v}T12:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
}

/** Un dato del responsable, o el marcador de lo que falta (el documento se muestra como borrador). */
export function Field({ value, label }: { value: string | null | undefined; label: string }) {
  if (value) return <>{value}</>;
  return <mark className="rounded bg-warning/15 px-1 text-warning">[{label}]</mark>;
}

/**
 * Página de un documento legal: encabezado, aviso de borrador si faltan datos del responsable o si aún no lo
 * revisó un abogado, índice y cuerpo. El cuerpo recibe la información legal (versiones y responsable) del
 * servidor, donde se configura con las variables LEGAL_*.
 */
export function LegalDoc({
  title,
  description,
  doc,
  sections,
  children,
}: {
  title: string;
  description: string;
  doc: "terminos" | "privacidad" | "cookies";
  sections: { id: string; label: string }[];
  children: (info: LegalInfo) => React.ReactNode;
}) {
  return (
    <div className="page page-narrow">
      <PageHeader title={title} description={description} />
      <div className="grid gap-10 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label="En esta página" className="hidden lg:block print:hidden">
          <ol className="sticky top-24 flex flex-col gap-0.5 border-l border-border text-sm">
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="-ml-px block border-l border-transparent py-1 pl-4 text-muted-foreground hover:border-foreground hover:text-foreground">
                  {s.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <article className="legal max-w-[72ch] text-[0.9375rem] leading-relaxed text-foreground/90">
          <Suspense fallback={<Skeleton className="h-[700px]" />}>
            <Body doc={doc}>{children}</Body>
          </Suspense>
        </article>
      </div>
    </div>
  );
}

const FALLBACK: LegalInfo = {
  versions: { terminos: "", privacidad: "", autorizacion_terceros: "" },
  required: [],
  responsible: { name: null, id_number: null, city: null, address: null, email: null, phone: null, server_location: null, complete: false },
};

async function Body({ doc, children }: { doc: "terminos" | "privacidad" | "cookies"; children: (info: LegalInfo) => React.ReactNode }) {
  const info = (await apiGetOrNull<LegalInfo>("/api/legal")) ?? FALLBACK;
  const version = doc === "cookies" ? info.versions.privacidad : info.versions[doc];
  return (
    <>
      <p className="text-xs text-muted-foreground">Versión vigente desde el {versionDate(version)}.</p>
      <DraftNotice r={info.responsible} />
      {children(info)}
      <p className="mt-12 border-t border-border pt-4 text-xs text-muted-foreground">
        Ver también:{" "}
        {doc !== "terminos" && (
          <>
            <Link href="/terminos" className="underline">Términos y condiciones</Link> ·{" "}
          </>
        )}
        {doc !== "privacidad" && (
          <>
            <Link href="/privacidad" className="underline">Política de tratamiento de datos</Link> ·{" "}
          </>
        )}
        {doc !== "cookies" && (
          <>
            <Link href="/cookies" className="underline">Cookies y almacenamiento</Link> ·{" "}
          </>
        )}
        <Link href="/creditos" className="underline">Créditos y licencias</Link>
      </p>
    </>
  );
}

function DraftNotice({ r }: { r: LegalResponsible }) {
  return (
    <aside className="mt-4 flex gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm" role="note">
      <FileWarning className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
      <p>
        <strong className="font-medium">Borrador en revisión legal.</strong>{" "}
        {r.complete
          ? "Este texto aún no ha sido revisado por un abogado."
          : "Faltan los datos del responsable (marcados en amarillo) y la revisión de un abogado."}{" "}
        Mientras tanto describe con fidelidad cómo funciona hoy la app.
      </p>
    </aside>
  );
}

export function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mt-10 scroll-mt-28 text-[1.1875rem] font-semibold tracking-[-0.015em] text-foreground">
      {children}
    </h2>
  );
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3">{children}</p>;
}

export function UL({ children }: { children: React.ReactNode }) {
  return <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 marker:text-muted-foreground">{children}</ul>;
}

/** Bloque con los datos del responsable (o sus marcadores). */
export function ResponsibleCard({ r }: { r: LegalResponsible }) {
  return (
    <dl className="mt-4 grid grid-cols-[8rem_minmax(0,1fr)] gap-x-4 gap-y-1.5 rounded-2xl border border-border bg-card px-5 py-4 text-sm">
      <dt className="text-muted-foreground">Responsable</dt>
      <dd><Field value={r.name} label="nombre o razón social" /></dd>
      <dt className="text-muted-foreground">Identificación</dt>
      <dd><Field value={r.id_number} label="cédula o NIT" /></dd>
      <dt className="text-muted-foreground">Domicilio</dt>
      <dd>
        {r.address ? `${r.address}, ` : ""}
        <Field value={r.city} label="ciudad" />, Colombia
      </dd>
      <dt className="text-muted-foreground">Correo</dt>
      <dd><Field value={r.email} label="correo para solicitudes" /></dd>
      {r.phone && (
        <>
          <dt className="text-muted-foreground">Teléfono</dt>
          <dd>{r.phone}</dd>
        </>
      )}
    </dl>
  );
}
