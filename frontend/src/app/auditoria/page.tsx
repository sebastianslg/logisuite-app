import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, History } from "lucide-react";

import { PageHeader, Skeleton } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { apiGet } from "@/lib/api";
import type { AuditEntry } from "@/lib/types";

export const metadata = { title: "Auditoría" };

const PAGE = 50;

/** Acciones del historial, con su color: lo que borra o cierra va en rojo, lo que crea en verde. */
const TONE: Record<string, "success" | "danger" | "warning" | "info" | "neutral"> = {
  INSERT: "success",
  CREATE: "success",
  UPDATE: "info",
  EDIT: "info",
  DELETE: "danger",
  CLOSE: "danger",
  REVOKE: "danger",
  REOPEN: "warning",
  LOGIN: "neutral",
  LOGOUT: "neutral",
  EXPORT: "neutral",
  EMAIL: "neutral",
};

interface Facets {
  usuarios: { value: string; count: number }[];
  acciones: { value: string; count: number }[];
  tablas: { value: string; count: number }[];
}

export default function AuditoriaPage({ searchParams }: PageProps<"/auditoria">) {
  return (
    <div className="page">
      <PageHeader
        title="Auditoría"
        description="Todo lo que cambió en la app, con quién lo hizo y cuándo. Filtra por persona, acción, fecha o texto."
      />
      <Suspense fallback={<Skeleton className="h-[560px]" />}>
        <Tabla searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Tabla({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const f = {
    tabla: uno(sp.tabla),
    usuario: uno(sp.usuario),
    accion: uno(sp.accion),
    desde: uno(sp.desde),
    hasta: uno(sp.hasta),
    q: uno(sp.q),
    pagina: Math.max(1, Number(uno(sp.pagina)) || 1),
  };
  const query = new URLSearchParams({ limit: String(PAGE), offset: String((f.pagina - 1) * PAGE) });
  for (const k of ["tabla", "usuario", "accion", "desde", "hasta", "q"] as const) if (f[k]) query.set(k, f[k]);

  const [data, facets] = await Promise.all([
    apiGet<{ total: number; items: AuditEntry[] }>(`/api/audit?${query.toString()}`),
    apiGet<Facets>("/api/audit/facets"),
  ]);

  const paginas = Math.max(1, Math.ceil(data.total / PAGE));
  const enlace = (pagina: number) => {
    const q = new URLSearchParams(query);
    q.set("offset", String((pagina - 1) * PAGE));
    if (pagina === 1) q.delete("pagina");
    return `/auditoria?${q.toString().replace(/^limit=[^&]*&?/, "")}${pagina > 1 ? `&pagina=${pagina}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <form method="get" action="/auditoria" className="glass flex flex-wrap items-end gap-3 rounded-3xl p-4">
        <label className="flex min-w-40 flex-1 flex-col gap-1 text-xs text-muted-foreground">
          Buscar en el detalle
          <input name="q" defaultValue={f.q} placeholder="código, placa, texto…" className="field h-10 px-3 text-sm text-foreground outline-none" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Tabla
          <select name="tabla" defaultValue={f.tabla} className="field h-10 min-w-36 px-3 text-sm text-foreground outline-none">
            <option value="">Todas</option>
            {facets.tablas.map((t) => (
              <option key={t.value} value={t.value}>
                {t.value} ({t.count})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Usuario
          <select name="usuario" defaultValue={f.usuario} className="field h-10 min-w-36 px-3 text-sm text-foreground outline-none">
            <option value="">Todos</option>
            {facets.usuarios.map((u) => (
              <option key={u.value} value={u.value}>
                {u.value} ({u.count})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Acción
          <select name="accion" defaultValue={f.accion} className="field h-10 min-w-32 px-3 text-sm text-foreground outline-none">
            <option value="">Todas</option>
            {facets.acciones.map((a) => (
              <option key={a.value} value={a.value}>
                {a.value} ({a.count})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Desde
          <input type="date" name="desde" defaultValue={f.desde} className="field h-10 px-3 text-sm text-foreground outline-none" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Hasta
          <input type="date" name="hasta" defaultValue={f.hasta} className="field h-10 px-3 text-sm text-foreground outline-none" />
        </label>
        <button type="submit" className="h-10 rounded-md bg-solid px-4 text-sm font-medium text-primary-foreground press">
          Filtrar
        </button>
        <Link href="/auditoria" className="h-10 px-2 text-sm leading-10 text-muted-foreground hover:text-foreground">
          Limpiar
        </Link>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="tabular text-xs text-muted-foreground" role="status">
          {data.total.toLocaleString("es-CO")} {data.total === 1 ? "cambio" : "cambios"}
          {paginas > 1 && ` · página ${f.pagina} de ${paginas}`}
        </p>
        <a
          href={`/api/audit/export.csv?${new URLSearchParams({ ...Object.fromEntries(query), limit: "1000", offset: "0" }).toString()}`}
          className="text-xs font-medium text-primary hover:underline"
        >
          Descargar CSV
        </a>
      </div>

      <section className="glass overflow-hidden rounded-3xl" aria-label="Cambios">
        {data.items.length === 0 ? (
          <p className="flex items-center gap-2 px-5 py-8 text-sm text-muted-foreground">
            <History className="size-4" aria-hidden /> No hay cambios con esos filtros.
          </p>
        ) : (
          <ul className="rule-list">
            {data.items.map((e) => (
              <li key={e.audit_id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-3 text-sm">
                <span className="tabular w-32 shrink-0 text-xs text-muted-foreground">
                  {e.timestamp.slice(0, 16).replace("T", " ")}
                </span>
                <Badge tone={TONE[e.action] ?? "neutral"}>{e.action}</Badge>
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{e.username}</span>{" "}
                  <span className="text-muted-foreground">{e.detail ?? "sin detalle"}</span>
                </span>
                {e.table_name === "mm_shipments" && e.record_id && (
                  <Link href={`/envios/${encodeURIComponent(e.record_id)}`} className="font-mono text-xs text-primary hover:underline">
                    {e.record_id}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {paginas > 1 && (
        <nav className="flex items-center justify-between gap-3" aria-label="Páginas">
          {f.pagina > 1 ? (
            <Link href={enlace(f.pagina - 1)} className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
              <ArrowLeft className="size-4" aria-hidden /> Anteriores
            </Link>
          ) : (
            <span />
          )}
          {f.pagina < paginas && (
            <Link href={enlace(f.pagina + 1)} className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
              Siguientes <ArrowRight className="size-4" aria-hidden />
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
