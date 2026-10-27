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

/** Tabla de detalle para las hojas de ampliación, con exportación a CSV. */
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
      <div className="overflow-x-auto rounded-2xl bg-fill/50">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn("h-9 px-3 text-xs font-medium whitespace-nowrap text-muted-foreground", c.align === "right" ? "text-right" : "text-left")}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={getKey(r)} className="border-b border-border last:border-0">
                {columns.map((c) => (
                  <td key={c.key} className={cn("tabular px-3 py-2.5 align-middle", c.align === "right" ? "text-right" : "text-left")}>
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
