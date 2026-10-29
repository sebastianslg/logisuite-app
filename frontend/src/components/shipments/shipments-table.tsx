"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  CircleOff,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  X,
  Bookmark,
  BookmarkPlus,
  PenLine,
  FileUp,
  Rows3,
  Rows4,
} from "lucide-react";
import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_text,
  tableFeatures,
  useTable,
  type FilterFn,
  type TableFeatures,
} from "@tanstack/react-table";

import { Money } from "@/components/money";
import { useApp } from "@/components/providers";
import { rememberCode, rememberCodeIn } from "@/components/shipments/shared-code";
import { CountUp } from "@/components/ui/count-up";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/toast";
import { ExportActions } from "@/components/shipments/export-actions";
import { ImportShipments } from "@/components/shipments/import-shipments";
import { Sheet } from "@/components/ui/sheet";
import { useLocal } from "@/lib/local";
import { ModeChain, StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, openBlob, saveBlob } from "@/lib/client";
import { MODE_ORDER, MODES, PRIORITIES, STATUSES, STATUS_ORDER, tint } from "@/lib/modes";
import { EASE } from "@/lib/motion";
import type { Mode, Shipment, ShipmentStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/* --------------------------------------------------------------------------
 * Filtros propios. Se registran por nombre en `filterFns`; `autoRemove`
 * elimina el filtro del estado cuando la selección queda vacía.
 * ------------------------------------------------------------------------ */
const inSet = Object.assign(
  ((row, columnId, value: string[]) =>
    !value?.length || value.includes(row.getValue(columnId) as string)) as FilterFn<TableFeatures, Shipment>,
  { autoRemove: (value: unknown) => !Array.isArray(value) || value.length === 0 },
);

const usesAnyMode = Object.assign(
  ((row, columnId, value: Mode[]) =>
    !value?.length ||
    (row.getValue(columnId) as Mode[]).some((m) => value.includes(m))) as FilterFn<TableFeatures, Shipment>,
  { autoRemove: (value: unknown) => !Array.isArray(value) || value.length === 0 },
);

const features = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  filterFns: { includesString: filterFn_includesString, inSet, usesAnyMode },
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text },
});

const helper = createColumnHelper<typeof features, Shipment>();

const columns = helper.columns([
  helper.accessor("code", {
    header: "Envío",
    cell: (info) => (
      <Link
        href={`/envios/${info.getValue()}`}
        data-code={info.getValue()}
        onClick={(e) => rememberCode(info.getValue(), e.currentTarget)}
        className="font-mono text-xs text-foreground/80 underline-offset-2 hover:text-primary hover:underline"
      >
        {info.getValue()}
      </Link>
    ),
  }),
  helper.accessor((s) => `${s.origin} → ${s.destination}`, {
    id: "route",
    header: "Ruta",
    cell: (info) => {
      const s = info.row.original;
      return (
        <div className="flex flex-col">
          <span className="block max-w-48 truncate font-medium min-[1600px]:max-w-none" title={`${s.origin} → ${s.destination}`}>
            {s.origin} <span className="text-muted-foreground">→</span> {s.destination}
          </span>
          <span className="max-w-44 truncate text-xs text-muted-foreground 2xl:max-w-56">{s.cargo}</span>
        </div>
      );
    },
  }),
  helper.accessor("modes", {
    header: "Modos",
    filterFn: "usesAnyMode",
    enableSorting: false,
    enableGlobalFilter: false,
    cell: (info) => (
      <div className="flex items-center gap-2">
        <ModeChain modes={info.getValue()} />
        {info.row.original.n_transfers > 0 && (
          <span className="hidden text-xs text-muted-foreground xl:inline">
            {info.row.original.n_transfers} transb.
          </span>
        )}
      </div>
    ),
  }),
  helper.accessor("status", {
    header: "Estado",
    filterFn: "inSet",
    sortFn: (a, b) =>
      STATUS_ORDER.indexOf(a.original.status) - STATUS_ORDER.indexOf(b.original.status),
    cell: (info) => (
      <div className="flex flex-col items-start gap-1">
        <StatusBadge status={info.getValue()} />
        {info.row.original.delivery_signed === true && (
          <Badge tone="success" title="Tiene prueba de entrega">
            <PenLine />
            Firmada
          </Badge>
        )}
        {info.row.original.delivery_signed === false && (
          <Badge tone="neutral" title="Llegó y aún no tiene prueba de entrega">
            <PenLine />
            Sin firmar
          </Badge>
        )}
        {info.row.original.route_status === "sin_ruta" && (
          <Badge tone="danger" title={info.row.original.route_note ?? undefined}>
            <CircleOff />
            Sin ruta
          </Badge>
        )}
      </div>
    ),
  }),
  helper.accessor("progress_pct", {
    header: "Avance",
    enableGlobalFilter: false,
    cell: (info) => {
      const s = info.row.original;
      const color = s.current_mode ? MODES[s.current_mode].color : "var(--muted-foreground)";
      return (
        <div className="flex w-20 items-center gap-2 min-[1600px]:w-28">
          <div className="h-1 flex-1 rounded-full bg-fill">
            <div
              className="meter-fill h-full rounded-full"
              style={{ "--v": info.getValue() / 100, backgroundColor: color } as React.CSSProperties}
            />
          </div>
          <span className="tabular w-9 text-right text-xs text-muted-foreground">
            {Math.round(info.getValue())} %
          </span>
        </div>
      );
    },
  }),
  helper.accessor("weight_t", {
    header: "Peso",
    enableGlobalFilter: false,
    cell: (info) => <span className="tabular">{info.row.original.weight_fmt}</span>,
  }),
  helper.accessor("cost", {
    header: "Flete",
    enableGlobalFilter: false,
    cell: (info) => (
      <span className="tabular">
        <Money usd={info.getValue()} />
      </span>
    ),
  }),
  helper.accessor("eta_at", {
    header: "ETA",
    enableGlobalFilter: false,
    cell: (info) => {
      const s = info.row.original;
      return (
        <div className="flex flex-col">
          <span className="tabular">{s.eta_fmt}</span>
          {s.delay_fmt && <span className="text-xs text-destructive">+{s.delay_fmt}</span>}
        </div>
      );
    },
  }),
  helper.accessor("client", {
    header: "Cliente",
    cell: (info) => <span className="block max-w-44 truncate" title={info.getValue()}>{info.getValue()}</span>,
  }),
  helper.accessor("priority", {
    header: "Prioridad",
    cell: (info) => (
      <span className="text-xs text-muted-foreground">{PRIORITIES[info.getValue()]}</span>
    ),
  }),
]);

const PAGE_SIZES = [10, 20, 50];

/** Columnas de cifras: alineadas a la derecha para comparar de un vistazo. */
const NUMERIC = new Set(["weight_t", "cost"]);
/**
 * Columnas que ceden su lugar cuando falta ancho, para que la tabla nunca se desplace hacia el lado: la tabla
 * aparece desde 1024 px (debajo, tarjetas); ETA y cliente desde 1280 px; prioridad desde 1600 px.
 */
const COL_VISIBILITY: Record<string, string> = {
  eta_at: "hidden xl:table-cell",
  client: "hidden xl:table-cell",
  priority: "hidden min-[1600px]:table-cell",
};
const colClass = (id: string) => cn(COL_VISIBILITY[id], NUMERIC.has(id) && "text-right");

/** Vista guardada: una combinación de filtros con nombre (vive en este navegador). */
interface SavedView {
  name: string;
  status: ShipmentStatus[];
  modes: Mode[];
  q: string;
}
const NO_VIEWS: SavedView[] = [];

/** Filtros iniciales (vienen de la URL: ?estado=, ?modo=, ?q=). */
export interface ShipmentFilters {
  status?: ShipmentStatus[];
  modes?: Mode[];
  q?: string;
  /** Solo entregados sin prueba de entrega (?firmar=1). */
  unsigned?: boolean;
}

export function ShipmentsTable({ data, initial }: { data: Shipment[]; initial?: ShipmentFilters }) {
  // «Por firmar»: entregados sin prueba de entrega. Filtra antes de la tabla; las cifras de los chips usan todo
  const [unsigned, setUnsigned] = useState(!!initial?.unsigned);
  const unsignedCount = useMemo(() => data.filter((s) => s.delivery_signed === false).length, [data]);
  const rows = useMemo(() => (unsigned ? data.filter((s) => s.delivery_signed === false) : data), [data, unsigned]);
  const router = useRouter();
  const { operator, currency } = useApp();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [views, setViews] = useLocal<SavedView[]>("westvane.shipment-views", NO_VIEWS);
  const [density, setDensity] = useLocal<"comoda" | "compacta">("westvane.table-density", "comoda");
  const table = useTable({
    features,
    columns,
    data: rows,
    globalFilterFn: "includesString",
    // En tránsito primero (orden operativo de STATUS_ORDER)
    initialState: {
      pagination: { pageIndex: 0, pageSize: 10 },
      sorting: [{ id: "status", desc: false }],
      columnFilters: [
        ...(initial?.status?.length ? [{ id: "status", value: initial.status }] : []),
        ...(initial?.modes?.length ? [{ id: "modes", value: initial.modes }] : []),
      ],
      globalFilter: initial?.q ?? "",
    },
  });

  const statusFilter = (table.getColumn("status")?.getFilterValue() as ShipmentStatus[]) ?? [];
  const modeFilter = (table.getColumn("modes")?.getFilterValue() as Mode[]) ?? [];
  const globalFilter = (table.state.globalFilter as string) ?? "";

  const statusCounts = useMemo(() => {
    const c = new Map<ShipmentStatus, number>();
    data.forEach((r) => c.set(r.status, (c.get(r.status) ?? 0) + 1));
    return c;
  }, [data]);
  const modeCounts = useMemo(() => {
    const c = new Map<Mode, number>();
    rows.forEach((r) => new Set(r.modes).forEach((m) => c.set(m, (c.get(m) ?? 0) + 1)));
    return c;
  }, [rows]);

  const toggle = <T,>(col: "status" | "modes", current: T[], value: T) => {
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    table.getColumn(col)?.setFilterValue(next);
  };

  const filteredCount = table.getFilteredRowModel().rows.length;
  // La selección solo conserva envíos que siguen existiendo
  const selectedCodes = rows.map((r) => r.code).filter((c) => selected.has(c));
  const pageCodes = table.getRowModel().rows.map((r) => r.original.code);
  const allPageSelected = pageCodes.length > 0 && pageCodes.every((c) => selected.has(c));
  const somePageSelected = !allPageSelected && pageCodes.some((c) => selected.has(c));

  const toggleRow = (code: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  const togglePage = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      pageCodes.forEach((c) => (allPageSelected ? next.delete(c) : next.add(c)));
      return next;
    });

  async function remove(codes: string[]) {
    const label = codes.length === 1 ? `el envío ${codes[0]}` : `${codes.length} envíos`;
    if (!window.confirm(`¿Borrar ${label}? Queda registrado en el historial y no se puede deshacer.`)) return;
    setBusy("delete");
    setActionError(null);
    try {
      for (const code of codes) {
        await api(`/api/shipments/${encodeURIComponent(code)}?usuario=${encodeURIComponent(operator)}`, {
          method: "DELETE",
        });
      }
      setSelected(new Set());
      router.refresh();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function viewPdf(code: string) {
    setBusy(`pdf-${code}`);
    setActionError(null);
    try {
      openBlob(await api<Blob>(`/api/shipments/${encodeURIComponent(code)}/pdf?moneda=${currency}`));
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  /** Excel con todos los envíos que dejan los filtros (no solo la página), en la moneda elegida. */
  async function exportExcel() {
    const codes = table.getFilteredRowModel().rows.map((r) => r.original.code);
    if (!codes.length) return;
    setBusy("xlsx");
    setActionError(null);
    try {
      const blob = await api<Blob>("/api/exports/xlsx", { method: "POST", body: { codes, moneda: currency } });
      saveBlob(blob, `envios-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast({ title: "Excel descargado", description: `${codes.length} ${codes.length === 1 ? "envío" : "envíos"} en ${currency}.` });
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  const { pageIndex, pageSize } = table.state.pagination;
  const hasFilters = statusFilter.length > 0 || modeFilter.length > 0 || globalFilter.length > 0 || unsigned;

  const same = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
  const activeView = views.find((v) => same(v.status, statusFilter) && same(v.modes, modeFilter) && v.q === globalFilter);
  function applyView(v: SavedView) {
    table.getColumn("status")?.setFilterValue(v.status);
    table.getColumn("modes")?.setFilterValue(v.modes);
    table.setGlobalFilter(v.q);
  }
  function saveView() {
    const name = window.prompt("Nombre de la vista (por ejemplo, «Retrasados fluviales»)")?.trim();
    if (!name) return;
    setViews((list) => [...list.filter((v) => v.name !== name), { name, status: statusFilter, modes: modeFilter, q: globalFilter }].slice(-8));
    toast({ title: "Vista guardada", description: `«${name}» queda en este navegador.` });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros en una sola fila sobre la tabla */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative flex h-10 w-full max-w-xs items-center">
          <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
          <input
            value={globalFilter}
            onChange={(e) => table.setGlobalFilter(e.target.value)}
            placeholder="Buscar envío, ciudad, carga, cliente"
            aria-label="Buscar envíos"
            className="h-10 w-full field pr-3 pl-9 text-sm outline-none"
          />
        </label>
        <div className="chip-scroll flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar por estado">
          {STATUS_ORDER.map((s) => {
            const active = statusFilter.includes(s);
            const Icon = STATUSES[s].icon;
            return (
              <motion.button
                key={s}
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={() => toggle("status", statusFilter, s)}
                aria-pressed={active}
                className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/80"
              >
                <Badge
                  tone={active ? STATUSES[s].tone : "neutral"}
                  className={cn("cursor-pointer transition-colors duration-200", !active && "hover:border-border-strong")}
                >
                  <Icon />
                  {s}
                  <CountUp value={statusCounts.get(s) ?? 0} duration={0.6} className="tabular font-semibold" />
                </Badge>
              </motion.button>
            );
          })}
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={() => setUnsigned((v) => !v)}
            aria-pressed={unsigned}
            title="Entregados que aún no tienen prueba de entrega"
            className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/80"
          >
            <Badge tone={unsigned ? "accent" : "neutral"} className={cn("cursor-pointer transition-colors duration-200", !unsigned && "hover:border-border-strong")}>
              <PenLine />
              Por firmar
              <CountUp value={unsignedCount} duration={0.6} className="tabular font-semibold" />
            </Badge>
          </motion.button>
        </div>
        <div className="chip-scroll flex items-center gap-1" role="group" aria-label="Filtrar por modo">
          {MODE_ORDER.map((m) => {
            const active = modeFilter.includes(m);
            const { icon: Icon, color, label } = MODES[m];
            return (
              <motion.button
                key={m}
                type="button"
                whileTap={{ scale: 0.94 }}
                onClick={() => toggle("modes", modeFilter, m)}
                aria-pressed={active}
                title={`${label} (${modeCounts.get(m) ?? 0})`}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-md border px-2 text-xs transition-colors duration-200",
                  active ? "text-foreground" : "border-border text-muted-foreground hover:text-foreground",
                )}
                style={active ? { borderColor: tint(color, 45), backgroundColor: tint(color, 12) } : undefined}
              >
                <Icon className="size-3.5" style={{ color }} />
                <span className="hidden sm:inline">{label}</span>
              </motion.button>
            );
          })}
        </div>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              table.resetColumnFilters();
              table.setGlobalFilter("");
              setUnsigned(false);
            }}
          >
            <X />
            Limpiar
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="hidden size-8 lg:inline-flex"
          onClick={() => setDensity(density === "compacta" ? "comoda" : "compacta")}
          aria-label={density === "compacta" ? "Filas cómodas" : "Filas compactas"}
          title={density === "compacta" ? "Filas cómodas" : "Filas compactas"}
          aria-pressed={density === "compacta"}
        >
          {density === "compacta" ? <Rows3 /> : <Rows4 />}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setImporting(true)} title="Crear envíos desde un Excel o CSV">
          <FileUp />
          Importar
        </Button>
        <Button
          variant="secondary"
          size="sm"
          burst={FileSpreadsheet}
          disabled={busy === "xlsx" || filteredCount === 0}
          onClick={exportExcel}
          title="Descargar en Excel los envíos filtrados"
        >
          {busy === "xlsx" ? <LoaderCircle className="animate-spin" /> : <FileSpreadsheet />}
          Excel
          <span className="tabular text-muted-foreground">{filteredCount}</span>
        </Button>
        </div>
      </div>

      {(views.length > 0 || hasFilters) && (
        <div className="chip-scroll -mt-1 flex flex-wrap items-center gap-1.5" role="group" aria-label="Vistas guardadas">
          <Bookmark className="mr-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          {views.map((v) => (
            <span key={v.name} className="group/view inline-flex items-center">
              <button
                type="button"
                onClick={() => applyView(v)}
                aria-pressed={activeView?.name === v.name}
                className={cn(
                  "press h-7 rounded-full border px-3 text-xs transition-colors duration-200",
                  activeView?.name === v.name ? "border-primary/40 bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {v.name}
              </button>
              <button
                type="button"
                onClick={() => setViews((list) => list.filter((x) => x.name !== v.name))}
                aria-label={`Quitar la vista ${v.name}`}
                className="ml-0.5 flex size-6 items-center justify-center rounded-full text-muted-foreground opacity-0 group-hover/view:opacity-100 hover:text-destructive focus-visible:opacity-100 pointer-coarse:opacity-100"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          {hasFilters && !activeView && (
            <button type="button" onClick={saveView} className="press inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-medium text-primary hover:bg-primary/[0.06]">
              <BookmarkPlus className="size-3.5" aria-hidden /> Guardar vista
            </button>
          )}
        </div>
      )}

      <Sheet open={importing} onClose={() => setImporting(false)} title="Importar envíos" description="Desde un Excel o CSV: primero una vista previa, luego se crean">
        <ImportShipments onDone={() => setImporting(false)} />
      </Sheet>

      <AnimatePresence initial={false}>
        {selectedCodes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex flex-wrap items-start gap-3 rounded-lg border border-primary/20 bg-primary/[0.04] px-4 py-3"
          >
            <span className="pt-1.5 text-sm">
              <span className="tabular font-medium">{selectedCodes.length}</span> seleccionados
            </span>
            <ExportActions codes={selectedCodes} />
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={busy === "delete"}
              onClick={() => remove(selectedCodes)}
            >
              {busy === "delete" ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
              Borrar
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              <X />
              Quitar selección
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      {/* overflow-clip (no auto): la tabla no se desplaza de lado desde 1024 px y así el encabezado puede quedar fijo */}
      <div
        data-density={density}
        className="glass hidden overflow-clip rounded-3xl lg:block data-[density=compacta]:[&_td]:py-2"
      >
        <Table>
          <TableHeader className="sticky top-[5.25rem] z-10 bg-card shadow-[0_1px_0_var(--separator)]">
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = somePageSelected;
                    }}
                    onChange={togglePage}
                    aria-label="Seleccionar los envíos de esta página"
                  />
                </TableHead>
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const canSort = header.column.getCanSort();
                  return (
                    <TableHead key={header.id} className={colClass(header.column.id)}>
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn("inline-flex items-center gap-1 hover:text-foreground", NUMERIC.has(header.column.id) && "flex-row-reverse")}
                        >
                          <table.FlexRender header={header} />
                          {sorted === "asc" ? (
                            <ArrowUp className="size-3" />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="size-3" />
                          ) : (
                            <ArrowUpDown className="size-3 opacity-40" />
                          )}
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </TableHead>
                  );
                })}
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            <AnimatePresence initial={false} mode="popLayout">
              {table.getRowModel().rows.map((row) => (
                <motion.tr
                  key={row.id}
                  // Las filas se reacomodan con desplazamiento al filtrar u ordenar; con más de 40 visibles, sin layout (rendimiento)
                  layout={table.getRowModel().rows.length <= 40 ? "position" : false}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  whileTap={{ scale: 0.995 }}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("a,button,input")) return;
                    rememberCodeIn(e.currentTarget, row.original.code);
                    router.push(`/envios/${row.original.code}`);
                  }}
                  data-state={selected.has(row.original.code) ? "selected" : undefined}
                  className="cursor-pointer border-b border-border transition-colors duration-200 ease-apple hover:bg-[color-mix(in_srgb,var(--card)_96%,var(--foreground))] data-[state=selected]:bg-primary/[0.05] data-[state=selected]:shadow-[inset_2px_0_0_var(--accent)]"
                >
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selected.has(row.original.code)}
                      onChange={() => toggleRow(row.original.code)}
                      aria-label={`Seleccionar ${row.original.code}`}
                    />
                  </TableCell>
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id} className={colClass(cell.column.id)}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                  <TableCell className="pr-3">
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={`Ver PDF de ${row.original.code}`}
                        title="Ver PDF"
                        disabled={busy === `pdf-${row.original.code}`}
                        onClick={() => viewPdf(row.original.code)}
                      >
                        {busy === `pdf-${row.original.code}` ? <LoaderCircle className="animate-spin" /> : <FileText />}
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8" asChild>
                        <Link
                          href={`/envios/${row.original.code}/editar`}
                          aria-label={`Editar ${row.original.code}`}
                          title="Editar"
                        >
                          <Pencil />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 hover:text-destructive"
                        aria-label={`Borrar ${row.original.code}`}
                        title="Borrar"
                        disabled={busy === "delete"}
                        onClick={() => remove([row.original.code])}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </motion.tr>
              ))}
            </AnimatePresence>
            {filteredCount === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length + 2} className="p-0">
                  <EmptyState
                    figure="0"
                    title="Ningún envío coincide"
                    description="Cambia la búsqueda o quita los filtros para ver todos los envíos."
                    action={{ label: "Quitar filtros", onClick: () => { table.resetColumnFilters(); table.setGlobalFilter(""); } }}
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* En pantallas estrechas la tabla se convierte en una lista de tarjetas */}
      {/* Al cambiar un filtro o la página, la lista hace un fundido de 200 ms (la key fuerza el ciclo) */}
      <motion.ul
        key={`${statusFilter.join()}|${modeFilter.join()}|${globalFilter}|${pageIndex}|${pageSize}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: EASE }}
        className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:hidden"
        aria-label="Envíos"
      >
        {table.getRowModel().rows.map((row) => {
          const sh = row.original;
          return (
            <li key={row.id}>
              <Link
                href={`/envios/${sh.code}`}
                onClick={(e) => rememberCodeIn(e.currentTarget, sh.code)}
                className="glass press block rounded-2xl p-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/80"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">
                      {sh.origin} <span className="text-muted-foreground">→</span> {sh.destination}
                    </div>
                    <div className="truncate text-sm text-muted-foreground">{sh.cargo}</div>
                  </div>
                  <StatusBadge status={sh.status} />
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <ModeChain modes={sh.modes} />
                  <div className="h-1.5 flex-1 rounded-full bg-fill">
                    <div
                      className="meter-fill h-full rounded-full"
                      style={{
                        "--v": sh.progress_pct / 100,
                        backgroundColor: sh.current_mode ? MODES[sh.current_mode].color : "var(--muted-foreground)",
                      } as React.CSSProperties}
                    />
                  </div>
                  <span className="tabular text-xs text-muted-foreground">{Math.round(sh.progress_pct)} %</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
                  <span data-code={sh.code} className="font-mono text-xs text-muted-foreground">{sh.code}</span>
                  <span className="tabular ml-auto text-right">
                    {sh.weight_fmt} · <Money usd={sh.cost} /> · ETA {sh.eta_fmt}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
        {filteredCount === 0 && (
          <li className="glass rounded-3xl">
            <EmptyState
              figure="0"
              title="Ningún envío coincide"
              description="Cambia la búsqueda o quita los filtros para ver todos los envíos."
              action={{ label: "Quitar filtros", onClick: () => { table.resetColumnFilters(); table.setGlobalFilter(""); } }}
            />
          </li>
        )}
      </motion.ul>

      {/* Paginación */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span className="tabular">
          {filteredCount === 0
            ? "0 envíos"
            : `${pageIndex * pageSize + 1}–${Math.min((pageIndex + 1) * pageSize, filteredCount)} de ${filteredCount} envíos`}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs">Filas</span>
          <div className="flex rounded-md border border-border p-0.5">
            {PAGE_SIZES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => table.setPageSize(n)}
                className={cn(
                  "relative h-7 rounded px-2.5 text-xs",
                  pageSize === n ? "text-foreground" : "hover:text-foreground",
                )}
              >
                {pageSize === n && (
                  <motion.span
                    layoutId="page-size"
                    className="absolute inset-0 rounded bg-fill"
                    transition={{ type: "spring", stiffness: 500, damping: 38 }}
                  />
                )}
                <span className="relative">{n}</span>
              </button>
            ))}
          </div>
          <Button variant="secondary" size="icon" aria-label="Primera página"
            onClick={() => table.firstPage()} disabled={!table.getCanPreviousPage()}>
            <ChevronsLeft />
          </Button>
          <Button variant="secondary" size="icon" aria-label="Página anterior"
            onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            <ChevronLeft />
          </Button>
          <span className="tabular px-1 text-xs">
            {pageIndex + 1} / {Math.max(1, table.getPageCount())}
          </span>
          <Button variant="secondary" size="icon" aria-label="Página siguiente"
            onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            <ChevronRight />
          </Button>
          <Button variant="secondary" size="icon" aria-label="Última página"
            onClick={() => table.lastPage()} disabled={!table.getCanNextPage()}>
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
