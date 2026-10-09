"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  X,
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

import { ModeChain, StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MODE_ORDER, MODES, PRIORITIES, STATUSES, STATUS_ORDER } from "@/lib/modes";
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
      <span className="font-mono text-xs text-slate-300">{info.getValue()}</span>
    ),
  }),
  helper.accessor((s) => `${s.origin} → ${s.destination}`, {
    id: "route",
    header: "Ruta",
    cell: (info) => {
      const s = info.row.original;
      return (
        <div className="flex flex-col">
          <span className="font-medium">
            {s.origin} <span className="text-muted-foreground">→</span> {s.destination}
          </span>
          <span className="max-w-56 truncate text-xs text-muted-foreground">{s.cargo}</span>
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
          <span className="text-[11px] text-muted-foreground">
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
    cell: (info) => <StatusBadge status={info.getValue()} />,
  }),
  helper.accessor("progress_pct", {
    header: "Avance",
    enableGlobalFilter: false,
    cell: (info) => {
      const s = info.row.original;
      const color = s.current_mode ? MODES[s.current_mode].color : "#64748b";
      return (
        <div className="flex w-28 items-center gap-2">
          <div className="h-1 flex-1 rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full"
              style={{ width: `${info.getValue()}%`, backgroundColor: color }}
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
    cell: (info) => <span className="tabular">{info.row.original.cost_fmt}</span>,
  }),
  helper.accessor("eta_at", {
    header: "ETA",
    enableGlobalFilter: false,
    cell: (info) => {
      const s = info.row.original;
      return (
        <div className="flex flex-col">
          <span className="tabular">{s.eta_fmt}</span>
          {s.delay_fmt && <span className="text-[11px] text-neon-rose">+{s.delay_fmt}</span>}
        </div>
      );
    },
  }),
  helper.accessor("client", { header: "Cliente" }),
  helper.accessor("priority", {
    header: "Prioridad",
    cell: (info) => (
      <span className="text-xs text-muted-foreground">{PRIORITIES[info.getValue()]}</span>
    ),
  }),
]);

const PAGE_SIZES = [10, 20, 50];

export function ShipmentsTable({ data }: { data: Shipment[] }) {
  const [rows] = useState(data);
  const table = useTable({
    features,
    columns,
    data: rows,
    globalFilterFn: "includesString",
    // En tránsito primero (orden operativo de STATUS_ORDER)
    initialState: {
      pagination: { pageIndex: 0, pageSize: 10 },
      sorting: [{ id: "status", desc: false }],
    },
  });

  const statusFilter = (table.getColumn("status")?.getFilterValue() as ShipmentStatus[]) ?? [];
  const modeFilter = (table.getColumn("modes")?.getFilterValue() as Mode[]) ?? [];
  const globalFilter = (table.state.globalFilter as string) ?? "";

  const statusCounts = useMemo(() => {
    const c = new Map<ShipmentStatus, number>();
    rows.forEach((r) => c.set(r.status, (c.get(r.status) ?? 0) + 1));
    return c;
  }, [rows]);
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
  const { pageIndex, pageSize } = table.state.pagination;
  const hasFilters = statusFilter.length > 0 || modeFilter.length > 0 || globalFilter.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros en una sola fila sobre la tabla */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative flex h-9 w-full max-w-xs items-center">
          <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
          <input
            value={globalFilter}
            onChange={(e) => table.setGlobalFilter(e.target.value)}
            placeholder="Buscar envío, ciudad, carga, cliente"
            aria-label="Buscar envíos"
            className="h-9 w-full rounded-md border border-input bg-white/[0.02] pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-neon-cyan/40 focus:ring-2 focus:ring-neon-cyan/15"
          />
        </label>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar por estado">
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
                className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <Badge
                  tone={active ? STATUSES[s].tone : "neutral"}
                  className={cn("cursor-pointer transition-colors", !active && "hover:border-white/20")}
                >
                  <Icon />
                  {s}
                  <span className="tabular opacity-70">{statusCounts.get(s) ?? 0}</span>
                </Badge>
              </motion.button>
            );
          })}
        </div>
        <div className="flex items-center gap-1" role="group" aria-label="Filtrar por modo">
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
                  "flex h-8 items-center gap-1.5 rounded-md border px-2 text-xs transition-colors",
                  active ? "text-foreground" : "border-white/[0.06] text-muted-foreground hover:text-foreground",
                )}
                style={active ? { borderColor: `${color}66`, backgroundColor: `${color}1a` } : undefined}
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
            }}
          >
            <X />
            Limpiar
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const canSort = header.column.getCanSort();
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 uppercase hover:text-foreground"
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
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            <AnimatePresence initial={false} mode="popLayout">
              {table.getRowModel().rows.map((row) => (
                <motion.tr
                  key={row.id}
                  layout="position"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="border-b border-border transition-colors hover:bg-white/[0.025]"
                >
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </motion.tr>
              ))}
            </AnimatePresence>
            {filteredCount === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground">
                  Ningún envío coincide con los filtros.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginación */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span className="tabular">
          {filteredCount === 0
            ? "0 envíos"
            : `${pageIndex * pageSize + 1}–${Math.min((pageIndex + 1) * pageSize, filteredCount)} de ${filteredCount} envíos`}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs">Filas</span>
          <div className="flex rounded-md border border-white/[0.06] p-0.5">
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
                    className="absolute inset-0 rounded bg-white/[0.07]"
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
