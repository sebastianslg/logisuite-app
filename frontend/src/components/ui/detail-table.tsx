"use client";

import { Download, FileDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  label: string;
  align?: "left" | "right";
  /** Contenido de la celda (puede ser un enlace o una barra). */
  render: (row: T) => React.ReactNode;
  /** Valor para el CSV; si falta, se omite la columna al exportar. */
  csv?: (row: T) => string | number;
}

/** Tabla de detalle (hojas de ampliación e historial) con exportación a CSV; en celular, filas apiladas. */
export function DetailTable<T>({
  columns,
  rows,
  getKey,
  csvName,
  empty = "Sin datos.",
}: {
  columns: Column<T>[];
  rows: T[];
  getKey: (row: T) => string;
  csvName?: string;
  empty?: string;
}) {
  const exportCsv = () => {
    const cols = columns.filter((c) => c.csv);
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const body = [cols.map((c) => esc(c.label)).join(","), ...rows.map((r) => cols.map((c) => esc(c.csv!(r))).join(","))];
    const blob = new Blob(["﻿" + body.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${csvName ?? "datos"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {csvName && rows.length > 0 && (
        <div className="mb-2 flex justify-end">
          <Button variant="secondary" size="sm" onClick={exportCsv} burst={FileDown}>
            <Download /> Exportar CSV
          </Button>
        </div>
      )}
      {/* Celular: cada fila es un bloque con la primera columna como título y el resto en pares etiqueta/valor.
          Antes la tabla se encogía hasta partir los nombres letra por letra y se desbordaba. */}
      <ul className="glass rule-list overflow-hidden rounded-3xl lg:hidden">
        {rows.map((r) => (
          <li key={getKey(r)} className="px-4 py-3.5">
            <div className="text-[0.9375rem]">{columns[0].render(r)}</div>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {columns.slice(1).map((c) => (
                <div key={c.key} className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{c.label}</dt>
                  <dd className="tabular mt-0.5 min-w-0 [overflow-wrap:anywhere]">{c.render(r)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
        {rows.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-foreground">{empty}</li>}
      </ul>
      <div className="glass hidden overflow-x-auto rounded-3xl lg:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn("h-10 px-3 text-xs font-medium whitespace-nowrap text-muted-foreground first:pl-5 last:pr-5", c.align === "right" ? "text-right" : "text-left")}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={getKey(r)} className="border-b border-border transition-colors duration-200 last:border-0 hover:bg-[color-mix(in_srgb,var(--card)_97%,var(--foreground))]">
                {columns.map((c) => (
                  <td key={c.key} className={cn("tabular px-3 py-3 align-middle first:pl-5 last:pr-5", c.align === "right" ? "text-right" : "text-left")}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-muted-foreground">
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
