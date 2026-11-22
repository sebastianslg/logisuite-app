"use client";

import { useState } from "react";
import { useMedia } from "@/lib/use-media";
import { Button } from "./button";

/** Los filtros y exportaciones operan sobre la lista completa; solo limitamos las filas montadas. */
export function usePaginas<T>(filas: T[], clave = "") {
  const papel = useMedia("print");
  const [seleccion, elegir] = useState({ clave, indice: 0 });
  const largo = filas.length > 100 ? 50 : 100;
  const paginas = Math.max(1, Math.ceil(filas.length / largo));
  const indice = seleccion.clave === clave ? Math.min(seleccion.indice, paginas - 1) : 0;
  return {
    filas: papel || paginas === 1 ? filas : filas.slice(indice * largo, (indice + 1) * largo),
    indice, paginas, ir: (i: number) => elegir({ clave, indice: i }),
  };
}

export function PaginasLocales({ indice, paginas, ir }: { indice: number; paginas: number; ir: (i: number) => void }) {
  if (paginas <= 1) return null;
  return <nav aria-label="Páginas de resultados" className="mt-3 flex flex-wrap items-center justify-end gap-3 text-sm print:hidden">
    <Button variant="secondary" disabled={!indice} onClick={() => ir(indice - 1)}>Anterior</Button>
    <span aria-live="polite" className="tabular">{indice + 1} de {paginas}</span>
    <Button variant="secondary" disabled={indice + 1 >= paginas} onClick={() => ir(indice + 1)}>Siguiente</Button>
  </nav>;
}
