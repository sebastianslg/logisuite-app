"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { Money } from "@/components/ui/money";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MODE_ORDER, MODES, PRIORITIES, STATUSES, STATUS_ORDER, tint } from "@/lib/modes";
import { EASE, T_FAST } from "@/lib/motion";
import { Reveal } from "@/components/reveal";
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
        className="font-mono text-xs text-primary underline-offset-2 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
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
          <span className="text-xs text-muted-foreground">
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
      const color = s.current_mode ? MODES[s.current_mode].color : "var(--muted-foreground)";
      return (
        <div className="flex w-28 items-center gap-2">
          <div className="h-1 flex-1 rounded-full bg-fill">
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
    cell: (info) => <Money usd={info.row.original.cost} className="tabular" />,
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
  helper.accessor("client", { header: "Cliente" }),
  helper.accessor("priority", {
    header: "Prioridad",
    cell: (info) => (
      <span className="text-xs text-muted-foreground">{PRIORITIES[info.getValue()]}</span>
    ),
  }),
]);

const PAGE_SIZES = [10, 20, 50];

export interface ShipmentFilters {
  status?: ShipmentStatus[];
  modes?: Mode[];
  q?: string;
}

export function ShipmentsTable({ data, initial }: { data: Shipment[]; initial?: ShipmentFilters }) {
  const router = useRouter();
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
      <Reveal index={1} className="flex flex-wrap items-center gap-3">
        <label className="relative flex h-9 w-full max-w-xs items-center pointer-coarse:h-11">
          <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
          <input
            value={globalFilter}
            onChange={(e) => table.setGlobalFilter(e.target.value)}
            placeholder="Buscar envío, ciudad, carga, cliente"
            aria-label="Buscar envíos"
            className="h-9 w-full rounded-xl bg-fill pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground focus:ring-[3px] focus:ring-ring/50 pointer-coarse:h-11"
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
                onClick={() => toggle("status", statusFilter, s)}
                aria-pressed={active}
                className="rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <Badge
                  tone={active ? STATUSES[s].tone : "neutral"}
                  className={cn("cursor-pointer py-1.5 text-sm press pointer-coarse:py-2.5", !active && "hover:bg-fill/70")}
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
                onClick={() => toggle("modes", modeFilter, m)}
                aria-pressed={active}
                title={`${label} (${modeCounts.get(m) ?? 0})`}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-xl border px-2 text-sm press outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 pointer-coarse:h-11 pointer-coarse:px-3",
                  active ? "text-foreground" : "border-transparent bg-fill text-muted-foreground hover:text-foreground",
                )}
                style={active ? { borderColor: tint(color, 40), backgroundColor: tint(color, 12) } : undefined}
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
      </Reveal>

      <Reveal index={2} className="glass hidden overflow-hidden rounded-3xl md:block">
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
                          className="press inline-flex items-center gap-1 rounded-md hover:text-foreground"
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
              {table.getRowModel().rows.map((row, i) => (
                <motion.tr
                  key={row.id}
                  layout="position"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, ease: EASE, delay: Math.min(i * 0.03, 0.4) }}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("a,button")) return;
                    router.push(`/envios/${row.original.code}`);
                  }}
                  className="cursor-pointer border-b border-border transition-colors duration-300 ease-apple hover:bg-fill/50"
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
                  Ningún envío coincide con los filtros. Pulsa “Limpiar” para ver todos.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Reveal>

      {/* En pantallas estrechas la tabla se convierte en una lista de tarjetas */}
      <ul className="flex flex-col gap-3 md:hidden" aria-label="Envíos">
        {table.getRowModel().rows.map((row) => {
          const sh = row.original;
          return (
            <li key={row.id}>
              <Link
                href={`/envios/${sh.code}`}
                className="glass press block rounded-2xl p-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
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
                      className="h-full rounded-full"
                      style={{
                        width: `${sh.progress_pct}%`,
                        backgroundColor: sh.current_mode ? MODES[sh.current_mode].color : "var(--muted-foreground)",
                      }}
                    />
                  </div>
                  <span className="tabular text-xs text-muted-foreground">{Math.round(sh.progress_pct)} %</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="font-mono text-xs text-muted-foreground">{sh.code}</span>
                  <span className="tabular">
                    {sh.weight_fmt} · <Money usd={sh.cost} /> · ETA {sh.eta_fmt}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
        {filteredCount === 0 && (
          <li className="px-4 py-10 text-center text-sm text-muted-foreground">
            Ningún envío coincide con los filtros. Pulsa “Limpiar” para ver todos.
          </li>
        )}
      </ul>

      {/* Paginación */}
      <Reveal index={3} className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span className="tabular">
          {filteredCount === 0
            ? "0 envíos"
            : `${pageIndex * pageSize + 1}–${Math.min((pageIndex + 1) * pageSize, filteredCount)} de ${filteredCount} envíos`}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs">Filas</span>
          <div className="flex rounded-xl bg-fill p-0.5">
            {PAGE_SIZES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => table.setPageSize(n)}
                className={cn(
                  "press relative h-7 rounded-lg px-2.5 text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  pageSize === n ? "text-foreground" : "hover:text-foreground",
                )}
              >
                {pageSize === n && (
                  <motion.span
                    layoutId="page-size"
                    className="absolute inset-0 rounded-lg bg-card shadow-sm"
                    transition={T_FAST}
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
      </Reveal>
    </div>
  );
}
